/**
 * 카카오 Geocoding 서비스
 * 주소 → 좌표(위도/경도) 변환 및 행정구역 정보 추출
 */

/**
 * 입력 주소 사전 정규화 (주소 유효성 검증 개선)
 */
function normalizeAddress(rawAddress) {
    return rawAddress
        .trim()
        .replace(/\s{2,}/g, ' ')            // 이중 공백 제거
        .replace(/[~～]/g, '')              // 물결표 제거
        .replace(/\bO\b/g, '0')             // O → 0 오타 보정
        .replace(/\b(\d+)\s*-\s*(\d+)\b/g, '$1-$2'); // 1 - 2 → 1-2 정규화
}

export async function geocodeAddress(address) {
    const KAKAO_API_KEY = process.env.KAKAO_API_KEY;
    if (!KAKAO_API_KEY) {
        throw new Error('KAKAO_API_KEY가 설정되지 않았습니다. .env 파일을 확인하세요.');
    }

    // 입력 주소 정규화
    const normalizedAddr = normalizeAddress(address);
    console.log(`[Geocoding] 원본: "${address}" → 정규화: "${normalizedAddr}"`);

    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(normalizedAddr)}&analyze_type=similar`;

    const response = await fetch(url, {
        headers: {
            'Authorization': `KakaoAK ${KAKAO_API_KEY}`
        }
    });

    if (!response.ok) {
        throw new Error(`카카오 Geocoding API 오류: ${response.status}`);
    }

    const data = await response.json();

    if (!data.documents || data.documents.length === 0) {
        // 주소 검색 실패 시 키워드 검색 시도
        console.warn(`[Geocoding] 주소 검색 실패, 키워드 폴백: "${normalizedAddr}"`);
        return await keywordSearch(normalizedAddr);
    }

    const doc = data.documents[0];
    const lat = parseFloat(doc.y);
    const lng = parseFloat(doc.x);

    // 좌표 유효성 검증 (NaN/0 방지)
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
        console.warn(`[Geocoding] 좌표 비정상(${lat}, ${lng}), 키워드 폴백`);
        return await keywordSearch(normalizedAddr);
    }

    const result = {
        address: doc.address_name || normalizedAddr,
        roadAddress: doc.road_address ? doc.road_address.address_name : null,
        latitude: lat,
        longitude: lng,
        region1: '', // 시/도
        region2: '', // 구/군
        region3: '', // 동/읍/면
    };

    if (doc.address) {
        result.region1 = doc.address.region_1depth_name || '';
        result.region2 = doc.address.region_2depth_name || '';
        result.region3 = doc.address.region_3depth_name || '';
    } else if (doc.road_address) {
        result.region1 = doc.road_address.region_1depth_name || '';
        result.region2 = doc.road_address.region_2depth_name || '';
        result.region3 = doc.road_address.region_3depth_name || '';
    }

    // region 정보가 비어있으면 역지오코딩으로 보정
    if (!result.region2 || !result.region3) {
        try {
            const reverse = await reverseGeocode(lat, lng);
            if (reverse) {
                result.region1 = result.region1 || reverse.region1;
                result.region2 = result.region2 || reverse.region2;
                result.region3 = result.region3 || reverse.region3;
            }
        } catch (e) {
            console.warn('[Geocoding] 역지오코딩 보정 실패:', e.message);
        }
    }

    return result;
}

async function keywordSearch(query) {
    const KAKAO_API_KEY = process.env.KAKAO_API_KEY;
    const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}`;

    const response = await fetch(url, {
        headers: {
            'Authorization': `KakaoAK ${KAKAO_API_KEY}`
        }
    });

    if (!response.ok) {
        throw new Error(`카카오 키워드 검색 API 오류: ${response.status}`);
    }

    const data = await response.json();

    if (!data.documents || data.documents.length === 0) {
        throw new Error('해당 주소를 찾을 수 없습니다. 정확한 도로명 또는 지번 주소를 입력해주세요.');
    }

    const doc = data.documents[0];

    return {
        address: doc.address_name || query,
        roadAddress: doc.road_address_name || null,
        latitude: parseFloat(doc.y),
        longitude: parseFloat(doc.x),
        region1: '',
        region2: '',
        region3: '',
        placeName: doc.place_name || ''
    };
}

export async function reverseGeocode(lat, lng) {
    const KAKAO_API_KEY = process.env.KAKAO_API_KEY;
    const url = `https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?x=${lng}&y=${lat}`;

    const response = await fetch(url, {
        headers: {
            'Authorization': `KakaoAK ${KAKAO_API_KEY}`
        }
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.documents || data.documents.length === 0) return null;

    const doc = data.documents[0];
    return {
        region1: doc.region_1depth_name,
        region2: doc.region_2depth_name,
        region3: doc.region_3depth_name,
        code: doc.code
    };
}
