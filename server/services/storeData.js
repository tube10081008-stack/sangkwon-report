/**
 * 소상공인시장진흥공단 상가업소 데이터 서비스
 * 반경 내 상가업소 전체 조회 (페이지네이션 처리)
 */

const BASE_URL = 'http://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius';

/**
 * 반경 내 상가업소 전체 조회
 * @param {number} lat - 위도
 * @param {number} lng - 경도
 * @param {number} radius - 반경 (m)
 * @returns {Array} 상가업소 목록
 */
export async function getStoresInRadius(lat, lng, radius = 500) {
    const STORE_API_KEY = process.env.STORE_API_KEY;
    if (!STORE_API_KEY) {
        throw new Error('STORE_API_KEY가 설정되지 않았습니다. .env 파일을 확인하세요.');
    }

    const allStores = [];
    let pageNo = 1;
    const numOfRows = 1000;
    let totalCount = 0;

    do {
        const params = new URLSearchParams({
            serviceKey: STORE_API_KEY,
            pageNo: String(pageNo),
            numOfRows: String(numOfRows),
            radius: String(radius),
            cx: String(lng),
            cy: String(lat),
            type: 'json'
        });

        const url = `${BASE_URL}?${params.toString()}`;

        try {
            const response = await fetch(url);

            if (!response.ok) {
                console.error(`상가업소 API 오류: ${response.status}`);
                break;
            }

            const text = await response.text();
            let data;

            try {
                data = JSON.parse(text);
            } catch (e) {
                console.error('JSON 파싱 오류:', text.substring(0, 200));
                break;
            }

            if (!data.body || !data.body.items) {
                console.log('데이터 없음, 페이지:', pageNo);
                break;
            }

            totalCount = data.body.totalCount || 0;
            const items = data.body.items;

            if (!Array.isArray(items) || items.length === 0) break;

            allStores.push(...items);
            pageNo++;

            // API 과부하 방지
            await new Promise(resolve => setTimeout(resolve, 200));

        } catch (error) {
            console.error(`페이지 ${pageNo} 조회 오류:`, error.message);
            break;
        }
    } while (allStores.length < totalCount && pageNo <= 20);

    return processStoreData(allStores);
}

/**
 * 업종 대분류 표시명 매핑
 * 공공데이터 API의 분류명 → 사용자 친화적 표시명
 */
const CATEGORY_DISPLAY_MAP = {
    '과학·기술': '일반사업·사무',
    '시설관리·임대': '부동산·시설관리',
    '수리·개인': '생활서비스',
};

function mapCategoryName(originalName) {
    return CATEGORY_DISPLAY_MAP[originalName] || originalName;
}

/**
 * 원본 데이터를 정제하여 분석에 필요한 형태로 변환
 */
function processStoreData(rawStores) {
    return rawStores.map(store => ({
        id: store.bizesId || '',
        name: store.bizesNm || '이름 없음',
        // 업종 분류 (표시명 매핑 적용)
        categoryL: mapCategoryName(store.indsLclsNm || '기타'),
        categoryM: store.indsMclsNm || '기타',
        categoryS: store.indsSclsNm || '기타',
        categoryLCode: store.indsLclsCd || '',
        categoryMCode: store.indsMclsCd || '',
        categorySCode: store.indsSclsCd || '',
        // 위치
        lat: parseFloat(store.lat) || 0,
        lng: parseFloat(store.lon) || 0,
        // 주소
        roadAddress: store.rdnmAdr || '',
        jibunAddress: store.lnoAdr || '',
        // 추가 정보
        floorInfo: store.flrNo || '',
        dong: store.adongNm || ''
    }));
}

/**
 * 업종 대분류 요약
 */
export function getCategorySummary(stores) {
    const categoryMap = {};

    stores.forEach(store => {
        const cat = store.categoryL;
        if (!categoryMap[cat]) {
            categoryMap[cat] = {
                name: cat,
                count: 0,
                subCategories: {},
                stores: []
            };
        }
        categoryMap[cat].count++;
        categoryMap[cat].stores.push(store);

        // 중분류 집계
        const subCat = store.categoryM;
        if (!categoryMap[cat].subCategories[subCat]) {
            categoryMap[cat].subCategories[subCat] = { name: subCat, count: 0 };
        }
        categoryMap[cat].subCategories[subCat].count++;
    });

    // 정렬 (업소 수 내림차순)
    const sorted = Object.values(categoryMap)
        .sort((a, b) => b.count - a.count)
        .map(cat => ({
            ...cat,
            percentage: ((cat.count / stores.length) * 100).toFixed(1),
            subCategories: Object.values(cat.subCategories)
                .sort((a, b) => b.count - a.count)
        }));

    return sorted;
}

/**
 * 프랜차이즈 분석 (이름 기반 추정)
 */
const KNOWN_FRANCHISES = [
    'CU', 'GS25', '세븐일레븐', '이마트24', '미니스톱',
    '스타벅스', '투썸플레이스', '이디야', '메가커피', '컴포즈커피', '빽다방', '할리스',
    'BBQ', 'BHC', '교촌치킨', '네네치킨', '굽네치킨', '푸라닭',
    '맥도날드', '버거킹', '롯데리아', '맘스터치', 'KFC',
    '올리브영', '다이소', 'ABC마트',
    '파리바게뜨', '뚜레쥬르', '성심당',
    '이디야커피', '카페베네', '엔젤리너스',
    '도미노피자', '피자헛', '미스터피자', '파파존스',
    '본죽', '죽이야기',
    '교보문고', '알라딘', '영풍문고',
    '피자알볼로', '청기와',
    'CJ올리브마켓', '홈플러스', '이마트', '롯데마트',
    '신한은행', '국민은행', 'KB', 'NH', '우리은행', '하나은행', 'IBK',
    'SK텔레콤', 'KT', 'LG유플러스'
];

export function analyzeFranchises(stores) {
    const franchiseStores = [];
    const independentStores = [];

    stores.forEach(store => {
        const name = store.name;
        const isFranchise = KNOWN_FRANCHISES.some(f =>
            name.includes(f) || name.toUpperCase().includes(f.toUpperCase())
        );

        if (isFranchise) {
            franchiseStores.push(store);
        } else {
            independentStores.push(store);
        }
    });

    // 프랜차이즈 브랜드별 집계
    const brandMap = {};
    franchiseStores.forEach(store => {
        const matched = KNOWN_FRANCHISES.find(f =>
            store.name.includes(f) || store.name.toUpperCase().includes(f.toUpperCase())
        );
        if (matched) {
            if (!brandMap[matched]) brandMap[matched] = { name: matched, count: 0, category: store.categoryL };
            brandMap[matched].count++;
        }
    });

    return {
        totalFranchise: franchiseStores.length,
        totalIndependent: independentStores.length,
        franchiseRatio: stores.length > 0 ? ((franchiseStores.length / stores.length) * 100).toFixed(1) : '0',
        brands: Object.values(brandMap).sort((a, b) => b.count - a.count),
        topBrands: Object.values(brandMap).sort((a, b) => b.count - a.count).slice(0, 10)
    };
}
