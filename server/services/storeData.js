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
    } while (pageNo <= 10); // 최대 10,000건(10페이지)까지 확장 루프

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
    // === 대분류(categoryL) 매핑 ===
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
    // === 중분류(categoryM) 세부 매핑 보정 ===
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
    '슈퍼마켓': '편의점·슈퍼',
    // === 에이전트 루프 #2 자동 추가 (16 + α) ===
    '자동차수리': '자동차·정비',
    '자동차판매': '자동차·정비',
    '자동차': '자동차·정비',
    '건강/미용': '뷰티·미용',
    '이미용': '뷰티·미용',
    '인테리어': '생활서비스',
    '피트니스': '스포츠·레저',
    '체육시설': '스포츠·레저',
    '운동시설': '스포츠·레저',
    '헬스·스포츠': '스포츠·레저',
    '여관': '숙박시설',
    '모텔': '숙박시설',
    '보험': '금융·보험',
    '증권': '금융·보험',
    '섬유·의복': '패션·의류',
    '가전': '쇼핑·판매',
    '의료기기': '병원·의료',
    '동물병원': '생활서비스',
    '반려동물': '생활서비스',
    '기타소매': '쇼핑·판매',
    '식료품': '쇼핑·판매',
    '건강식품': '쇼핑·판매',
    '분식': '분식·간식',
    '기타음식업': '외식·음료',
    '외국음식': '양식·레스토랑',
    '일반교습': '교육·학원',
    '예체능학원': '교육·학원',
    '보습학원': '교육·학원',
    '어학원': '교육·학원',
    '컴퓨터학원': '교육·학원',
    // === Auto-added by Agent Loop 종로구 #2 (2026-04-09) ===
    '골프연습장': '스포츠·레저',
    '당구장': '스포츠·레저',
    '노래방': '문화·여가시설',
    '코인노래방': '문화·여가시설',
    '사진관': '생활서비스',
    '인쇄소': '생활서비스',
    '시계수리': '생활서비스',
    '열쇠수리': '생활서비스',
    '안경점': '생활서비스',
    '보청기': '병원·의료',
    '한의원': '병원·의료',
    '치과': '병원·의료',
    '피부과': '병원·의료',
    '정형외과': '병원·의료',
    '여행사': '생활서비스',
    '문구점': '쇼핑·판매',
    '공인중개사': '부동산·시설관리',
    '주차장': '생활서비스',
    // === Auto-added by Agent Loop 중구 #2 (2026-04-09) ===
    '호텔': '숙박시설',
    '관광호텔': '숙박시설',
    '게스트하우스': '숙박시설',
    '면세점': '쇼핑·판매',
    '기념품점': '쇼핑·판매',
    '환전소': '금융·보험',
    '세무사': '일반사업·사무',
    '법무사': '일반사업·사무',
    '변호사사무소': '일반사업·사무',
    '회계사': '일반사업·사무',
    '꽃집': '쇼핑·판매',
    '화원': '쇼핑·판매',
    '주유소': '자동차·정비',
    '세차장': '자동차·정비',
    '필라테스': '스포츠·레저',
    '요가': '스포츠·레저',
    '마사지': '뷰티·미용',
    '네일샵': '뷰티·미용',
    '태권도': '스포츠·레저',
    '전자제품': '쇼핑·판매',
    '가구': '쇼핑·판매',
    '택배': '생활서비스',
    '우체국': '생활서비스',
    '전통시장': '쇼핑·판매',
    '공유오피스': '일반사업·사무',
    // === Auto-added by Agent Loop 중랑구 #2 (2026-04-10) ===
    '스터디카페': '교육·학원',
    '코인세탁': '생활서비스',
    '셀프빨래방': '생활서비스',
    '복권방': '생활서비스',
    '만화카페': '문화·여가시설',
    'PC방': '문화·여가시설',
    '키즈카페': '문화·여가시설',
    '테마파크': '문화·여가시설',
    '한의원약국': '병원·의료',
    '소아과': '병원·의료',
    '내과': '병원·의료',
    '이비인후과': '병원·의료',
    '안과': '병원·의료',
    '헬스장': '스포츠·레저',
    '권투': '스포츠·레저',
    '유아용품': '쇼핑·판매',
    '철물점': '쇼핑·판매',
    '복사집': '생활서비스'
};

