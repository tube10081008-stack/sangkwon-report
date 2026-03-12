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

export async function getDemographics(lat, lng, location, stores = []) {
    // 이제 서울시 실측 데이터(통신/카드)는 seoulData.js에서 전담하고 화면의 '서울시 상권분석' 패널에 표시됩니다.
    // 기존 DemographicsPanel(배후세대 인구분석)은 업종 비율 기반의 '추정/시뮬레이션' 기능을 전담하도록 분리합니다.
    return simulateDemographics(stores, location);
}
