/**
 * 공공데이터포털 부동산 데이터 다중 연동 모듈 (대규모 확장판)
 * 아파트 매매, 아파트 전월세, 상업업무용 매매, 오피스텔 매매 등 4개 API 통합 조회
 * 기간: 최근 6개월
 */

import { geocodeAddress } from './geocoding.js'; // 좌표 변환용

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

function getDistanceFromLatLonInMeter(lat1, lng1, lat2, lng2) {
    const R = 6371e3; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lng2 - lng1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return Math.floor(R * c);
}

export async function getRealEstateData(bCode, location, radius) {
    const lawdCd = getLawdCd(bCode);
    if (!lawdCd) return null;

    const months = getRecentMonths(6);
    
    const API_ENDPOINTS = {
        aptTrade: 'http://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade',
        aptRent: 'http://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent',
        commTrade: 'http://apis.data.go.kr/1613000/RTMSDataSvcNrgTrade/getRTMSDataSvcNrgTrade',
        offiTrade: 'http://apis.data.go.kr/1613000/RTMSDataSvcOffiTrade/getRTMSDataSvcOffiTrade'
    };

    let allData = { aptTrade: [], aptRent: [], commTrade: [], offiTrade: [] };
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

    await Promise.allSettled(fetchPromises);

    const parseNumber = (str) => parseInt(String(str).replace(/,/g, ''), 10) || 0;

    let cleanAptTrade = allData.aptTrade.map(item => ({
        name: item.aptNm || item.umdNm || '명칭없음',
        area: item.excluUseAr,
        price: item.dealAmount,
        priceNum: parseNumber(item.dealAmount),
        date: `${item.dealYear}.${item.dealMonth}.${item.dealDay}`,
        floor: item.floor,
        umdNm: item.umdNm || '',
        jibun: item.jibun || ''
    }));

    let cleanAptRent = allData.aptRent.map(item => ({
        name: item.aptNm || item.umdNm || '명칭없음',
        area: item.excluUseAr,
        deposit: item.deposit,
        monthlyRent: item.monthlyRent,
        date: `${item.dealYear}.${item.dealMonth}.${item.dealDay}`,
        umdNm: item.umdNm || '',
        jibun: item.jibun || ''
    }));

    let cleanCommTrade = allData.commTrade.map(item => ({
        name: `${item.umdNm} ${item.jibun}`.trim() || '상가/업무용',
        type: item.buildingUse || '건물',
        area: item.buildingAr,
        price: item.dealAmount,
        priceNum: parseNumber(item.dealAmount),
        date: `${item.dealYear}.${item.dealMonth}.${item.dealDay}`,
        umdNm: item.umdNm || '',
        jibun: item.jibun || ''
    }));

    let cleanOffiTrade = allData.offiTrade.map(item => ({
        name: item.offiNm || item.umdNm || '오피스텔',
        area: item.excluUseAr,
        price: item.dealAmount,
        priceNum: parseNumber(item.dealAmount),
        date: `${item.dealYear}.${item.dealMonth}.${item.dealDay}`,
        umdNm: item.umdNm || '',
        jibun: item.jibun || ''
    }));

    // ====== 반경(거리) 데이터 필터링 적용 ======
    if (location && location.latitude && radius) {
        const centerLat = location.latitude;
        const centerLng = location.longitude;
        const regionPrefix = `${location.region1} ${location.region2}`.trim();
        
        const coordCache = {};
        
        const filterByDistance = async (items) => {
            const filtered = [];
            for (const item of items) {
                const addressStr = `${regionPrefix} ${item.umdNm} ${item.jibun}`.replace(/\s+/g, ' ').trim();
                
                if (!item.umdNm && !item.jibun) {
                    filtered.push(item); 
                    continue;
                }
                
                let coords = coordCache[addressStr];
                if (!coords) {
                    try {
                        const geo = await geocodeAddress(addressStr);
                        coords = { lat: geo.latitude, lng: geo.longitude };
                        coordCache[addressStr] = coords;
                    } catch (e) {
                        coords = { lat: null, lng: null };
                        coordCache[addressStr] = coords;
                    }
                }
                
                if (coords.lat !== null && coords.lng !== null) {
                    const dist = getDistanceFromLatLonInMeter(centerLat, centerLng, coords.lat, coords.lng);
                    if (dist <= radius) {
                        filtered.push(item);
                    }
                } else {
                    filtered.push(item); // 지오코딩 실패 시 데이터 누락 방지를 위해 남김
                }
            }
            return filtered;
        };

        try {
            cleanAptTrade = await filterByDistance(cleanAptTrade);
            cleanAptRent = await filterByDistance(cleanAptRent);
            cleanCommTrade = await filterByDistance(cleanCommTrade);
            cleanOffiTrade = await filterByDistance(cleanOffiTrade);
        } catch(e) {
            console.warn('거리 필터링 중 오류:', e.message);
        }
    }

    cleanAptTrade.sort((a, b) => b.priceNum - a.priceNum);
    cleanAptRent.sort((a, b) => parseNumber(b.deposit) - parseNumber(a.deposit));
    cleanCommTrade.sort((a, b) => b.priceNum - a.priceNum);
    cleanOffiTrade.sort((a, b) => b.priceNum - a.priceNum);

    return {
        lawdCd,
        monthsSearched: months,
        summary: {
            aptTotal6Months: cleanAptTrade.length,
            aptRentTotal6Months: cleanAptRent.length,
            commTotal6Months: cleanCommTrade.length,
            offiTotal6Months: cleanOffiTrade.length,
        },
        topTransactions: {
            aptTrade: cleanAptTrade,
            aptRent: cleanAptRent,
            commTrade: cleanCommTrade,
            offiTrade: cleanOffiTrade
        }
    };
}
