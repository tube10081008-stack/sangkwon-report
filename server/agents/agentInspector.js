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
 * 검증 1: 프랜차이즈 감지 정확성
 */
async function verifyFranchiseData(analysis, stores) {
    const issues = [];
    const { franchiseAnalysis } = analysis;

    // 1-A: Gemini에게 누락된 프랜차이즈 확인 요청
    const storeNames = stores.map(s => s.name).slice(0, 200); // 최대 200개
    const knownBrands = franchiseAnalysis.brands.map(b => b.name);

    const prompt = `당신은 한국 프랜차이즈 전문가입니다. 아래는 특정 지역의 상가 업소 이름 목록입니다.
이 중에서 프랜차이즈로 감지되지 않았지만, 실제로는 프랜차이즈인 업소를 찾아주세요.

[현재 감지된 프랜차이즈 브랜드]: ${knownBrands.join(', ') || '없음'}

[전체 업소 이름 목록 (일부)]:
${storeNames.join('\n')}

반드시 아래 JSON 형식으로만 응답하세요:
{
  "missedFranchises": [
    {"name": "브랜드명", "matchedStores": ["매칭된 업소명1"], "category": "업종"}
  ],
  "accuracy": "HIGH/MEDIUM/LOW",
  "notes": "요약 설명"
}`;

    try {
        const response = await askGemini(prompt, null,
            '프랜차이즈 데이터 검증 전문가. JSON만 반환하세요. 마크다운 코드블록 없이 순수 JSON만 반환.');

        const parsed = safeParseJSON(response);
        if (parsed && parsed.missedFranchises && parsed.missedFranchises.length > 0) {
            issues.push({
                severity: parsed.missedFranchises.length > 5 ? 'HIGH' : 'MEDIUM',
                type: 'FRANCHISE_MISSING',
                description: `프랜차이즈 ${parsed.missedFranchises.length}개 브랜드 감지 누락`,
                details: parsed.missedFranchises,
                suggestion: `KNOWN_FRANCHISES 배열에 다음 추가 필요: ${parsed.missedFranchises.map(f => f.name).join(', ')}`,
                autoFixable: true,
                fixTarget: {
                    file: 'server/services/storeData.js',
                    array: 'KNOWN_FRANCHISES',
                    additions: parsed.missedFranchises.map(f => f.name)
                }
            });
        }
    } catch (e) {
        console.warn('   ⚠️ 프랜차이즈 검증 Gemini 호출 실패:', e.message);
    }

    // 1-B: 프랜차이즈 비율 합리성 검증
    const ratio = parseFloat(franchiseAnalysis.franchiseRatio);
    if (ratio < 5 && stores.length > 100) {
        issues.push({
            severity: 'MEDIUM',
            type: 'FRANCHISE_RATIO_LOW',
            description: `업소 ${stores.length}개 중 프랜차이즈 비율이 ${ratio}%로 비정상적으로 낮음`,
            suggestion: 'KNOWN_FRANCHISES 목록 확장 또는 매칭 로직 개선 필요'
        });
    }

    return issues;
}

/**
 * 검증 2: 업종 분류 정확성
 */
