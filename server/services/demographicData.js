/**
 * 배후세대 인구통계 분석 서비스
 * 서울시 열린데이터 API + 전국 시뮬레이션
 */

/**
 * 서울시 상권 코드 조회 (행정동 코드 → 상권 코드)
 */
async function getSeoulTrdarCd(dongCode, apiKey) {
    try {
        const url = `http://openapi.seoul.go.kr:8088/${apiKey}/json/VwsmTrdarSelng/1/1/`;
        const res = await fetch(url);
        const data = await res.json();
        return data;
    } catch (e) {
        return null;
    }
}

/**
 * 서울시 유동인구 조회
 */
async function getSeoulFloatingPop(apiKey) {
    try {
        const url = `http://openapi.seoul.go.kr:8088/${apiKey}/json/VwsmTrdarFlpopQq/1/5/`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        return data?.VwsmTrdarFlpopQq?.row || null;
    } catch (e) {
        console.error('서울시 유동인구 API 오류:', e.message);
        return null;
    }
}

/**
 * 서울시 거주인구 조회
 */
async function getSeoulResidentPop(apiKey) {
    try {
        const url = `http://openapi.seoul.go.kr:8088/${apiKey}/json/VwsmTrdarPopltnQq/1/5/`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        return data?.VwsmTrdarPopltnQq?.row || null;
    } catch (e) {
        console.error('서울시 거주인구 API 오류:', e.message);
        return null;
    }
}

/**
 * 서울시 직장인구 조회
 */
async function getSeoulWorkingPop(apiKey) {
    try {
        const url = `http://openapi.seoul.go.kr:8088/${apiKey}/json/VwsmTrdarWrkPopltnQq/1/5/`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        return data?.VwsmTrdarWrkPopltnQq?.row || null;
    } catch (e) {
        console.error('서울시 직장인구 API 오류:', e.message);
        return null;
    }
}

/**
 * 업종 데이터 기반 인구 특성 시뮬레이션 (전국 대응)
 * 업종 분포를 통해 배후 세대 특성을 추정합니다.
 */
function simulateDemographics(stores, location) {
    const totalStores = stores.length || 1;
    
    // 업종별 카운트
    const categories = {};
    stores.forEach(s => {
        const cat = s.categoryL || s.indsLclsNm || '기타';
        categories[cat] = (categories[cat] || 0) + 1;
    });

    // 업종 비율 기반 인구 특성 추정
    const foodRatio = ((categories['음식'] || 0) + (categories['음식점'] || 0)) / totalStores;
    const retailRatio = ((categories['소매'] || 0) + (categories['소매업'] || 0)) / totalStores;
    const serviceRatio = ((categories['생활서비스'] || 0) + (categories['수리·개인'] || 0)) / totalStores;
    const officeRatio = ((categories['일반사업·사무'] || 0) + (categories['과학·기술'] || 0)) / totalStores;
    
    // 인구 규모 추정 (업소 수 기반 근사치)
    const estimatedFloat = Math.round(totalStores * 45 + Math.random() * 2000); // 유동인구
    const estimatedWork = Math.round(totalStores * 12 + officeRatio * 5000);  // 직장인구
    const estimatedResident = Math.round(totalStores * 8 + retailRatio * 3000); // 거주인구

    // 연령대 분포 추정
    const ageDistribution = {
        '10대': Math.round(5 + Math.random() * 5),
        '20대': Math.round(15 + foodRatio * 20),
        '30대': Math.round(20 + officeRatio * 15),
        '40대': Math.round(22 + retailRatio * 10),
        '50대': Math.round(18 + serviceRatio * 10),
        '60대 이상': Math.round(10 + serviceRatio * 8),
    };
    // 비율 정규화 (합이 100%)
    const ageTotal = Object.values(ageDistribution).reduce((a, b) => a + b, 0);
    Object.keys(ageDistribution).forEach(k => {
        ageDistribution[k] = Math.round((ageDistribution[k] / ageTotal) * 100);
    });

    // 성별 비율
    const maleRatio = Math.round(48 + officeRatio * 8 - foodRatio * 2);
    const femaleRatio = 100 - maleRatio;

    // 시간대별 유동인구 패턴 (24시간)
    const hourlyPattern = [];
    const basePattern = [5, 3, 2, 2, 2, 4, 10, 25, 45, 55, 60, 65, 80, 75, 65, 60, 65, 75, 85, 90, 100, 80, 50, 20];
    for (let h = 0; h < 24; h++) {
        const officeWeight = officeRatio > 0.15 ? (h >= 8 && h <= 18 ? 1.3 : 0.7) : 1;
        const foodWeight = foodRatio > 0.3 ? (h >= 11 && h <= 13 || h >= 17 && h <= 21 ? 1.4 : 0.8) : 1;
        hourlyPattern.push({
            hour: h,
            label: `${h.toString().padStart(2, '0')}시`,
            value: Math.round(basePattern[h] * officeWeight * foodWeight)
        });
    }

    // 1인 가구 비율 추정
    const singleHouseholdRatio = Math.round(25 + foodRatio * 20 + (1 - retailRatio) * 10);

    return {
        source: 'simulation',
        sourceLabel: '업종데이터 기반 추정치',
        floatingPop: estimatedFloat,
        workingPop: estimatedWork,
        residentPop: estimatedResident,
        totalPop: estimatedFloat + estimatedWork + estimatedResident,
        ageDistribution,
        genderRatio: { male: maleRatio, female: femaleRatio },
        hourlyPattern,
        singleHouseholdRatio: Math.min(singleHouseholdRatio, 65),
        householdCount: Math.round(estimatedResident / 2.3), // 평균 가구원수 2.3명
        characteristics: generateCharacteristics(foodRatio, retailRatio, officeRatio, serviceRatio)
    };
}