function mapCategoryName(originalName) {
    if (!originalName) return '기타';
    // 정확 매칭 우선
    if (CATEGORY_DISPLAY_MAP[originalName]) return CATEGORY_DISPLAY_MAP[originalName];
    // 부분 키워드 퍼지 매칭
    if (originalName.includes('비알')) return '카페·음료';
    if (originalName.includes('기타 간이') || originalName.includes('기타간이')) return '간식·분식';
    if (originalName.includes('커피') || originalName.includes('카페') || originalName.includes('음료')) return '카페·음료';
    if (originalName.includes('분식') || originalName.includes('떡볶이') || originalName.includes('김밥')) return '분식·간식';
    if (originalName.includes('치킨') || originalName.includes('호프')) return '치킨·호프';
    if (originalName.includes('피자')) return '피자';
    if (originalName.includes('세탁') || originalName.includes('크리닝') || originalName.includes('클리닝')) return '생활서비스';
    if (originalName.includes('미용') || originalName.includes('헤어') || originalName.includes('네일')) return '뷰티·미용';
    if (originalName.includes('약국')) return '약국·의료';
    if (originalName.includes('의원') || originalName.includes('병원') || originalName.includes('치과') || originalName.includes('한의원')) return '병원·의료';
    if (originalName.includes('학원') || originalName.includes('교습')) return '교육·학원';
    if (originalName.includes('부동산') || originalName.includes('공인중개')) return '부동산·시설관리';
    if (originalName.includes('스포츠') || originalName.includes('헬스') || originalName.includes('피트니스') || originalName.includes('체육')) return '스포츠·레저';
    if (originalName.includes('자동차') || originalName.includes('정비') || originalName.includes('카센터')) return '자동차·정비';
    return originalName;
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
    'CU', 'GS25', '세븐일레븐', '7-Eleven', '이마트24', '미니스톱', '씨유', '지에스25',
    // === 카페·커피 ===
    '스타벅스', '투썸플레이스', '투썸', '이디야', '이디야커피', '메가커피', '메가MGC', '메가엠지씨',
    '컴포즈커피', '컴포즈', '빽다방', '할리스', '카페베네', '엔젤리너스', '더벤티',
    '요거프레소', '탐앤탐스', '파스쿠찌', '매머드', '던킨', '폴바셋', '블루보틀',
    '커피빈', '커피에반하다', '커피나무', '빈스빈스', '만랩커피', '감성커피', '더카페',
    '카페봄봄', '셀렉토커피', '커피베이', '카페드림', '에이바우트',
    '커피디지', '호랭이커피', '마일스커피', '카페요아정',
    // === 치킨 ===
    'BBQ', 'BBQ치킨', 'BHC', 'BHC치킨', 'bhc', '교촌', '교촌치킨', '네네치킨', '굽네치킨', '굽네',
    '푸라닭', '노랑통닭', '페리카나', '또래오래', '호식이', '큰집닭강정', '가마치통닭',
    '처갓집', '멕시카나', '짱닭', '60계치킨', '바른치킨', 'KFC',
    '지코바', '후라이드참잘하는집', '본스치킨', '잉치킨', '꼬닭', '인생닭강정',
    // === 버거·패스트푸드 ===
    '맥도날드', '버거킹', '롯데리아', '맘스터치', '프랭크버거', '써브웨이', '서브웨이',
    '쉐이크쉑', '파이브가이즈', '이삭토스트', '할매토스트', '더피플버거',
    // === 피자 ===
    '도미노', '도미노피자', '피자헛', '미스터피자', '파파존스', '피자알볼로', '피자스쿨',
    '피자나라', '피자마루', '반올림피자', '7번가피자', '청년피자',
    '59쌀피자', '빅스타피자', '맘스피자',
    // === 베이커리·디저트 ===
    '파리바게뜨', '파리바게트', '뚜레쥬르', '성심당', '몽소', '브레드톡', '뚜레주르',
    '설빙', '빙수왕', '배스킨라빈스', '나뚜루', '젤라띠젤라띠', '하겐다즈',
    '크리스피크림', '던킨도넛', '오리지널팬케이크하우스',
    '해를품은달카츠', '픽미픽미아이스', '황제탕후루',
    // === 한식 ===
    '명륜진사갈비', '큰맘할매순대국', '본죽', '죽이야기', '이차돌', '오봉집',
    '토박이', '본도시락', '한솥', '김밥천국', '김가네', '신전떡볶이', '죠스떡볶이',
    '청년다방', '장충동족발', '장충동뚱뚱이', '원할머니보쌈', '놀부부대찌개', '놀부항아리',
    '박가부대', '홍콩반점', '새마을식당', '백종원', '한신포차', '포장마차',
    '김치찌개', '순대실록', '선비꼬마김밥', '바르다김선생', '고봉민김밥',
    '역전우동', '우동가조쿠', '송탄부대찌개',
    '본우리집밥', '토마토김밥', '양평해장국', '담꾹', '장충당', '소담촌',
    '화포식당', '가장맛있는족발', '족발야시장', '쫄면주는족발', '백남옥달인손만두',
    '귀한족발', '명동찌개마을', '등촌샤브칼국수', '백년백세삼계탕', '세미네국수집',
    // === 일식·분식·아시안 ===
    '규카츠', '하남돼지집', '육쌈냉면', '미소야', '스시로', '쿠우쿠우',
    '삼첩분식', '봉추찜닭', '두끼', '엽기떡볶이', '배떡',
    '미다래', '호천당', '포시즌', '플러스84',
    '탕화쿵푸마라탕', '마라공방', '라사천마라탕', '차이몬스터',
    '긴자료코', '저스트카츠', '일미락', '일포베트남쌀국수', '미분당',
    '착한낙지', '도리연닭도리탕',
    '월남쌈 샤브샤브 마니아', '무지개양꼬치',
    // === 주점 ===
    '봉구비어', '생활맥주', '인생술집', '옐로우컨테이너', '질할브로스', '포차어게인',
    '이자카야', '술탄', '두꺼비',
    '치어스', '펀비어킹', '짝태앤노가리', '낭풍', '장우동', '곱분이곱창',
    // === 생활·뷰티 ===
    '올리브영', '다이소', 'ABC마트', '이니스프리', '더페이스샵', '네이처리퍼블릭',
    '미샤', '아리따움', '에뛰드', '씨앤씨', '리드코프',
    '정관장', '스피드메이트', '포토이즘', '인생네컷', '하루필름', '포토매틱',
    '이철헤어커커', '이가자헤어비스', '아이디헤어',
    // === 리테일·마트 ===
    'CJ올리브마켓', 'GS더프레시', 'GS THE FRESH', '홈플러스', '이마트', '롯데마트', '포시즌마트',
    '노브랜드', '트레이더스', '코스트코', '하모니마트',
    // === 서점 ===
    '교보문고', '알라딘', '영풍문고', '반디앤루니스',
    // === 금융 ===
    '신한은행', '국민은행', 'KB', 'NH', '우리은행', '하나은행', 'IBK',
    '케이뱅크', '토스뱅크', '카카오뱅크',
    // === 통신 ===
    'SK텔레콤', 'KT', 'LG유플러스', 'SKT',
    // === 의료·약국 ===
    '온누리약국', '올리브약국', '메디팜',
    // === 헬스·스포츠 ===
    '애니타임피트니스', '스포애니', '커브스', '에이블짐', '짐박스', '크로스핏', '용인대태권도',
    // === 세탁·클리닝 ===
    '크린토피아', '월드크리닝', '탑크리닝', '워시피플', '워시엔조이', '크린&크린', '크린프랜드', '이불빠는날',
    // === 안경 ===
    '1001안경', '글라스바바',
    // === 부동산 ===
    '직방', '다방', '피터팬', 'ERA',
    // === 학원·교육 ===
    '정상어학원', '윤선생', '대교눈높이', '빨간펜', '청담러닝', '청담어학원',
    '메가스터디', '대성학원', '이투스', 'YBM', 'YBM잉글루',
    '소마사고력수학', '퍼씰수학', '해법영어', '아소비',
    // === 스터디카페 ===
    '토즈스터디랩', '그루스터디카페', '어썸팩토리 스터디카페', '오슬로 스터디카페',
    // === PC방·코인노래방·기타 ===
    '제로100PC', '고릴라PC방', '탑코인노래연습장',
    // === 자동차 ===
    '기아오토큐', '애니카랜드', '삼천리자전거', '스피드메이트',
    // === 무인점포·기타 ===
    '아싸셀프다', '담배가게아가씨', '베이프247', '설빙고24',
    '야심잔기지떡', '밀레', '트라이', '요미요미',
    // === 기타 보정 (별도명칭 동일 브랜드) ===
    '빅스타', '글라스',
    // === Auto-added by Agent Loop 종로구 #2 (2026-04-09) ===
    '국순당백세주마을', 'SOUP', 'DoubleA 카피센터', '하나투어', '한미보청기',
    '우리동네사진관', '옵스', '닥터포유', '시사아카데미', '갓텐스시',
    'S&U 피부과', '솔데스크', '플러스약국', '일맥한의원', '아이픽스',
    '샘스튜디오', '왕비집', '아이원안경', '파리크라상', '모던하우스',
    '골프존파크', '얼짱네컷', '이훈ALL30000', '도스타코스', '미스터포토',
    '샐러디', '토리아에즈', '틈새라면', '뎁짜이', '브롱스',
    '꽈백최선생', '내가찜한닭', '식껍', '김명자굴국밥', '누나홀닭',
    '어반스테이', '진순대', '백부장집', '가츠라', '호호미역',
    '신의주찹쌀순대', '야들리애치킨', '슬로우캘리', '드림디포', '푸르넷',
    '커피스미스', '오렌즈', '지유명차', '스타키보청기', '한솔요리학원',
    '금강랜드로바', '알파문구', '에이스크리닝', '할머니순대국', '파고다어학원',
    '돈가네', '종로찌게마을', '곤지암할매소머리국밥', '봉평골', '서울뚝배기',
    '하나골프', '전주집',
    // === Auto-added by Agent Loop 중구 #2 (2026-04-09) ===
    '네일스퀘어', '봉피양', '금강제화', '푸마', '일리커피', '노랑풍선',
    '깐부치킨', '용대리황태해장국', '파고다', '일리카페', '청춘극장',
    '레드캡투어', '롯데시티호텔', '반포식스', '코코이찌방야', '월매네남원추어탕',
    '둘둘치킨', '나주곰탕', '강서면옥', '진주회관', '교동전선생',
    '네스카페', '아리스타커피', '알촌', '신룽푸마라탕', '환공어묵',
    '양평으뜸해장국', '서오릉피자', '공릉닭한마리', '신의주부대찌개',
    '윤가네의정부부대찌게', '남원추어탕', '삼거리뼈해장국', '파크짐', '포로이',
    '큰손할매순대국', '담소소사골순대·육개장', '안경매니져', '하나로마트',
    '버거운녀석들', '명동칼국수', '리나스', '강가', '레더라',
    '하카전자담배', '라그릴리아', '원주추어탕', '소호정', '무교동낙지', '더풋샵',
    '유니클로', '농협은행', '랄라블라', 'KB국민은행',
    // === Auto-added by Agent Loop 중랑구 #2 (2026-04-10) ===
    '리안헤어', '런드리데이', '셀프24', '함소아한의원', '수유리우동집',
    '알레르망', '자담치킨', '샹츠마라', '노모어피자', '팔각도',
    '보배반점', '유니베라', '제주돈선생', '훌랄라치킨', '땅스부대찌개',
    '서울마님죽', '멘토즈스터디카페', '해법수학', '스몰커피', '다시봄필라테스',
    '닥터프린터', '키플', '무한리필통큰소', '수유리우동', '젠블랙',
    '준코', '바디톡', '꼼주', '강금옥쭈꾸미', '모토이시',
    '인쌩맥주', '180스터디카페', '뮤엠영어', '스마트해법수학', '몬스터매스',
    '치킨마루', '맛닭꼬', '아발론랭콘', '빽보이피자', '맛있는고기에솜씨를더하다',
    '스텔라떡볶이', '샤브올데이', '마임', '할매순대국', '곽만근갈비탕',
    '명인만두', '군중닭갈비', '삼청동샤브', '오투치킨', '에이바헤어',
    '더바스켓', '고피자', '삼곱식당', '워시쿱', '김밥나라',
    '어쩌다마트', 'IGA마트', '썬더치킨', '헬스트론', '비타민하우스',
    '한식세끼', '미니특공대테마파크', '참약사', '워시팡팡', '삼천리하이퍼마켓',
    '타코보이', 'PCDAY', '뚱스김밥', '전설의솥뚜껑삼겹살', '찡어찡어',
    '위넌스터디카페', '로기스커피', '올가드림뷰티', '종근당건강헬스벨스토리',
    '스터디고', '다올복권방', '마포껍데기', '비타오아시스', '원주니어',
    '3H', '투다리', '이마트 에브리데이'
];

/**
 * 상점 이름 정규화 (매칭 정확도 개선)
 * (주), (유), 공백, 특수문자 제거 후 대문자 변환
 */
function normalizeName(name) {
    return name
        .replace(/\(주\)|\(유\)|\(사\)|주식회사|유한회사/g, '') // 법인접미사 제거
        .replace(/\s+/g, '')        // 공백 제거
        .replace(/[()[\]·.\/\-_&]+/g, '') // 특수문자 제거
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
        const matched = normalizedFranchises.find(f => {
            if (f.original.length <= 3) {
                // 3글자 이하는 오탐 방지를 위해 
                // 1) 정규화 이름 완전 일치 
                // 2) 원본 이름이 띄어쓰기 경계에 있거나 뒤에 '점'이 붙는 경우만 허용
                if (normalizedStoreName === f.normalized) return true;
                const regex = new RegExp(`(^|\\s)${f.original}(점|\\s|$)`, 'i');
                return regex.test(store.name);
            }
            return normalizedStoreName.includes(f.normalized);
        });

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
