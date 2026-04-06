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

            const items = data.body.items;

            let itemsArray = [];
            // 공공데이터 API 특성상 1건일 경우 배열이 아닌 객체로 반환되는 이슈 방어
            if (Array.isArray(items)) {
                itemsArray = items;
            } else if (items && typeof items === 'object') {
                itemsArray = [items];
            } else {
                break; // 데이터 없음
            }

            if (itemsArray.length === 0) break;

            allStores.push(...itemsArray);
            
            // 만약 반환된 아이템 개수가 요청한 numOfRows(1000)보다 적다면 마지막 페이지이므로 종료
            if (itemsArray.length < numOfRows) {
                break;
            }
            
            pageNo++;

            // API 과부하 방지
            await new Promise(resolve => setTimeout(resolve, 200));

        } catch (error) {
            console.error(`페이지 ${pageNo} 조회 오류:`, error.message);
            break;
        }
    } while (pageNo <= 4); // 최대 4,000건(4페이지)까지 강제 루프

    // 데이터 품질 경고 로그
    if (allStores.length === 0) {
        console.warn(`⚠️ [데이터 품질] 위치(${lat}, ${lng}) 반경 ${radius}m: 업소 0건. 좌표/반경 확인 필요.`);
    } else if (allStores.length < 10) {
        console.warn(`⚠️ [데이터 품질] 위치(${lat}, ${lng}) 반경 ${radius}m: 업소 ${allStores.length}건. 데이터 부족.`);
    }

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
    '음식': '외식·음료',
    '소매': '쇼핑·판매',
    '생활서비스': '생활서비스',
    '교육': '교육·학원',
    '부동산': '부동산·시설관리',
    '관광·여가·오락': '문화·여가시설',
    '숙박': '숙박시설',
    '스포츠': '스포츠·레저',
    '음식점·카페': '음식점·카페',
    '소매·유통': '쇼핑·판매',
    '교육·학원': '교육·학습',
    '의료·건강': '병원·약국',
    '여가·오락': '문화·여가시설',
    '음식점': '외식·음료',
    '도소매': '쇼핑·판매',
    '의료': '병원·의료',
    '전문직서비스': '일반사업·사무',
    '정보통신': '일반사업·사무',
    // 중분류(categoryM) 세부 매핑 보정
    '비알코올': '카페·음료',
    '기타 간이': '분식·간식',
    '한식': '한식',
    '일식': '일식·중식',
    '중식': '일식·중식',
    '서양식': '양식·레스토랑',
    '패스트푸드': '패스트푸드',
    '치킨': '치킨·호프',
    '호프·간이주점': '주점·주류',
    '유흥주점': '주점·주류',
    '제과점': '베이커리·디저트',
    '의복': '패션·의류',
    '화장품': '뷰티·화장품',
    '미용실': '뷰티·미용',
    '약국': '약국·의료',
    '병원': '병원·의료',
    '보건의료': '병원·의료',
    '학원': '교육·학원',
    '은행': '금융·보험',
    '세탁': '생활서비스',
    '편의점': '편의점·슈퍼',
    '슈퍼마켓': '편의점·슈퍼'
};