/**
 * 상권 특성 문구 생성
 */
function generateCharacteristics(foodRatio, retailRatio, officeRatio, serviceRatio) {
    const chars = [];
    if (officeRatio >= 0.2) chars.push('🏢 오피스 밀집 지역 (직장인 수요 높음)');
    if (foodRatio >= 0.35) chars.push('🍽️ 외식업 중심 상권 (점심/저녁 피크 예상)');
    if (retailRatio >= 0.25) chars.push('🛒 소매 중심 주거밀착형 상권');
    if (serviceRatio >= 0.15) chars.push('💈 생활서비스 밀집 (거주인구 기반)');
    if (foodRatio < 0.2 && officeRatio < 0.1) chars.push('🏘️ 주거 비중이 높은 조용한 상권');
    if (chars.length === 0) chars.push('📊 복합형 상권 (다양한 업종 분포)');
    return chars;
}

/**
 * 메인 인구통계 분석 함수
 */
export async function getDemographics(lat, lng, location, stores = []) {
    const isSeoul = (location.region1 || '').includes('서울');
    
    if (isSeoul) {
        // 서울시 실데이터 시도
        const apiKey = process.env.SEOUL_API_KEY_1;
        if (apiKey) {
            try {
                const [floating, resident, working] = await Promise.all([
                    getSeoulFloatingPop(apiKey),
                    getSeoulResidentPop(apiKey),
                    getSeoulWorkingPop(apiKey)
                ]);

                if (floating || resident || working) {
                    // 서울시 데이터가 있으면 파싱하여 반환
                    const parsed = parseSeoulData(floating, resident, working);
                    if (parsed) return parsed;
                }
            } catch (e) {
                console.warn('서울시 API 호출 실패, 시뮬레이션으로 전환:', e.message);
            }
        }
    }

    // 전국 / 서울 API 실패 시: 시뮬레이션 데이터
    return simulateDemographics(stores, location);
}

/**
 * 서울시 API 데이터 파싱
 */
function parseSeoulData(floating, resident, working) {
    try {
        if (!floating && !resident && !working) return null;

        const fp = floating?.[0] || {};
        const rp = resident?.[0] || {};
        const wp = working?.[0] || {};

        const floatingPop = parseInt(fp.TOT_FLPOP_CO || 0);
        const residentPop = parseInt(rp.TOT_POPLTN_CO || 0);
        const workingPop = parseInt(wp.TOT_WRC_POPLTN_CO || 0);

        const ageDistribution = {
            '10대': Math.round((parseInt(fp.AGRDE_10_FLPOP_CO || 0) / Math.max(floatingPop, 1)) * 100) || 8,
            '20대': Math.round((parseInt(fp.AGRDE_20_FLPOP_CO || 0) / Math.max(floatingPop, 1)) * 100) || 18,
            '30대': Math.round((parseInt(fp.AGRDE_30_FLPOP_CO || 0) / Math.max(floatingPop, 1)) * 100) || 22,
            '40대': Math.round((parseInt(fp.AGRDE_40_FLPOP_CO || 0) / Math.max(floatingPop, 1)) * 100) || 20,
            '50대': Math.round((parseInt(fp.AGRDE_50_FLPOP_CO || 0) / Math.max(floatingPop, 1)) * 100) || 18,
            '60대 이상': Math.round((parseInt(fp.AGRDE_60_ABOVE_FLPOP_CO || 0) / Math.max(floatingPop, 1)) * 100) || 14,
        };

        const malePop = parseInt(fp.ML_FLPOP_CO || 0) || floatingPop * 0.52;
        const maleRatio = Math.round((malePop / Math.max(floatingPop, 1)) * 100);

        // 시간대별 유동인구
        const hourlyPattern = [];
        for (let h = 0; h < 24; h++) {
            const key = `TMZN_${(h).toString().padStart(2, '0')}_${(h + 1).toString().padStart(2, '0')}_FLPOP_CO`;
            hourlyPattern.push({
                hour: h,
                label: `${h.toString().padStart(2, '0')}시`,
                value: parseInt(fp[key] || 0)
            });
        }

        return {
            source: 'seoul_api',
            sourceLabel: '서울시 열린데이터 (실측)',
            floatingPop,
            workingPop,
            residentPop,
            totalPop: floatingPop + workingPop + residentPop,
            ageDistribution,
            genderRatio: { male: maleRatio, female: 100 - maleRatio },
            hourlyPattern: hourlyPattern.length > 0 ? hourlyPattern : undefined,
            singleHouseholdRatio: Math.round((parseInt(rp.HNPN_CO_1_POPLTN_CO || 0) / Math.max(residentPop, 1)) * 100) || 30,
            householdCount: parseInt(rp.TOT_HSHLD_CO || 0) || Math.round(residentPop / 2.3),
            characteristics: ['📊 서울시 공공데이터 기반 실측 분석']
        };
    } catch (e) {
        console.error('서울 데이터 파싱 오류:', e);
        return null;
    }
}
