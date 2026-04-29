/**
 * 교통 접근성 분석 서비스
 * 카카오 로컬 API(지하철) + OpenStreetMap Overpass API(버스정류장) 사용
 */

/** 두 좌표 사이 거리(m) 계산 (Haversine) */
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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

    // 1. 지하철역 검색 (카카오 category_group_code: SW8)
    const subwayUrl = `https://dapi.kakao.com/v2/local/search/category.json?category_group_code=SW8&x=${lng}&y=${lat}&radius=${searchRadius}&sort=distance&size=15`;
    
    // 2. 버스정류장 검색 — Overpass API (미러 순환) + 재시도
    //    ⚠️ 카카오 API에는 버스정류장 카테고리가 없음 (SW8=지하철만 지원)
    //    Overpass가 유일한 무료 버스정류장 데이터소스 → 미러 3개 순환으로 안정성 확보
    const overpassQuery = `[out:json][timeout:15];(node[highway=bus_stop](around:${searchRadius},${lat},${lng});node["public_transport"="platform"]["bus"="yes"](around:${searchRadius},${lat},${lng}););out body;`;
    const overpassMirrors = [
        'https://overpass-api.de/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter',
        'https://z.overpass-api.de/api/interpreter'
    ];

    const fetchOverpass = async (attempt = 1) => {
        const mirrorUrl = overpassMirrors[(attempt - 1) % overpassMirrors.length];
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 12000);
            
            const r = await fetch(mirrorUrl, { 
                method: 'POST', 
                body: 'data=' + encodeURIComponent(overpassQuery), 
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            const text = await r.text();
            if (text.startsWith('<') || !text.includes('elements')) {
                if (attempt < overpassMirrors.length) {
                    console.warn(`[Transit] Overpass 비정상 응답 (${mirrorUrl}), 다음 미러로 재시도...`);
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    return fetchOverpass(attempt + 1);
                }
                return [];
            }
            const data = JSON.parse(text);
            return (data.elements || []).map(el => {
                const dist = haversineDistance(lat, lng, el.lat, el.lon);
                return {
                    name: el.tags?.name || el.tags?.['name:ko'] || '버스정류장',
                    distance: Math.round(dist),
                    walkMinutes: Math.round(dist / 80),
                    lat: el.lat,
                    lng: el.lon
                };
            }).sort((a, b) => a.distance - b.distance);
        } catch (e) {
            if (attempt < overpassMirrors.length) {
                console.warn(`[Transit] Overpass 실패 (${mirrorUrl}): ${e.message}, 다음 미러로...`);
                await new Promise(resolve => setTimeout(resolve, 1500));
                return fetchOverpass(attempt + 1);
            }
            console.warn(`[Transit] Overpass 전체 미러 실패: ${e.message}`);
            return [];
        }
    };

    // ── 병렬 호출 (지하철: 카카오 / 버스: Overpass) ──
    const [subwayRes, busStopsRaw] = await Promise.all([
        fetch(subwayUrl, { headers }).then(r => r.json()).catch(() => ({ documents: [] })),
        fetchOverpass()
    ]);

    const subways = (subwayRes.documents || []).map(doc => ({
        name: doc.place_name,
        distance: parseInt(doc.distance) || 0,
        walkMinutes: Math.round((parseInt(doc.distance) || 0) / 80),
        lat: parseFloat(doc.y),
        lng: parseFloat(doc.x),
        url: doc.place_url || ''
    }));

    let busStops = busStopsRaw;
    let busDataSource = busStops.length > 0 ? 'overpass' : 'none';

    if (busStops.length === 0) {
        console.warn(`[Transit] 버스정류장 0건 (${lat}, ${lng}) — Overpass 2회 시도 실패`);
    }

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

    // [QA V2.1 개선안] 대중교통 소외지역 패널티 (지하철역 + 버스정류장 합산 3개 이하 시 치명타)
    const totalNodesCount = subways.length + busStops.length;
    if (totalNodesCount <= 3) {
        score = Math.min(score, 50); // 무조건 50점 이하로 강제 (최상급, 양호 불가)
    } else if (totalNodesCount <= 5) {
        score = Math.min(score, 75); // 무조건 75점 이하로 강제 (최상급 불가)
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
        busStopCount: busStops.length,
        busDataSource,
        nearestSubway: subways[0] || null,
        nearestBus: busStops[0] || null,
        nearestStation: subways[0]?.name || null,
        stationDistance: subways[0]?.distance || null,
        walkabilityScore: score
    };
}