function mapCategoryName(originalName) {
    if (!originalName) return '기타';
    if (originalName.includes('비알')) return '카페·음료';
    if (originalName.includes('기타 간이') || originalName.includes('기타간이')) return '간식·분식';
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
        categoryM: mapCategoryName(store.indsMclsNm || '기타'),
        categoryS: mapCategoryName(store.indsSclsNm || '기타'),
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
 * 프랜차이즈 분석 (정규화 기반 매칭)
 */
const KNOWN_FRANCHISES = [
    // === 편의점 ===
    'CU', 'GS25', '세븐일레븐', '7-Eleven', '이마트24', '미니스톱',
    // === 카페·커피 ===
    '스타벅스', '투썸플레이스', '투썸', '이디야', '이디야커피', '메가커피', '메가MGC', '메가엠지씨',
    '컴포즈커피', '컴포즈', '빽다방', '할리스', '카페베네', '엔젤리너스', '더벤티',
    '요거프레소', '탐앤탐스', '파스쿠찌', '매머드', '던킨', '폴바셋', '블루보틀',
    '커피빈', '커피에반하다', '커피나무', '빈스빈스', '만랩커피', '감성커피', '더카페',
    '카페봄봄', '셀렉토커피', '커피베이', '카페드림', '에이바우트',
    // === 치킨 ===
    'BBQ', 'BBQ치킨', 'BHC', 'BHC치킨', 'bhc', '교촌', '교촌치킨', '네네치킨', '굽네치킨', '굽네',
    '푸라닭', '노랑통닭', '페리카나', '또래오래', '호식이', '큰집닭강정', '가마치통닭',
    '처갓집', '멕시카나', '짱닭', '60계치킨', '바른치킨', 'KFC',
    // === 버거·패스트푸드 ===
    '맥도날드', '버거킹', '롯데리아', '맘스터치', '프랭크버거', '써브웨이', '서브웨이',
    '쉐이크쉑', '파이브가이즈', '이삭토스트', '할매토스트',
    // === 피자 ===
    '도미노', '도미노피자', '피자헛', '미스터피자', '파파존스', '피자알볼로', '피자스쿨',
    '피자나라', '피자마루', '반올림피자', '7번가피자', '청년피자',
    // === 베이커리·디저트 ===
    '파리바게뜨', '파리바게트', '뚜레쥬르', '성심당', '몽소', '브레드톡', '뚜레주르',
    '설빙', '빙수왕', '배스킨라빈스', '나뚜루', '젤라띠젤라띠', '하겐다즈',
    '크리스피크림', '던킨도넛', '오리지널팬케이크하우스',
    // === 한식 ===
    '명륜진사갈비', '큰맘할매순대국', '본죽', '죽이야기', '이차돌', '오봉집',
    '토박이', '본도시락', '한솥', '김밥천국', '김가네', '신전떡볶이', '죠스떡볶이',
    '청년다방', '장충동족발', '장충동뚱뚱이', '원할머니보쌈', '놀부부대찌개', '놀부항아리',
    '박가부대', '홍콩반점', '새마을식당', '백종원', '한신포차', '포장마차',
    '김치찌개', '순대실록', '선비꼬마김밥', '바르다김선생', '고봉민김밥',
    '역전우동', '우동가조쿠', '송탄부대찌개',
    // === 일식·분식 ===
    '규카츠', '하남돼지집', '육쌈냉면', '미소야', '스시로', '쿠우쿠우',
    '삼첩분식', '봉추찜닭', '두끼', '엽기떡볶이', '배떡',
    // === 중식·아시안 ===
    '미다래', '호천당', '포시즌', '플러스84',
    // === 주점 ===
    '봉구비어', '생활맥주', '인생술집', '옐로우컨테이너', '질할브로스', '포차어게인',
    '이자카야', '술탄', '두꺼비',
    // === 생활·뷰티 ===
    '올리브영', '다이소', 'ABC마트', '이니스프리', '더페이스샵', '네이처리퍼블릭',
    '미샤', '아리따움', '에뛰드', '이니스프리', '씨앤씨', '리드코프',
    '정관장', '스피드메이트', '포토이즘', '인생네컷', '하루필름', '포토매틱',
    // === 리테일·마트 ===
    'CJ올리브마켓', 'GS더프레시', '홈플러스', '이마트', '롯데마트', '포시즌마트',
    '노브랜드', '트레이더스', '코스트코',
    // === 서점 ===
    '교보문고', '알라딘', '영풍문고', '반디앤루니스',
    // === 금융 ===
    '신한은행', '국민은행', 'KB', 'NH', '우리은행', '하나은행', 'IBK',
    '케이뱅크', '토스뱅크', '카카오뱅크',
    // === 통신 ===
    'SK텔레콤', 'KT', 'LG유플러스', 'SKT',
    // === 의료·약국 ===
    '온누리약국', '올리브약국',
    // === 헬스·스포츠 ===
    '애니타임피트니스', '스포애니', '커브스', '에이블짐', '짐박스',
    // === 세탁 ===
    '크린토피아', '월드크리닝',
    // === 부동산 ===
    '직방', '다방', '피터팬', 'ERA',
    // === 학원·교육 ===
    '정상어학원', '윤선생', '대교눈높이', '빨간펜', '청담러닝', '청담어학원',
    '메가스터디', '대성학원', '이투스', 'YBM'
];

/**
 * 상점 이름 정규화 (매칭 정확도 개선)
 * 공백, 특수문자 제거 후 대문자 변환
 */
function normalizeName(name) {
    return name
        .replace(/\s+/g, '')        // 공백 제거
        .replace(/[()[\]·.\/]+/g, '') // 특수문자 제거
        .toUpperCase();
}

export function analyzeFranchises(stores) {
    const franchiseStores = [];
    const independentStores = [];

    // 프랜차이즈 이름 정규화 캐싱 (매번 계산하지 않도록)
    const normalizedFranchises = KNOWN_FRANCHISES.map(f => ({
        original: f,
        normalized: normalizeName(f)
    }));

    stores.forEach(store => {
        const normalizedStoreName = normalizeName(store.name);
        const matched = normalizedFranchises.find(f =>
            normalizedStoreName.includes(f.normalized)
        );

        if (matched) {
            franchiseStores.push({ ...store, matchedBrand: matched.original });
        } else {
            independentStores.push(store);
        }
    });

    // 프랜차이즈 브랜드별 집계
    const brandMap = {};
    franchiseStores.forEach(store => {
        const brand = store.matchedBrand;
        if (!brandMap[brand]) brandMap[brand] = { name: brand, count: 0, category: store.categoryL };
        brandMap[brand].count++;
    });

    return {
        totalFranchise: franchiseStores.length,
        totalIndependent: independentStores.length,
        franchiseRatio: stores.length > 0 ? ((franchiseStores.length / stores.length) * 100).toFixed(1) : '0',
        brands: Object.values(brandMap).sort((a, b) => b.count - a.count),
        topBrands: Object.values(brandMap).sort((a, b) => b.count - a.count).slice(0, 10)
    };
}
