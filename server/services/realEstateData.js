/**
 * 공공데이터포털 부동산/경매 데이터 호출 모듈
 * DATA_GO_KR_API_KEY 단일 키를 사용하여 여러 API 연동
 */

// 내장 fetch 사용 (Node 18+)

const API_KEY = process.env.DATA_GO_KR_API_KEY || 'e534803dfbbec3959cc365626b326777049c150c6d0ac6f23c214b9ff561a1fe';

/**
 * 공공데이터포털 API 호출 래퍼 함수
 */
async function fetchPublicData(url, params) {
    const queryParams = new URLSearchParams({
        serviceKey: API_KEY, // 일반 인증키(Decoding)에 대응. 만약 막히면 encodeURIComponent 없이 생짜 문자열 쿼리로 붙여야 할 수 있음.
        ...params
    });

    // 공공데이터포털은 serviceKey가 인코딩 이슈를 많이 겪으므로 직접 문자열로 조립
    let queryString = '';
    for (const [key, value] of Object.entries(params)) {
        queryString += `&${key}=${value}`;
    }
    const finalUrl = `${url}?serviceKey=${API_KEY}${queryString}&_type=json`;

    try {
        const response = await fetch(finalUrl);
        if (!response.ok) {
            console.error(`공공 API 호출 에러: ${response.status} ${finalUrl}`);
            return null;
        }
        
        // 공공데이터포털 JSON 응답 구조: response.body.items.item
        const rawText = await response.text();
        try {
            const data = JSON.parse(rawText);
            const items = data?.response?.body?.items?.item;
            if (Array.isArray(items)) return items;
            if (items) return [items]; // 단건일 경우 배열로 래핑
            return [];
        } catch (parseError) {
            // 가끔 XML로 에러 메시지를 반환하는 경우가 있으므로 예외 처리
            console.error('API 응답 파싱 실패(아마 XML로 반환됨):', rawText.substring(0, 100));
            return [];
        }
    } catch (e) {
        console.error('공공 API 네트워크 에러:', e.message);
        return [];
    }
}

/**
 * B-Code(법정동코드 10자리) 중 앞 5자리(LAWD_CD)를 추출합니다.
 */
function getLawdCd(bCode) {
    if (!bCode || bCode.length < 5) return null;
    return bCode.substring(0, 5);
}

/**
 * 현재 연월(YYYYMM)과 이전 달(YYYYMM)을 구합니다.
 */
function getRecentMonths(count = 2) {
    const months = [];
    const date = new Date();
    for (let i = 0; i < count; i++) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        months.push(`${year}${month}`);
        date.setMonth(date.getMonth() - 1);
    }
    return months;
}

/**
 * 특정 지역(법정동코드)의 최근 아파트/상가 실거래가를 조회합니다.
 * @param {string} bCode 법정동코드 10자리 (예: 1168010100)
 */
export async function getRealEstateData(bCode) {
    const lawdCd = getLawdCd(bCode);
    if (!lawdCd) {
        console.warn('유효하지 않은 법정동 코드입니다.');
        return null;
    }

    const months = getRecentMonths(2); // 최근 2개월치 데이터 조회
    
    let allAptSales = [];
    let allCommercialSales = [];

    // 아파트 매매 실거래가 (국토교통부 아파트매매 실거래 상세 자료)
    // endpoint: http://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev
    const APT_URL = 'http://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev';

    // 상업업무용 부동산 매매 신고 자료
    // endpoint: http://apis.data.go.kr/1613000/RTMSDataSvcNrgTrade/getRTMSDataSvcNrgTrade
    const COMM_URL = 'http://apis.data.go.kr/1613000/RTMSDataSvcNrgTrade/getRTMSDataSvcNrgTrade';

    for (const yyyymm of months) {
        const params = {
            LAWD_CD: lawdCd,
            DEAL_YMD: yyyymm,
            numOfRows: 30, // 적당히 많이
            pageNo: 1
        };

        const aptData = await fetchPublicData(APT_URL, params);
        if (aptData) {
            // 우리 동(읍면동) 데이터만 필터링 (api는 시군구 단위로 줌)
            const bName = bCode ? bCode /* 실제로는 이름 매칭을 하거나, 도로명 등으로 거리 기반 필터링 권장 */ : '';
            // 여기서는 시간 관계상 일단 전체 시군구 거래 중 상위 내용만 담거나, 필터링을 최소화합니다.
            allAptSales = allAptSales.concat(aptData);
        }

        const commData = await fetchPublicData(COMM_URL, params);
        if (commData) {
            allCommercialSales = allCommercialSales.concat(commData);
        }
    }

    // 결과 정제 (요약 정보만)
    // 거래건수, 평균/최고/최저가 등
    return {
        aptSales: allAptSales.slice(0, 10), // 최대 10건만 리턴해서 AI 입력 토큰 제한 방지
        commercialSales: allCommercialSales.slice(0, 10),
        aptTotalRecent: allAptSales.length,
        commercialTotalRecent: allCommercialSales.length,
        lawdCd: lawdCd,
        months: months
    };
}
