/**
 * 🔍 Agent 1: Inspector (검증 에이전트)
 * 
 * 상권 분석 API를 호출하고, Gemini를 통해 전체 서비스 출력물을 교차 검증합니다.
 * 6대 검증 영역: 프랜차이즈, 업종분류, 점수산출, AI코멘트, 데이터커버리지, 카테고리매핑
 */

import { askGemini } from '../services/geminiService.js';
import { geocodeAddress } from '../services/geocoding.js';
import { getStoresInRadius } from '../services/storeData.js';
import { analyzeDistrict } from '../services/analyzer.js';
import { generateSingleAnalysisComment } from '../services/aiConsultant.js';
import { getTransitInfo } from '../services/transitData.js';
import { getDemographics } from '../services/demographicData.js';

/**
 * 전체 검증 실행 (1개 주소에 대해)
 */
export async function inspectAddress(address, radius = 500, targetCategory = '카페') {
    const startTime = Date.now();
    const issues = [];
    let analysisData = null;

    console.log(`\n🔍 === Inspector 검증 시작: ${address} (반경 ${radius}m, 카테고리: ${targetCategory}) ===`);

    try {
        // Step 1: 분석 API와 동일한 로직 실행
        const location = await geocodeAddress(address);
        const stores = await getStoresInRadius(location.latitude, location.longitude, radius);
        const analysis = analyzeDistrict(stores, targetCategory);
        const aiComments = await generateSingleAnalysisComment({ analysis, location, realEstateData: null });

        analysisData = {
            location,
            radius,
            stores,
            analysis,
            aiComments,
            storeCount: stores.length
        };

        console.log(`   📍 좌표: ${location.latitude}, ${location.longitude}`);
        console.log(`   🏪 업소 수: ${stores.length}개`);
        console.log(`   📊 종합 점수: ${analysis.overallScore}점 (${analysis.grade.grade}등급)`);

        // Step 2: 6대 영역별 검증 실행 (병렬)
        const verificationResults = await Promise.allSettled([
            verifyFranchiseData(analysis, stores),
            verifyCategoryClassification(analysis, stores),
            verifyScoreCalculation(analysis),
            verifyAIComments(aiComments, analysis),
            verifyDataCoverage(analysis, stores, location, radius),
            verifyCategoryMapping(stores)
        ]);

        const verificationLabels = [
            '프랜차이즈 감지',
            '업종 분류 정확성',
            '점수 산출 합리성',
            'AI 코멘트 품질',
            '데이터 커버리지',
            '카테고리 매핑'
        ];

        verificationResults.forEach((result, idx) => {
            if (result.status === 'fulfilled' && result.value.length > 0) {
                issues.push(...result.value.map(issue => ({
                    ...issue,
                    area: verificationLabels[idx]
                })));
            } else if (result.status === 'rejected') {
                issues.push({
                    area: verificationLabels[idx],
                    severity: 'LOW',
                    type: 'VERIFICATION_ERROR',
                    description: `검증 실행 중 오류: ${result.reason?.message || '알 수 없는 오류'}`,
                    suggestion: '해당 검증 모듈 점검 필요'
                });
            }
        });

    } catch (error) {
        issues.push({
            area: '시스템',
            severity: 'CRITICAL',
            type: 'SYSTEM_ERROR',
            description: `분석 파이프라인 오류: ${error.message}`,
            suggestion: '서버 설정 및 API 키 점검'
        });
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n   ⏱️ 검증 완료: ${elapsed}초 소요, ${issues.length}건 이슈 발견`);

    return {
        address,
        radius,
        targetCategory,
        timestamp: new Date().toISOString(),
        elapsedSeconds: parseFloat(elapsed),
        totalIssues: issues.length,
        issuesBySeverity: {
            CRITICAL: issues.filter(i => i.severity === 'CRITICAL').length,
            HIGH: issues.filter(i => i.severity === 'HIGH').length,
            MEDIUM: issues.filter(i => i.severity === 'MEDIUM').length,
            LOW: issues.filter(i => i.severity === 'LOW').length
        },
        issues,
        analysisSnapshot: analysisData ? {
            storeCount: analysisData.storeCount,
            overallScore: analysisData.analysis.overallScore,
            grade: analysisData.analysis.grade.grade,
            topCategories: analysisData.analysis.categorySummary.slice(0, 5).map(c => c.name),
            franchiseCount: analysisData.analysis.franchiseAnalysis.totalFranchise,
            franchiseRatio: analysisData.analysis.franchiseAnalysis.franchiseRatio
        } : null
    };
}

/**
 * 검증 1: 프랜차이즈 감지 정확성 (로컬 패턴 매칭 기반)
 * 
 * ⚠️ 설계 원칙: Gemini에게 "빠진 프랜차이즈를 찾아줘"라고 매번 요청하면
 * AI는 항상 무언가를 찾아내어 매 루프마다 허위 이슈를 양산합니다.
 * 대신 로컬 패턴 기반으로만 검증하여 진짜 시스템 오류만 잡습니다.
 */
async function verifyFranchiseData(analysis, stores) {
    const issues = [];
    const { franchiseAnalysis } = analysis;

    // 1-A: 프랜차이즈 비율 합리성 검증 (극단적 이상치만 잡기)
    const ratio = parseFloat(franchiseAnalysis.franchiseRatio);
    if (ratio < 2 && stores.length > 200) {
        issues.push({
            severity: 'LOW',
            type: 'FRANCHISE_RATIO_LOW',
            description: `업소 ${stores.length}개 중 프랜차이즈 비율이 ${ratio}%로 매우 낮음 (지역 특성일 수 있음)`,
            suggestion: '대학가/주택가 등 프랜차이즈가 적은 지역일 수 있으므로 참고용'
        });
    }

    // 1-B: 편의점 3사(CU, GS25, 세븐일레븐)가 모두 0개이면 매칭 로직 이상
    const majorConvenienceFound = franchiseAnalysis.brands.some(b => 
        ['CU', 'GS25', '세븐일레븐'].includes(b.name)
    );
    if (!majorConvenienceFound && stores.length > 50) {
        // 편의점 키워드가 업소명에 있는지 로컬 확인
        const hasCU = stores.some(s => /\bCU\b|씨유/.test(s.name));
        const hasGS = stores.some(s => /GS25|지에스/.test(s.name));
        if (hasCU || hasGS) {
            issues.push({
                severity: 'HIGH',
                type: 'FRANCHISE_MATCH_FAILURE',
                description: '편의점(CU/GS25)이 업소명에 존재하나 프랜차이즈로 매칭되지 않음',
                suggestion: 'normalizeName() 또는 KNOWN_FRANCHISES 매칭 로직 점검 필요'
            });
        }
    }

    return issues;
}

/**
 * 검증 2: 업종 분류 정확성 (로컬 패턴 기반)
 * 
 * ⚠️ 설계 원칙: Gemini에게 100개 업소를 보내 "잘못 분류된거 찾아줘"라고 하면
 * AI는 공공데이터 원본의 분류 자체를 문제 삼아 매번 이슈를 만들어냅니다.
 * 공공데이터 원본 분류는 우리가 바꿀 수 없으므로, 우리 매핑 로직만 검증합니다.
 */
async function verifyCategoryClassification(analysis, stores) {
    const issues = [];

    // 2-A: '기타' 카테고리 비율이 비정상적으로 높은 경우만 잡기
    const etcStores = stores.filter(s => s.categoryL === '기타' || s.categoryL === '기타' || !s.categoryL);
    const etcRatio = stores.length > 0 ? (etcStores.length / stores.length * 100) : 0;

    if (etcRatio > 15 && stores.length > 30) {
        issues.push({
            severity: 'MEDIUM',
            type: 'CATEGORY_ETC_HIGH',
            description: `'기타' 분류 비율이 ${etcRatio.toFixed(1)}%로 높음 (${etcStores.length}/${stores.length}개)`,
            suggestion: 'categories.json에 미등록 카테고리 매핑 추가 검토'
        });
    }

    return issues;
}

/**
 * 검증 3: 점수 산출 합리성
 */
async function verifyScoreCalculation(analysis) {
    const issues = [];
    const { overallScore, grade, indicators, totalStores, categorySummary } = analysis;

    // 3-A: 지표와 종합점수 간 괴리 검증
    const indicatorValues = Object.values(indicators).map(i => i.value);
    const avgIndicator = indicatorValues.reduce((a, b) => a + b, 0) / indicatorValues.length;
    const scoreDiff = Math.abs(overallScore - avgIndicator);

    if (scoreDiff > 20) {
        issues.push({
            severity: 'MEDIUM',
            type: 'SCORE_DISCREPANCY',
            description: `종합점수(${overallScore})와 지표평균(${avgIndicator.toFixed(1)})의 차이가 ${scoreDiff.toFixed(1)}점으로 크다`,
            suggestion: '가중치 배분 재검토 필요'
        });
    }

    // 3-B: 극단적 지표 검증
    Object.entries(indicators).forEach(([key, ind]) => {
        if (ind.value === 0 || ind.value === 100) {
            issues.push({
                severity: 'LOW',
                type: 'EXTREME_INDICATOR',
                description: `${ind.label} 지표가 극단값(${ind.value})을 기록`,
                suggestion: `${key} 산출 로직의 경계값 처리 검토`
            });
        }
    });

    // 3-C: 업소 수 대비 등급 합리성
    if (totalStores < 10 && (grade.grade === 'S' || grade.grade === 'A')) {
        issues.push({
            severity: 'HIGH',
            type: 'SCORE_ANOMALY',
            description: `업소 ${totalStores}개로 데이터가 부족한데 ${grade.grade}등급으로 높게 평가됨`,
            suggestion: '최소 데이터 기준 미달 시 "데이터 부족" 경고 표시 추가 필요',
            autoFixable: true,
            fixTarget: {
                file: 'server/services/analyzer.js',
                type: 'logic_update',
                description: '최소 업소 수 기준 미달 시 경고 추가'
            }
        });
    }

    // 3-D: 카테고리 수 대비 다양성 지표 검증
    const categoryCount = categorySummary.length;
    if (categoryCount <= 2 && indicators.diversityIndex.value > 50) {
        issues.push({
            severity: 'MEDIUM',
            type: 'DIVERSITY_MISCALC',
            description: `업종이 ${categoryCount}개뿐인데 다양성 지수가 ${indicators.diversityIndex.value}으로 높게 나옴`,
            suggestion: 'Shannon Index 계산 시 최소 업종 수 보정 필요'
        });
    }

    return issues;
}

/**
 * 검증 4: AI 코멘트 품질 (로컬 무결성 검증)
 * 
 * ⚠️ 설계 원칙: Gemini에게 AI 코멘트를 평가시키면 항상 "POOR"를 줍니다.
 * 자기가 생성한 코멘트를 다시 자기가 평가하는 구조적 모순이므로, 
 * 대신 실제 수치와 코멘트 간 팩트 불일치만 로컬로 검증합니다.
 */
async function verifyAIComments(aiComments, analysis) {
    const issues = [];

    // 4-A: 코멘트가 아예 비어있으면 이슈
    if (!aiComments || !aiComments.overview) {
        issues.push({
            severity: 'HIGH',
            type: 'AI_COMMENT_EMPTY',
            description: 'AI 코멘트가 생성되지 않음',
            suggestion: 'aiConsultant.js의 Gemini 호출 및 폴백 로직 점검'
        });
        return issues;
    }

    // 4-B: overview에 실제 점수와 다른 점수가 언급되면 할루시네이션
    const scoreInComment = aiComments.overview.match(/(\d{2,3})점/);
    if (scoreInComment) {
        const mentionedScore = parseInt(scoreInComment[1]);
        if (Math.abs(mentionedScore - analysis.overallScore) > 5) {
            issues.push({
                severity: 'HIGH',
                type: 'AI_HALLUCINATION',
                description: `AI 코멘트에 ${mentionedScore}점이 언급되었으나 실제 점수는 ${analysis.overallScore}점 (할루시네이션)`,
                suggestion: 'aiConsultant.js의 checkAndFixHallucination 로직 강화 필요'
            });
        }
    }

    // 4-C: strengths/weaknesses가 배열이 아니거나 비어있으면
    if (!Array.isArray(aiComments.strengths) || aiComments.strengths.length === 0) {
        issues.push({
            severity: 'LOW',
            type: 'AI_COMMENT_INCOMPLETE',
            description: 'AI 코멘트 strengths 항목이 비어있음',
            suggestion: '폴백 규칙 기반 코멘트 로직 점검'
        });
    }

    return issues;
}

/**
 * 검증 5: 데이터 커버리지 (로컬 통계 기반)
 * 
 * ⚠️ 설계 원칙: Gemini에게 "이 지역에 뭐가 빠졌나 찾아줘"라고 하면
 * AI는 자기 상식으로 "OO브랜드가 있을 것 같은데 없다"라며 항상 이슈를 만듭니다.
 * 공공데이터에 없는 업소는 우리가 만들어낼 수 없으므로 로컬 통계만 검증합니다.
 */
async function verifyDataCoverage(analysis, stores, location, radius) {
    const issues = [];

    // 5-A: 데이터 자체가 비어있으면 API 문제
    if (stores.length === 0) {
        issues.push({
            severity: 'HIGH',
            type: 'DATA_EMPTY',
            description: `${location.address} 반경 ${radius}m에서 업소 0건 조회됨`,
            suggestion: '공공데이터 API 키/파라미터 또는 좌표 확인 필요'
        });
    } else if (stores.length < 5) {
        issues.push({
            severity: 'MEDIUM',
            type: 'DATA_SPARSE',
            description: `업소 ${stores.length}건으로 데이터가 매우 적음`,
            suggestion: '조회 반경 확대 또는 좌표 정확도 확인'
        });
    }

    return issues;
}

/**
 * 검증 6: 카테고리 매핑 적절성 (로컬 데이터 기반)
 * 
 * ⚠️ 설계 원칙: categories.json에 등록되지 않은 원본 카테고리가 있는지만 검사합니다.
 */
async function verifyCategoryMapping(stores) {
    const issues = [];

    // categories.json의 매핑된 결과와 원본을 비교
    // categoryL이 원본 그대로 남아있으면(= 매핑 테이블에 없었으면) 매핑 누락
    const unmappedRaw = {};
    stores.forEach(s => {
        // 매핑 후에도 원본 그대로인 카테고리 수집 (mapCategoryName이 원본을 반환한 경우)
        // 이미 매핑된 결과이므로, 알려진 '정상 매핑된' 카테고리가 아닌 것을 찾음
        const knownMapped = ['외식·음료', '쇼핑·판매', '생활서비스', '교육·학원', '병원·의료',
            '부동산·시설관리', '문화·여가시설', '숙박시설', '스포츠·레저', '카페·음료',
            '한식', '일식·중식', '양식·레스토랑', '패스트푸드', '치킨·호프', '주점·주류',
            '베이커리·디저트', '패션·의류', '뷰티·화장품', '뷰티·미용', '약국·의료',
            '금융·보험', '편의점·슈퍼', '자동차·정비', '일반사업·사무', '분식·간식',
            '음식점·카페', '교육·학습', '병원·약국', '기타', '피자'];
        const cat = s.categoryL;
        if (cat && !knownMapped.includes(cat) && !cat.includes('·')) {
            unmappedRaw[cat] = (unmappedRaw[cat] || 0) + 1;
        }
    });

    const unmappedList = Object.entries(unmappedRaw).filter(([_, count]) => count >= 3);
    if (unmappedList.length > 0) {
        issues.push({
            severity: 'LOW',
            type: 'MAPPING_MISSING',
            description: `매핑되지 않은 카테고리 ${unmappedList.length}건: ${unmappedList.map(([k, v]) => `${k}(${v}개)`).join(', ')}`,
            suggestion: 'categories.json에 해당 카테고리 매핑 추가 필요'
        });
    }

    return issues;
}

/**
 * JSON 안전 파싱 유틸리티
 */
function safeParseJSON(text) {
    try {
        // 코드블록 제거
        let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
        return JSON.parse(cleaned);
    } catch (e) {
        // JSON 부분만 추출 시도
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                return JSON.parse(jsonMatch[0]);
            } catch (e2) {
                console.warn('JSON 파싱 최종 실패:', text.substring(0, 100));
                return null;
            }
        }
        return null;
    }
}

/**
 * 구 단위 전체 검증 (10개 주소)
 */
export async function inspectDistrict(districtName, addresses, categories = null) {
    const testCategories = categories || ['카페', '음식점', '편의점'];
    const results = [];

    console.log(`\n🏙️ === ${districtName} 전체 검증 시작 (${addresses.length}개 주소) ===\n`);

    for (let i = 0; i < addresses.length; i++) {
        const address = addresses[i];
        const category = testCategories[i % testCategories.length];
        
        try {
            console.log(`\n[${i + 1}/${addresses.length}] ${address} (${category})`);
            const result = await inspectAddress(address, 500, category);
            results.push(result);

            // API 과부하 방지 (3초 대기)
            if (i < addresses.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        } catch (error) {
            console.error(`   ❌ ${address} 검증 실패:`, error.message);
            results.push({
                address,
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    // 구 단위 요약
    const totalIssues = results.reduce((sum, r) => sum + (r.totalIssues || 0), 0);
    const criticalCount = results.reduce((sum, r) => sum + (r.issuesBySeverity?.CRITICAL || 0), 0);
    const highCount = results.reduce((sum, r) => sum + (r.issuesBySeverity?.HIGH || 0), 0);

    return {
        district: districtName,
        timestamp: new Date().toISOString(),
        addressesTested: addresses.length,
        totalIssuesFound: totalIssues,
        summary: {
            critical: criticalCount,
            high: highCount,
            medium: results.reduce((sum, r) => sum + (r.issuesBySeverity?.MEDIUM || 0), 0),
            low: results.reduce((sum, r) => sum + (r.issuesBySeverity?.LOW || 0), 0)
        },
        results
    };
}
