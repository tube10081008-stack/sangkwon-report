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
    
    // 2. 버스정류장 검색
    //    Primary: 서울시 공공 버스정류소 API (ws.bus.go.kr — data.go.kr 키 사용)
    //    Fallback: Overpass API (미러 순환)
    const BUS_API_KEY = process.env.STORE_API_KEY; // data.go.kr 공용 키

    /** Primary: 서울시 좌표기반 근접 정류소 목록 조회 */
    const fetchSeoulBus = async () => {
        if (!BUS_API_KEY) return [];
        try {
            const busApiUrl = `http://ws.bus.go.kr/api/rest/stationinfo/getStationByPos?serviceKey=${encodeURIComponent(BUS_API_KEY)}&tmX=${lng}&tmY=${lat}&radius=${searchRadius}&resultType=json`;
            const r = await fetch(busApiUrl, { signal: AbortSignal.timeout(8000) });
            const data = await r.json();
            
            // 키 인증 실패 체크
            if (data.msgHeader?.headerCd === '7' || data.msgHeader?.headerCd === 7) {
                console.warn('[Transit] 서울시 버스 API 키 인증 실패 — Overpass 폴백 전환');
                return [];
            }
            
            const items = data.msgBody?.itemList || [];
            if (items.length === 0) return [];
            
            console.log(`[Transit] 서울시 버스 API 성공: ${items.length}개 정류소`);
            return items.map(item => {
                const dist = haversineDistance(lat, lng, parseFloat(item.gpsY), parseFloat(item.gpsX));
                return {
                    name: item.stNm || '버스정류장',
                    distance: Math.round(dist),
                    walkMinutes: Math.round(dist / 80),
                    lat: parseFloat(item.gpsY),
                    lng: parseFloat(item.gpsX),
                    arsId: item.arsId || null,  // 정류소 고유번호
                    stId: item.stId || null     // 정류소 ID
                };
            }).sort((a, b) => a.distance - b.distance);
        } catch (e) {
            console.warn('[Transit] 서울시 버스 API 실패:', e.message);
            return [];
        }
    };

    /** Fallback: Overpass (미러 순환) */
    const overpassQuery = `[out:json][timeout:15];(node[highway=bus_stop](around:${searchRadius},${lat},${lng});node["public_transport"="platform"]["bus"="yes"](around:${searchRadius},${lat},${lng}););out body;`;
    const overpassMirrors = [
        'https://overpass-api.de/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter',
        'https://z.overpass-api.de/api/interpreter'
    ];

    const fetchOverpass = async (attempt = 1) => {
        const mirrorUrl = overpassMirrors[(attempt - 1) % overpassMirrors.length];
        try {
            const r = await fetch(mirrorUrl, { 
                method: 'POST', 
                body: 'data=' + encodeURIComponent(overpassQuery), 
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                signal: AbortSignal.timeout(12000)
            });
            const text = await r.text();
            if (text.startsWith('<') || !text.includes('elements')) {
                if (attempt < overpassMirrors.length) {
                    console.warn(`[Transit] Overpass 비정상 응답 (${mirrorUrl}), 다음 미러로...`);
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
                await new Promise(resolve => setTimeout(resolve, 1500));
                return fetchOverpass(attempt + 1);
            }
            console.warn(`[Transit] Overpass 전체 미러 실패: ${e.message}`);
            return [];
        }
    };

    // ── 병렬 호출 (지하철: 카카오 / 버스: 서울시 API Primary) ──
    const [subwayRes, seoulBusResult] = await Promise.all([
        fetch(subwayUrl, { headers }).then(r => r.json()).catch(() => ({ documents: [] })),
        fetchSeoulBus()
    ]);
    
    // 서울시 API 실패 시 Overpass 폴백
    let busStopsRaw = seoulBusResult;
    let busDataSource = seoulBusResult.length > 0 ? 'seoul_api' : null;
    if (busStopsRaw.length === 0) {
        busStopsRaw = await fetchOverpass();
        busDataSource = busStopsRaw.length > 0 ? 'overpass' : 'none';
    }

    const subways = (subwayRes.documents || []).map(doc => ({
        name: doc.place_name,
        distance: parseInt(doc.distance) || 0,
        walkMinutes: Math.round((parseInt(doc.distance) || 0) / 80),
        lat: parseFloat(doc.y),
        lng: parseFloat(doc.x),
        url: doc.place_url || ''
    }));

    let busStops = busStopsRaw;

    if (busStops.length === 0) {
        console.warn(`[Transit] 버스정류장 0건 (${lat}, ${lng}) — 서울시 API + Overpass 모두 실패`);
    }

    // 3. 접근성 점수 산출 (100점 만점)
    // [P1] 지하철 + 버스 합산 0건이면 "데이터 수집 실패"로 판단 → null 반환
    if (subways.length === 0 && busStops.length === 0) {
        console.warn(`[Transit] 지하철 + 버스 모두 0건 (${lat}, ${lng}) — 데이터 미측정 처리`);
        return {
            score: null,
            grade: null,
            gradeLabel: '데이터 미측정',
            gradeColor: '#94a3b8',
            subways: [],
            busStops: [],
            totalSubways: 0,
            totalBusStops: 0,
            busStopCount: 0,
            busDataSource: 'none',
            nearestSubway: null,
            nearestBus: null,
            nearestStation: null,
            stationDistance: null,
            walkabilityScore: null,
            dataUnavailable: true
        };
    }

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
        walkabilityScore: score,
        dataUnavailable: false
    };
}
