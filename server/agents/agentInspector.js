/**
 * 🔍 Agent Inspector V2 — 서비스 품질 QA (Quality Assurance)
 * 
 * ⚠️ 설계 원칙:
 * 이 모듈은 "코드 개선점 찾기"가 아닌, "고객이 지금 주소를 넣으면 정상 보고서가 나오는가?"를 검증합니다.
 * 
 * Phase 1: 서비스 가동 확인 (Smoke Test)
 * Phase 2: 보고서 완결성 검증 (Report Completeness)
 * Phase 3: 데이터 파이프라인 건강 진단 (Pipeline Health)
 * Phase 4: AI 할루시네이션 팩트체크 (AI Fact Check)
 * Phase 5: 성능 모니터링 (Performance)
 */

import { geocodeAddress, reverseGeocode } from '../services/geocoding.js';
import { getStoresInRadius } from '../services/storeData.js';
import { analyzeDistrict } from '../services/analyzer.js';
import { generateSingleAnalysisComment } from '../services/aiConsultant.js';
import { getTransitInfo } from '../services/transitData.js';
import { getDemographics } from '../services/demographicData.js';
import { askGemini } from '../services/geminiService.js';

let getSeoulDistrictData, getRealEstateData;
try {
    const seoulMod = await import('../services/seoulData.js');
    getSeoulDistrictData = seoulMod.getSeoulDistrictData;
} catch (e) { getSeoulDistrictData = async () => null; }
try {
    const reMod = await import('../services/realEstateData.js');
    getRealEstateData = reMod.getRealEstateData;
} catch (e) { getRealEstateData = async () => null; }

// ─────────────────────────────────────────────
// 공개 API
// ─────────────────────────────────────────────

/**
 * 단일 주소에 대해 전 Phase QA 실행
 */
