/**
 * 교통 접근성 분석 서비스
 * 카카오 로컬 API를 사용하여 지하철역/버스정류장 검색
 */

/**
 * 반경 내 대중교통 시설 검색 및 접근성 점수 산출
 */
export async function getTransitInfo(lat, lng, radius = 500) {
    const KAKAO_API_KEY = process.env.KAKAO_API_KEY;
    if (!KAKAO_API_KEY) {
        throw new Error('KAKAO_API_KEY가 설정되지 않았습니다.');
    }

    const headers = { 'Authorization': `KakaoAK ${KAKAO_API_KEY}` };
    const searchRadius = Math.max(radius, 1000); // 최소 1km 반경으로 대중교통 검색

    // 1. 지하철역 검색 (category_group_code: SW8)
    const subwayUrl = `https://dapi.kakao.com/v2/local/search/category.json?category_group_code=SW8&x=${lng}&y=${lat}&radius=${searchRadius}&sort=distance&size=15`;
    
    // 2. 버스정류장 검색 (키워드)
    const busUrl = `https://dapi.kakao.com/v2/local/search/keyword.json?query=버스정류장&x=${lng}&y=${lat}&radius=${searchRadius}&sort=distance&size=15`;

    const [subwayRes, busRes] = await Promise.all([
        fetch(subwayUrl, { headers }).then(r => r.json()).catch(() => ({ documents: [] })),
        fetch(busUrl, { headers }).then(r => r.json()).catch(() => ({ documents: [] }))
    ]);

    const subways = (subwayRes.documents || []).map(doc => ({
        name: doc.place_name,
        distance: parseInt(doc.distance) || 0,
        walkMinutes: Math.round((parseInt(doc.distance) || 0) / 80), // 도보 80m/분
        lat: parseFloat(doc.y),
        lng: parseFloat(doc.x),
        url: doc.place_url || ''
    }));

    const busStops = (busRes.documents || []).map(doc => ({
        name: doc.place_name,
        distance: parseInt(doc.distance) || 0,
        walkMinutes: Math.round((parseInt(doc.distance) || 0) / 80),
        lat: parseFloat(doc.y),
        lng: parseFloat(doc.x)
    }));

    // 3. 접근성 점수 산출 (100점 만점)
    let score = 0;
    
    // 지하철 기여 (최대 50점)
    if (subways.length > 0) {
        const nearestSubway = subways[0].distance;
        if (nearestSubway <= 200) score += 50;       // 200m 이내
        else if (nearestSubway <= 500) score += 40;   // 500m 이내
        else if (nearestSubway <= 800) score += 30;   // 800m 이내
        else if (nearestSubway <= 1000) score += 20;  // 1km 이내
        else score += 10;                              // 1km 초과
        
        // 역 개수 보너스 (최대 10점)
        score += Math.min(subways.filter(s => s.distance <= 1000).length * 3, 10);
    }

    // 버스 기여 (최대 40점)
    if (busStops.length > 0) {
        const nearestBus = busStops[0].distance;
        if (nearestBus <= 100) score += 30;
        else if (nearestBus <= 300) score += 25;
        else if (nearestBus <= 500) score += 20;
        else score += 10;

        // 정류장 개수 보너스 (최대 10점)
        score += Math.min(busStops.filter(b => b.distance <= 500).length * 2, 10);
    }

    score = Math.min(score, 100);

    let grade = 'D';
    let gradeLabel = '접근성 부족';
    let gradeColor = '#ef4444';
    if (score >= 80) { grade = 'A'; gradeLabel = '최상급 접근성'; gradeColor = '#10b981'; }
    else if (score >= 60) { grade = 'B'; gradeLabel = '양호한 접근성'; gradeColor = '#3b82f6'; }
    else if (score >= 40) { grade = 'C'; gradeLabel = '보통 접근성'; gradeColor = '#f59e0b'; }

    return {
        score,
        grade,
        gradeLabel,
        gradeColor,
        subways: subways.slice(0, 5),  // 상위 5개만
        busStops: busStops.slice(0, 8), // 상위 8개만
        totalSubways: subways.filter(s => s.distance <= searchRadius).length,
        totalBusStops: busStops.filter(b => b.distance <= searchRadius).length,
        nearestSubway: subways[0] || null,
        nearestBus: busStops[0] || null
    };
}
