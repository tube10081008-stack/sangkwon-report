/**
 * 카카오 Geocoding 서비스
 * 주소 → 좌표(위도/경도) 변환 및 행정구역 정보 추출
 */

export async function geocodeAddress(address) {
    const KAKAO_API_KEY = process.env.KAKAO_API_KEY;
    if (!KAKAO_API_KEY) {
        throw new Error('KAKAO_API_KEY가 설정되지 않았습니다. .env 파일을 확인하세요.');
    }

    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}&analyze_type=similar`;

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
        return await keywordSearch(address);
    }

    const doc = data.documents[0];
    const result = {
        address: doc.address_name || address,
        roadAddress: doc.road_address ? doc.road_address.address_name : null,
        latitude: parseFloat(doc.y),
        longitude: parseFloat(doc.x),
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