async function verifyCategoryClassification(analysis, stores) {
    const issues = [];

    // 업소명과 분류가 맞지 않는 케이스 샘플 추출
    const sampleStores = stores.slice(0, 100).map(s => ({
        name: s.name,
        categoryL: s.categoryL,
        categoryM: s.categoryM,
        categoryS: s.categoryS
    }));

    const prompt = `당신은 한국 상가 업종 분류 전문가입니다. 아래 업소들의 이름과 업종 분류를 비교하여 잘못 분류된 것을 찾아주세요.

[업소 데이터 (이름 → 대분류/중분류/소분류)]:
${sampleStores.map(s => `- ${s.name}: ${s.categoryL} > ${s.categoryM} > ${s.categoryS}`).join('\n')}

반드시 아래 JSON 형식으로만 응답하세요:
{
  "misclassified": [
    {"storeName": "업소명", "currentCategory": "현재 분류", "suggestedCategory": "올바른 분류", "reason": "이유"}
  ],
  "overallAccuracy": "HIGH/MEDIUM/LOW",
  "notes": "요약"
}`;

    try {
        const response = await askGemini(prompt, null,
            '업종 분류 검증 전문가. JSON만 반환하세요. 마크다운 코드블록 없이 순수 JSON만 반환.');

        const parsed = safeParseJSON(response);
        if (parsed && parsed.misclassified && parsed.misclassified.length > 0) {
            issues.push({
                severity: parsed.misclassified.length > 10 ? 'HIGH' : 'MEDIUM',
                type: 'CATEGORY_MISCLASSIFIED',
                description: `업종 분류 오류 ${parsed.misclassified.length}건 발견 (정확도: ${parsed.overallAccuracy})`,
                details: parsed.misclassified,
                suggestion: '공공데이터 원본 분류 문제이므로 후처리 매핑 테이블 추가 검토',
                autoFixable: false
            });
        }
    } catch (e) {
        console.warn('   ⚠️ 업종분류 검증 Gemini 호출 실패:', e.message);
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
 * 검증 4: AI 코멘트 품질
 */
async function verifyAIComments(aiComments, analysis) {
    const issues = [];

    const prompt = `당신은 상권분석 리포트 품질 검수 전문가입니다. 아래 분석 데이터와 생성된 AI 코멘트를 비교하여 문제를 찾으세요.

[분석 데이터 요약]:
- 종합: ${analysis.overallScore}점, ${analysis.grade.grade}등급
- 업소 수: ${analysis.totalStores}개
- 프랜차이즈 비율: ${analysis.franchiseAnalysis.franchiseRatio}%
- 상위 업종: ${analysis.categorySummary.slice(0, 3).map(c => `${c.name}(${c.count}개)`).join(', ')}

[생성된 AI 코멘트]:
- 개요: ${aiComments.overview}
- 강점: ${JSON.stringify(aiComments.strengths)}
- 약점: ${JSON.stringify(aiComments.weaknesses)}
- 결론: ${aiComments.conclusion}

반드시 아래 JSON 형식으로만 응답하세요:
{
  "inconsistencies": [
    {"section": "섹션명", "issue": "문제 설명", "severity": "HIGH/MEDIUM/LOW"}
  ],
  "missingInsights": ["누락된 인사이트1"],
  "overallQuality": "GOOD/FAIR/POOR"
}`;

    try {
        const response = await askGemini(prompt, null,
            '리포트 품질 검수 전문가. JSON만 반환하세요. 마크다운 코드블록 없이 순수 JSON만 반환.');

        const parsed = safeParseJSON(response);
        if (parsed) {
            if (parsed.inconsistencies && parsed.inconsistencies.length > 0) {
                issues.push({
                    severity: 'MEDIUM',
                    type: 'AI_COMMENT_INCONSISTENCY',
                    description: `AI 코멘트와 데이터 간 불일치 ${parsed.inconsistencies.length}건`,
                    details: parsed.inconsistencies,
                    suggestion: 'aiConsultant.js의 코멘트 생성 로직에 데이터 기반 조건문 보강 필요'
                });
            }
            if (parsed.overallQuality === 'POOR') {
                issues.push({
                    severity: 'HIGH',
                    type: 'AI_COMMENT_QUALITY',
                    description: 'AI 코멘트 전반적 품질이 "POOR"로 평가됨',
                    suggestion: 'aiConsultant.js의 코멘트 생성 함수 전면 개선 필요'
                });
            }
        }
    } catch (e) {
        console.warn('   ⚠️ AI 코멘트 검증 실패:', e.message);
    }

    return issues;
}

/**
 * 검증 5: 데이터 커버리지
 */
async function verifyDataCoverage(analysis, stores, location, radius) {
    const issues = [];
    const { categorySummary, franchiseAnalysis } = analysis;

    // 5-A: Gemini에게 해당 지역의 예상 데이터와 비교 요청
    const prompt = `당신은 한국 상권 분석 전문가입니다. 아래 지역의 분석 데이터를 보고, 누락되거나 비정상적인 부분을 찾아주세요.

[분석 지역]: ${location.address} (반경 ${radius}m)
[총 업소 수]: ${stores.length}개
[업종 분포]:
${categorySummary.slice(0, 8).map(c => `- ${c.name}: ${c.count}개 (${c.percentage}%)`).join('\n')}
[감지된 프랜차이즈]: ${franchiseAnalysis.topBrands.slice(0, 10).map(b => `${b.name}(${b.count}개)`).join(', ') || '없음'}

이 지역에서 일반적으로 기대되는 것과 비교하여 다음을 판단해주세요:
1. 업소 수가 해당 지역 규모 대비 적절한가?
2. 누락이 의심되는 주요 업종이 있는가?
3. 프랜차이즈 감지에서 빠진 주요 브랜드가 있는가?

반드시 아래 JSON 형식으로만 응답하세요:
{
  "storeCountAssessment": "ADEQUATE/LOW/HIGH",
  "missingCategories": ["누락 의심 업종"],
  "missingBrands": ["누락 의심 브랜드"],
  "dataQuality": "GOOD/FAIR/POOR",
  "notes": "종합 의견"
}`;

    try {
        const response = await askGemini(prompt, null,
            '상권 데이터 커버리지 검증 전문가. JSON만 반환하세요. 마크다운 코드블록 없이 순수 JSON만 반환.');

        const parsed = safeParseJSON(response);
        if (parsed) {
            if (parsed.storeCountAssessment === 'LOW') {
                issues.push({
                    severity: 'MEDIUM',
                    type: 'DATA_COVERAGE_LOW',
                    description: `업소 수(${stores.length}개)가 해당 지역 규모 대비 부족`,
                    suggestion: '공공데이터 API 조회 반경 또는 페이지 수 확대 검토'
                });
            }
            if (parsed.missingBrands && parsed.missingBrands.length > 0) {
                issues.push({
                    severity: 'MEDIUM',
                    type: 'BRAND_COVERAGE_GAP',
                    description: `주요 브랜드 누락 의심: ${parsed.missingBrands.join(', ')}`,
                    details: { missingBrands: parsed.missingBrands },
                    suggestion: 'KNOWN_FRANCHISES 배열 확장 필요',
                    autoFixable: true,
                    fixTarget: {
                        file: 'server/services/storeData.js',
                        array: 'KNOWN_FRANCHISES',
                        additions: parsed.missingBrands
                    }
                });
            }
            if (parsed.dataQuality === 'POOR') {
                issues.push({
                    severity: 'HIGH',
                    type: 'DATA_QUALITY_POOR',
                    description: '전반적 데이터 품질이 낮음',
                    details: { notes: parsed.notes },
                    suggestion: '대체 데이터 소스 추가 또는 기존 API 파라미터 조정 필요'
                });
            }
        }
    } catch (e) {
        console.warn('   ⚠️ 데이터 커버리지 검증 실패:', e.message);
    }

    return issues;
}

/**
 * 검증 6: 카테고리 매핑 적절성
 */
async function verifyCategoryMapping(stores) {
    const issues = [];

    // 현재 매핑 테이블
    const currentMapping = {
        '과학·기술': '일반사업·사무',
        '시설관리·임대': '부동산·시설관리',
        '수리·개인': '생활서비스'
    };

    // 원본 카테고리 분포 수집
    const rawCategories = {};
    stores.forEach(s => {
        const raw = s.categoryL;
        rawCategories[raw] = (rawCategories[raw] || 0) + 1;
    });

    const prompt = `당신은 한국 상가 업종 분류 표준화 전문가입니다.
현재 상가업소 데이터의 대분류 카테고리를 사용자 친화적 이름으로 매핑하고 있습니다.

[현재 매핑 규칙]:
${Object.entries(currentMapping).map(([k, v]) => `- "${k}" → "${v}"`).join('\n')}

[실제 데이터의 원본 카테고리 분포]:
${Object.entries(rawCategories).sort((a, b) => b[1] - a[1]).map(([k, v]) => `- ${k}: ${v}개`).join('\n')}

질문:
1. 현재 매핑에 빠진 카테고리가 있는가?
2. 기존 매핑 중 부적절한 것이 있는가?
3. 사용자 이해도를 높이기 위해 추가/수정할 매핑이 있는가?

반드시 아래 JSON 형식으로만 응답하세요:
{
  "missingMappings": [{"from": "원본명", "to": "제안명", "reason": "이유"}],
  "incorrectMappings": [{"from": "원본명", "currentTo": "현재 변환명", "suggestedTo": "제안명"}],
  "overallAssessment": "GOOD/NEEDS_UPDATE"
}`;

    try {
        const response = await askGemini(prompt, null,
            '카테고리 매핑 검증 전문가. JSON만 반환하세요. 마크다운 코드블록 없이 순수 JSON만 반환.');

        const parsed = safeParseJSON(response);
        if (parsed) {
            if (parsed.missingMappings && parsed.missingMappings.length > 0) {
                issues.push({
                    severity: 'LOW',
                    type: 'MAPPING_MISSING',
                    description: `카테고리 매핑 추가 필요: ${parsed.missingMappings.length}건`,
                    details: parsed.missingMappings,
                    suggestion: 'CATEGORY_DISPLAY_MAP에 새 매핑 추가',
                    autoFixable: true,
                    fixTarget: {
                        file: 'server/services/storeData.js',
                        object: 'CATEGORY_DISPLAY_MAP',
                        additions: parsed.missingMappings.reduce((acc, m) => {
                            acc[m.from] = m.to;
                            return acc;
                        }, {})
                    }
                });
            }
            if (parsed.incorrectMappings && parsed.incorrectMappings.length > 0) {
                issues.push({
                    severity: 'MEDIUM',
                    type: 'MAPPING_INCORRECT',
                    description: `카테고리 매핑 수정 필요: ${parsed.incorrectMappings.length}건`,
                    details: parsed.incorrectMappings,
                    suggestion: 'CATEGORY_DISPLAY_MAP 수정 필요'
                });
            }
        }
    } catch (e) {
        console.warn('   ⚠️ 카테고리 매핑 검증 실패:', e.message);
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