export async function inspectAddress(address, radius = 500, targetCategory = '카페') {
    const startTime = Date.now();
    const issues = [];
    let pipelineResult = null;

    console.log(`\n🔍 QA 검증: ${address} (반경 ${radius}m)`);

    // ── Phase 1 + 2: 전체 파이프라인 실행 & 결과 완결성 검증 ──
    try {
        const t0 = Date.now();

        // 고객이 주소를 넣었을 때 실행되는 것과 동일한 파이프라인
        const location = await geocodeAddress(address);
        // 2. 외부 API 병렬 사전 요청 (최적화)
        const pendingTransitInfo = getTransitInfo(location.latitude, location.longitude, radius).catch(() => null);
        const pendingSeoulData = getSeoulDistrictData(location.latitude, location.longitude).catch(() => null);
        const pendingRegionInfo = reverseGeocode(location.latitude, location.longitude).catch(() => null);

        // 3. 반경 내 상가업소 조회 (가장 무거운 작업)
        const stores = await getStoresInRadius(location.latitude, location.longitude, radius);
        
        // 4. 동기 연산
        const analysis = analyzeDistrict(stores, targetCategory);

        // 5. 종속성 있는 API 스케줄링
        const pendingDemographics = getDemographics(location.latitude, location.longitude, location, stores).catch(() => null);
        
        const regionInfo = await pendingRegionInfo;
        const bCode = regionInfo?.code || null;
        const pendingRealEstateData = bCode ? getRealEstateData(bCode, location, radius).catch(() => null) : Promise.resolve(null);
        
        // 6. 모든 병렬 작업 대기
        const [transitInfo, seoulData, demographics, realEstateData] = await Promise.all([
            pendingTransitInfo,
            pendingSeoulData,
            pendingDemographics,
            pendingRealEstateData
        ]);

        const integratedResult = { analysis, location, realEstateData, transitInfo, demographics, seoulData };
        const aiComments = await generateSingleAnalysisComment(integratedResult);

        const elapsed = (Date.now() - t0) / 1000;

        pipelineResult = {
            location, stores, analysis, aiComments,
            transitInfo, demographics, seoulData, realEstateData,
            elapsedSeconds: elapsed
        };

        console.log(`   📍 ${location.address} | 업소 ${stores.length}개 | ${analysis.overallScore}점 ${analysis.grade.grade}등급 | ${elapsed.toFixed(1)}초`);

        // Phase 5: 성능 모니터링
        issues.push(...checkPerformance(elapsed, address));

        // Phase 6: 논리적 모순 및 이상치 탐지 (Data Anomaly)
        issues.push(...checkDataAnomaly(pipelineResult, targetCategory));

        // Phase 7: AI 인사이트 퀄리티 딥체크 (Insight Quality)
        issues.push(...checkAIQuality(pipelineResult, targetCategory));

        // Phase 8: 프리미엄 데이터 정합성 검사 (Premium Data Validation)
        issues.push(...checkPremiumDataValidation(pipelineResult));

    } catch (error) {
        // Phase 1 실패 — 파이프라인 자체가 터짐
        issues.push({
            phase: 'Phase 1: Smoke Test',
            severity: 'CRITICAL',
            type: 'PIPELINE_CRASH',
            description: `분석 파이프라인 크래시: ${error.message}`,
            suggestion: '서버 로그 확인 및 API 키 점검 필요'
        });
    }

    const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    return {
        address,
        radius,
        targetCategory,
        timestamp: new Date().toISOString(),
        elapsedSeconds: parseFloat(totalElapsed),
        totalIssues: issues.length,
        issuesBySeverity: {
            CRITICAL: issues.filter(i => i.severity === 'CRITICAL').length,
            HIGH: issues.filter(i => i.severity === 'HIGH').length,
            MEDIUM: issues.filter(i => i.severity === 'MEDIUM').length,
            LOW: issues.filter(i => i.severity === 'LOW').length
        },
        issues,
        analysisSnapshot: pipelineResult ? {
            storeCount: pipelineResult.stores.length,
            overallScore: pipelineResult.analysis.overallScore,
            grade: pipelineResult.analysis.grade.grade,
            topCategories: pipelineResult.analysis.categorySummary.slice(0, 5).map(c => c.name),
            franchiseCount: pipelineResult.analysis.franchiseAnalysis.totalFranchise,
            franchiseRatio: pipelineResult.analysis.franchiseAnalysis.franchiseRatio
        } : null
    };
}

/**
 * 구 단위 QA (3개 대표 주소)
 */
