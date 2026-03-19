/**
 * 공공데이터포털 부동산 데이터 다중 연동 모듈 (대규모 확장판)
 * 아파트 매매, 아파트 전월세, 상업업무용 매매, 오피스텔 매매 등 4개 API 통합 조회
 * 기간: 최근 6개월
 */

// 내장 fetch 사용 (Node 18+)

// 사용자가 Vercel 환경 변수에 입력한 마스터 키
const API_KEY = process.env.DATA_GO_KR_API_KEY || 'e534803dfbbec3959cc365626b326777049c150c6d0ac6f23c214b9ff561a1fe';

async function fetchPublicData(url, params) {
    let queryString = '';
    for (const [key, value] of Object.entries(params)) {
        queryString += `&${key}=${value}`;
    }
    const finalUrl = `${url}?serviceKey=${API_KEY}${queryString}&_type=json`;

    try {
        const response = await fetch(finalUrl);
        if (!response.ok) return [];
        const rawText = await response.text();
        const data = JSON.parse(rawText);
        const items = data?.response?.body?.items?.item;
        
        if (Array.isArray(items)) return items;
        if (items) return [items];
        return [];
    } catch (e) {
        return [];
    }
}

function getLawdCd(bCode) {
    if (!bCode || bCode.length < 5) return null;
    return bCode.substring(0, 5);
}

function getRecentMonths(count = 6) {
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

export async function getRealEstateData(bCode) {
    const lawdCd = getLawdCd(bCode);
    if (!lawdCd) return null;

    const months = getRecentMonths(6); // 최근 6개월치 데이터 조회
    
    // 4가지 핵심 부동산 API 엔드포인트
    const API_ENDPOINTS = {
        aptTrade: 'http://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade',
        aptRent: 'http://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent',
        commTrade: 'http://apis.data.go.kr/1613000/RTMSDataSvcNrgTrade/getRTMSDataSvcNrgTrade',
        offiTrade: 'http://apis.data.go.kr/1613000/RTMSDataSvcOffiTrade/getRTMSDataSvcOffiTrade'
    };

    // 타겟 법정동 이름 추출 (예: "서울특별시 강남구 역삼동" -> "역삼동")
    // 여기서는 간단히 bCode만 넘겨받았으므로 필터링 로직을 느슨하게 가져가거나 향후 고도화 가능
    // 현재는 해당 시/군/구(lawdCd) 전체 데이터 중 상위 10건씩 반환

    let allData = { aptTrade: [], aptRent: [], commTrade: [], offiTrade: [] };

    // 6개월 * 4종목 API = 24번의 호출을 병렬로 처리 (Promise.all 활용하여 딜레이 최소화)
    const fetchPromises = [];

    months.forEach(yyyymm => {
        const params = { LAWD_CD: lawdCd, DEAL_YMD: yyyymm, numOfRows: 30, pageNo: 1 };
        
        fetchPromises.push(
            fetchPublicData(API_ENDPOINTS.aptTrade, params).then(res => allData.aptTrade.push(...res)),
            fetchPublicData(API_ENDPOINTS.aptRent, params).then(res => allData.aptRent.push(...res)),
            fetchPublicData(API_ENDPOINTS.commTrade, params).then(res => allData.commTrade.push(...res)),
            fetchPublicData(API_ENDPOINTS.offiTrade, params).then(res => allData.offiTrade.push(...res))
        );
    });

    await Promise.allSettled(fetchPromises); // 병렬 요청 완료 대기

    // 데이터 정제 및 파싱 (가장 최신 거래가 앞으로 오도록 함 - 일반적으로 응답이 최근일순이 아닐 수 있음, 금액기준 정렬도 고려)
    // 여기서는 최신 정보를 위해 파싱만 깔끔하게 수행해 줌
    const parseNumber = (str) => parseInt(String(str).replace(/,/g, ''), 10) || 0;

    // 아파트 매매 파싱
    const cleanAptTrade = allData.aptTrade.map(item => ({
        name: item.aptNm || item.umdNm || '명칭없음',
        area: item.excluUseAr,
        price: item.dealAmount, // 문자열 '100,000' 형태
        priceNum: parseNumber(item.dealAmount),
        date: `${item.dealYear}.${item.dealMonth}.${item.dealDay}`,
        floor: item.floor
    })).sort((a, b) => b.priceNum - a.priceNum); // 전체 데이터 반환 (AI 컨텍스트용)

    // 아파트 전월세 파싱
    const cleanAptRent = allData.aptRent.map(item => ({
        name: item.aptNm || item.umdNm || '명칭없음',
        area: item.excluUseAr,
        deposit: item.deposit, // 보증금
        monthlyRent: item.monthlyRent, // 월세 (0이면 전세)
        date: `${item.dealYear}.${item.dealMonth}.${item.dealDay}`
    })).sort((a, b) => parseNumber(b.deposit) - parseNumber(a.deposit));

    // 상업업무용 파싱
    const cleanCommTrade = allData.commTrade.map(item => ({
        name: `${item.umdNm} ${item.jibun}`.trim() || '상가/업무용',
        type: item.buildingUse || '건물',
        area: item.buildingAr,
        price: item.dealAmount,
        priceNum: parseNumber(item.dealAmount),
        date: `${item.dealYear}.${item.dealMonth}.${item.dealDay}`
    })).sort((a, b) => b.priceNum - a.priceNum);

    // 오피스텔 매매 파싱
    const cleanOffiTrade = allData.offiTrade.map(item => ({
        name: item.offiNm || item.umdNm || '오피스텔',
        area: item.excluUseAr,
        price: item.dealAmount,
        priceNum: parseNumber(item.dealAmount),
        date: `${item.dealYear}.${item.dealMonth}.${item.dealDay}`
    })).sort((a, b) => b.priceNum - a.priceNum);

    return {
        lawdCd,
        monthsSearched: months,
        summary: {
            aptTotal6Months: allData.aptTrade.length,
            aptRentTotal6Months: allData.aptRent.length,
            commTotal6Months: allData.commTrade.length,
            offiTotal6Months: allData.offiTrade.length,
        },
        topTransactions: {
            aptTrade: cleanAptTrade,
            aptRent: cleanAptRent,
            commTrade: cleanCommTrade,
            offiTrade: cleanOffiTrade
        }
    };
}