export async function inspectDistrict(districtName, addresses, categories = null) {
    const testCategories = categories || ['카페', '음식점', '편의점'];
    // 비용 절감: 10개 중 샘플링 -> 퀄리티 점검 강화를 위해 6개로 확대 (2배)
    const sampleAddresses = addresses.length > 6
        ? [
            addresses[0], 
            addresses[Math.floor(addresses.length / 5)], 
            addresses[Math.floor(addresses.length / 2)], 
            addresses[Math.floor(addresses.length * 3 / 4)],
            addresses[addresses.length - 2],
            addresses[addresses.length - 1]
          ]
        : addresses;

    const results = [];

    console.log(`\n🏙️ === ${districtName} 서비스 QA 시작 (${sampleAddresses.length}개 주소) ===\n`);

    // Phase 3: 데이터 파이프라인 개별 건강 진단 (1회만)
    const pipelineHealth = await checkPipelineHealth();

    for (let i = 0; i < sampleAddresses.length; i++) {
        const address = sampleAddresses[i];
        const category = testCategories[i % testCategories.length];

        try {
            console.log(`\n[${i + 1}/${sampleAddresses.length}] ${address} (${category})`);
            const result = await inspectAddress(address, 500, category);

            // Phase 3 결과를 첫 번째 결과에 병합
            if (i === 0 && pipelineHealth.length > 0) {
                result.issues.push(...pipelineHealth);
                result.totalIssues = result.issues.length;
                result.issuesBySeverity = {
                    CRITICAL: result.issues.filter(i => i.severity === 'CRITICAL').length,
                    HIGH: result.issues.filter(i => i.severity === 'HIGH').length,
                    MEDIUM: result.issues.filter(i => i.severity === 'MEDIUM').length,
                    LOW: result.issues.filter(i => i.severity === 'LOW').length
                };
            }

            results.push(result);

            // API 과부하 방지
            if (i < sampleAddresses.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        } catch (error) {
            console.error(`   ❌ ${address} QA 실패:`, error.message);
            results.push({
                address,
                error: error.message,
                timestamp: new Date().toISOString(),
                totalIssues: 1,
                issuesBySeverity: { CRITICAL: 1, HIGH: 0, MEDIUM: 0, LOW: 0 },
                issues: [{ phase: 'System', severity: 'CRITICAL', type: 'INSPECTION_ERROR', description: error.message }]
            });
        }
    }

    const totalIssues = results.reduce((sum, r) => sum + (r.totalIssues || 0), 0);

    return {
        district: districtName,
        timestamp: new Date().toISOString(),
        addressesTested: sampleAddresses.length,
        totalIssuesFound: totalIssues,
        summary: {
            critical: results.reduce((sum, r) => sum + (r.issuesBySeverity?.CRITICAL || 0), 0),
            high: results.reduce((sum, r) => sum + (r.issuesBySeverity?.HIGH || 0), 0),
            medium: results.reduce((sum, r) => sum + (r.issuesBySeverity?.MEDIUM || 0), 0),
            low: results.reduce((sum, r) => sum + (r.issuesBySeverity?.LOW || 0), 0)
        },
        pipelineHealth: pipelineHealth.length === 0 ? 'ALL_HEALTHY' : `${pipelineHealth.length}건 이상`,
        results
    };
}


// ─────────────────────────────────────────────
// Phase 2: 보고서 완결성 검증
// ─────────────────────────────────────────────

function validateReportCompleteness(result) {
    const issues = [];
    const { analysis, aiComments, transitInfo, demographics, seoulData, realEstateData } = result;

    // 핵심 분석 데이터
    if (!analysis || analysis.totalStores === 0) {
        issues.push({ phase: 'Phase 2: 보고서 완결성', severity: 'CRITICAL', type: 'NO_STORE_DATA', description: '업소 데이터가 0건 — 보고서 생성 불가', suggestion: '좌표 또는 공공데이터 API 확인' });
        return issues; // 나머지 검증 무의미
    }

    if (typeof analysis.overallScore !== 'number' || analysis.overallScore < 0 || analysis.overallScore > 100) {
        issues.push({ phase: 'Phase 2: 보고서 완결성', severity: 'HIGH', type: 'INVALID_SCORE', description: `종합점수 비정상: ${analysis.overallScore}`, suggestion: 'analyzer.js 점수 산출 로직 점검' });
    }

    if (!analysis.grade || !['S', 'A', 'B', 'C', 'D', 'F'].includes(analysis.grade.grade)) {
        issues.push({ phase: 'Phase 2: 보고서 완결성', severity: 'HIGH', type: 'INVALID_GRADE', description: `등급 비정상: ${analysis.grade?.grade}`, suggestion: 'analyzer.js 등급 매핑 점검' });
    }

    if (!Array.isArray(analysis.categorySummary) || analysis.categorySummary.length === 0) {
        issues.push({ phase: 'Phase 2: 보고서 완결성', severity: 'HIGH', type: 'EMPTY_CATEGORIES', description: '업종 분류 요약이 비어있음', suggestion: 'getCategorySummary 로직 점검' });
    }

    // 6대 지표 검증
    const indicators = analysis.indicators || {};
    const expectedIndicators = ['diversityIndex', 'saturationScore', 'competitionIntensity', 'franchiseScore', 'densityScore', 'stabilityScore'];
    const missingIndicators = expectedIndicators.filter(k => !indicators[k] || typeof indicators[k].value !== 'number');
    if (missingIndicators.length > 0) {
        issues.push({ phase: 'Phase 2: 보고서 완결성', severity: 'HIGH', type: 'MISSING_INDICATORS', description: `6대 지표 중 ${missingIndicators.length}개 누락: ${missingIndicators.join(', ')}`, suggestion: 'analyzer.js 지표 산출 로직 점검' });
    }

    // AI 코멘트
    if (!aiComments || !aiComments.overview) {
        issues.push({ phase: 'Phase 2: 보고서 완결성', severity: 'HIGH', type: 'NO_AI_COMMENT', description: 'AI 코멘트가 생성되지 않음', suggestion: 'aiConsultant.js 또는 Gemini API 키 확인' });
    } else {
        if (aiComments.overview.length < 100) {
            issues.push({ phase: 'Phase 2: 보고서 완결성', severity: 'MEDIUM', type: 'SHORT_AI_COMMENT', description: `AI 코멘트가 너무 짧음 (${aiComments.overview.length}자)`, suggestion: '프롬프트 또는 폴백 로직 점검' });
        }
        if (!Array.isArray(aiComments.strengths) || aiComments.strengths.length === 0) {
            issues.push({ phase: 'Phase 2: 보고서 완결성', severity: 'MEDIUM', type: 'NO_STRENGTHS', description: 'AI 코멘트 강점 항목 비어있음' });
        }
        if (!Array.isArray(aiComments.weaknesses) || aiComments.weaknesses.length === 0) {
            issues.push({ phase: 'Phase 2: 보고서 완결성', severity: 'MEDIUM', type: 'NO_WEAKNESSES', description: 'AI 코멘트 약점 항목 비어있음' });
        }
    }

    // 프리미엄 데이터
    if (!transitInfo) {
        issues.push({ phase: 'Phase 2: 보고서 완결성', severity: 'MEDIUM', type: 'NO_TRANSIT', description: '교통 접근성 데이터 누락' });
    }
    if (!demographics) {
        issues.push({ phase: 'Phase 2: 보고서 완결성', severity: 'MEDIUM', type: 'NO_DEMOGRAPHICS', description: '인구통계 데이터 누락' });
    }
    if (!seoulData) {
        issues.push({ phase: 'Phase 2: 보고서 완결성', severity: 'LOW', type: 'NO_SEOUL_DATA', description: '서울시 매출/증감 데이터 누락 (서울 외 지역이면 정상)' });
    }
    if (!realEstateData) {
        issues.push({ phase: 'Phase 2: 보고서 완결성', severity: 'LOW', type: 'NO_REALESTATE', description: '부동산 실거래 데이터 누락' });
    }

    return issues;
}


// ─────────────────────────────────────────────
// Phase 3: 데이터 파이프라인 건강 진단
// ─────────────────────────────────────────────

async function checkPipelineHealth() {
    const issues = [];
    console.log('\n   🔌 Phase 3: 데이터 파이프라인 건강 진단...');

    // Geocoding API
    try {
        const loc = await geocodeAddress('서울시 강남구 역삼동 823');
        if (!loc || !loc.latitude) throw new Error('좌표 없음');
        console.log('      ✅ Geocoding API 정상');
    } catch (e) {
        issues.push({ phase: 'Phase 3: 파이프라인', severity: 'CRITICAL', type: 'GEOCODING_DOWN', description: `카카오 Geocoding API 장애: ${e.message}`, suggestion: 'KAKAO_API_KEY 확인' });
        console.log('      ❌ Geocoding API 장애');
    }

    // Gemini API
    try {
        const answer = await askGemini('테스트 메시지입니다. "OK"만 응답하세요.', null, '단순 헬스체크용 질의');
        if (!answer || answer.length === 0) throw new Error('빈 응답');
        console.log('      ✅ Gemini API 정상');
    } catch (e) {
        issues.push({ phase: 'Phase 3: 파이프라인', severity: 'HIGH', type: 'GEMINI_DOWN', description: `Gemini API 장애: ${e.message}`, suggestion: 'GEMINI_API_KEY 확인 및 할당량 점검' });
        console.log('      ❌ Gemini API 장애');
    }

    // 공공데이터 상가업소 API
    try {
        const stores = await getStoresInRadius(37.4979, 127.0276, 300); // 강남역
        if (!stores || stores.length === 0) throw new Error('데이터 0건');
        console.log(`      ✅ 공공데이터 상가업소 API 정상 (${stores.length}건)`);
    } catch (e) {
        issues.push({ phase: 'Phase 3: 파이프라인', severity: 'CRITICAL', type: 'STORE_API_DOWN', description: `공공데이터 상가업소 API 장애: ${e.message}`, suggestion: 'STORE_API_KEY 확인' });
        console.log('      ❌ 공공데이터 상가업소 API 장애');
    }

    // 교통 데이터
    try {
        const transit = await getTransitInfo(37.4979, 127.0276, 500);
        if (!transit) throw new Error('null 반환');
        console.log('      ✅ 교통 데이터 API 정상');
    } catch (e) {
        issues.push({ phase: 'Phase 3: 파이프라인', severity: 'MEDIUM', type: 'TRANSIT_API_DOWN', description: `교통 데이터 API 장애: ${e.message}` });
        console.log(`      ⚠️ 교통 데이터 API: ${e.message}`);
    }

    return issues;
}


// ─────────────────────────────────────────────
// Phase 4: AI 할루시네이션 팩트체크
// ─────────────────────────────────────────────

function factCheckAIComments(aiComments, analysis) {
    const issues = [];
    if (!aiComments || !aiComments.overview || !analysis) return issues;

    const text = `${aiComments.overview} ${aiComments.conclusion || ''}`;

    // 점수 팩트체크
    const scoreMatch = text.match(/(\d{2,3})\s*점/);
    if (scoreMatch) {
        const mentioned = parseInt(scoreMatch[1]);
        const actual = analysis.overallScore;
        if (Math.abs(mentioned - actual) > 5) {
            issues.push({
                phase: 'Phase 4: AI 팩트체크',
                severity: 'HIGH',
                type: 'HALLUCINATION_SCORE',
                description: `AI가 ${mentioned}점이라고 했으나 실제 ${actual}점 (차이: ${Math.abs(mentioned - actual)}점)`,
                suggestion: 'aiConsultant.js 프롬프트에 점수 주입 강화'
            });
        }
    }

    // 등급 팩트체크
    const gradeMatch = text.match(/([SABCDF])\s*등급/);
    if (gradeMatch) {
        const mentioned = gradeMatch[1];
        const actual = analysis.grade.grade;
        if (mentioned !== actual) {
            issues.push({
                phase: 'Phase 4: AI 팩트체크',
                severity: 'HIGH',
                type: 'HALLUCINATION_GRADE',
                description: `AI가 ${mentioned}등급이라고 했으나 실제 ${actual}등급`,
                suggestion: 'aiConsultant.js 프롬프트에 등급 주입 강화'
            });
        }
    }

    // 업소 수 팩트체크
    const storeMatch = text.match(/(\d{2,4})\s*개?\s*(업소|상점|가게|매장)/);
    if (storeMatch) {
        const mentioned = parseInt(storeMatch[1]);
        const actual = analysis.totalStores;
        const diff = Math.abs(mentioned - actual) / Math.max(actual, 1);
        if (diff > 0.15) { // 15% 이상 차이
            issues.push({
                phase: 'Phase 4: AI 팩트체크',
                severity: 'MEDIUM',
                type: 'HALLUCINATION_STORE_COUNT',
                description: `AI가 업소 ${mentioned}개라고 했으나 실제 ${actual}개 (${(diff * 100).toFixed(0)}% 차이)`,
                suggestion: 'aiConsultant.js 프롬프트에 업소 수 명시'
            });
        }
    }

    return issues;
}


// ─────────────────────────────────────────────
// Phase 5: 성능 모니터링
// ─────────────────────────────────────────────

function checkPerformance(elapsedSeconds, address) {
    const issues = [];

    if (elapsedSeconds > 20) {
        issues.push({
            phase: 'Phase 5: 성능',
            severity: 'HIGH',
            type: 'SLOW_RESPONSE',
            description: `분석 응답 ${elapsedSeconds.toFixed(1)}초 (기준: 20초 이내) — ${address}`,
            suggestion: '병렬 API 호출 최적화 또는 타임아웃 설정 점검'
        });
    } else if (elapsedSeconds > 15) {
        issues.push({
            phase: 'Phase 5: 성능',
            severity: 'MEDIUM',
            type: 'SLOW_RESPONSE_WARNING',
            description: `분석 응답 ${elapsedSeconds.toFixed(1)}초 (권장: 15초 이내) — ${address}`,
            suggestion: '성능 최적화 권장'
        });
    }

    return issues;
}

// ─────────────────────────────────────────────
// Phase 6: 논리적 모순 및 이상치 탐지 (Data Anomaly)
// ─────────────────────────────────────────────

function checkDataAnomaly(result, targetCategory) {
    const issues = [];
    const { analysis, demographics } = result;
    if (!analysis) return issues;

    // 1. 타겟 업종 매칭 확인
    if (analysis.categorySummary && targetCategory) {
        // 상위 5대 업종 안에 타겟 카테고리가 없는 경우 의심
        const top5 = analysis.categorySummary.slice(0, 5).map(c => c.name);
        if (!top5.includes(targetCategory) && analysis.totalStores > 50) {
            issues.push({
                phase: 'Phase 6: 데이터 정합성',
                severity: 'WARNING',
                type: 'TARGET_CATEGORY_MISSING',
                description: `분석 타겟 '${targetCategory}'가 상위 5대 업종에 포함되지 않습니다. (총 업소 ${analysis.totalStores}개 중 비중이 극히 낮음)`,
                suggestion: '상권 성격 불일치 의심. AI 코멘트가 이 점을 타당하게 설명하는지 확인 필요'
            });
        }
    }

    // 2. 인구통계 vs 상가 수 비율 검증
    if (demographics && demographics.totalPop !== undefined) {
        const popPerStore = demographics.totalPop / (analysis.totalStores || 1);
        // 업소당 배후 인구가 10명 미만이거나 수천 명 이상이면 비정상
        if (analysis.totalStores > 100 && popPerStore < 5) {
            issues.push({
                phase: 'Phase 6: 데이터 정합성',
                severity: 'HIGH',
                type: 'POPULATION_ANOMALY_LOW',
                description: `상가 ${analysis.totalStores}개 대비 유동/거주 인구 총합(${demographics.totalPop}명)이 비정상적으로 낮습니다.`,
                suggestion: '인구통계 데이터 API 장애 또는 연산 단위 오류 점검'
            });
        }
    }

    // 3. S등급 조건 모순 검사
    if (analysis.grade && analysis.grade.grade === 'S') {
        const density = analysis.indicators?.densityScore?.value || 0;
        const stores = analysis.totalStores || 0;
        if (density < 20 || stores < 30) {
            issues.push({
                phase: 'Phase 6: 데이터 정합성',
                severity: 'HIGH',
                type: 'S_GRADE_ANOMALY',
                description: `상가(${stores}개) 및 밀집도(${density}점)가 저조함에도 S등급이 산출되었습니다.`,
                suggestion: 'analyzer.js의 가중치 및 등급 산출 로직(Threshold) 전면 점검 요망'
            });
        }
    }

    return issues;
}


// ─────────────────────────────────────────────
// Phase 7: AI 인사이트 퀄리티 딥체크 (Insight Quality)
// ─────────────────────────────────────────────

function checkAIQuality(result, targetCategory) {
    const issues = [];
    const { aiComments } = result;
    if (!aiComments || !aiComments.strengths || !aiComments.weaknesses) return issues;

    const fullText = [
        ...(aiComments.strengths || []), 
        ...(aiComments.weaknesses || []), 
        aiComments.overview || ''
    ].join(' ');

    // 1. 구체적 명사/수치 사용 빈도 (%, 점, 개, 명 등의 정량적 숫자 포함 여부)
    const numberMatches = fullText.match(/\d+(점|개|명|%|만|천)/g);
    if (!numberMatches || numberMatches.length < 2) {
        issues.push({
            phase: 'Phase 7: AI 품질 심층체크',
            severity: 'MEDIUM',
            type: 'POOR_AI_INSIGHT_GENERALITY',
            description: 'AI 코멘트에 수치적 근거(%, 개, 명 등)가 2회 미만 등장합니다. (일반론적인 뻔한 조언일 확률 높음)',
            suggestion: '프롬프트에 구체적 수치 데이터를 반드시 텍스트에 녹여내도록 지시 강화'
        });
    }

    // 2. 타겟 업종 맥락 유지 여부
    if (targetCategory && !fullText.includes(targetCategory)) {
        issues.push({
            phase: 'Phase 7: AI 품질 심층체크',
            severity: 'HIGH',
            type: 'TARGET_CATEGORY_OMITTED_BY_AI',
            description: `의뢰받은 타겟 업종 '${targetCategory}' 단어가 AI 분석 코멘트에 단 한 번도 언급되지 않았습니다.`,
            suggestion: '상권 일반 분석만 수행하고 타겟팅 분석(Personalization)이 실패함. 프롬프트 구조화 필요'
        });
    }

    return issues;
}


// ─────────────────────────────────────────────
// Phase 8: 프리미엄 데이터 정합성 검사 (Premium Data Validation)
// ─────────────────────────────────────────────

function checkPremiumDataValidation(result) {
    const issues = [];
    const { realEstateData, transitInfo } = result;

    // 1. 부동산 임대료 정상 범위 엣지 케이스 (0원이나 너무 낮은 값 터지는 것 방지)
    if (realEstateData && realEstateData.avgRent) {
        if (realEstateData.avgRent < 10000) { // 평당 1만원 미만 (비상식적)
            issues.push({
                phase: 'Phase 8: 프리미엄 데이터',
                severity: 'HIGH',
                type: 'ABNORMAL_RENT_VALUE',
                description: `평당 임대료 추정치가 비상식적으로 낮습니다: ${realEstateData.avgRent.toLocaleString()}원/평`,
                suggestion: '실거래 데이터 파싱 중 단위(만원 vs 원) 오류 또는 결측치(0원) 필터링 실패 점검'
            });
        }
    }

    // 2. 대중교통 커버리지 한계 및 패널티 작동 확인
    if (transitInfo && typeof transitInfo.score === 'number') {
        const totalNodes = (transitInfo.subwayNodes || 0) + (transitInfo.busNodes || 0);
        if (totalNodes <= 3 && transitInfo.score > 70) {
            issues.push({
                phase: 'Phase 8: 프리미엄 데이터',
                severity: 'WARNING',
                type: 'TRANSIT_SCORE_MISMATCH',
                description: `정류장/역이 3개 이하(${totalNodes}개)인 대중교통 소외지역임에도 교통 접근성 점수가 ${transitInfo.score}점으로 너무 관대합니다.`,
                suggestion: 'getTransitInfo 스코어링 함수 패널티 로직 점검'
            });
        }
    }

    return issues;
}
