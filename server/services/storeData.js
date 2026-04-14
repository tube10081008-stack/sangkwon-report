/**
 * 소상공인시장진흥공단 상가업소 데이터 서비스
 * 반경 내 상가업소 전체 조회 (페이지네이션 처리)
 */

import { augmentStoreCategories } from './categoryClassifier.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');

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

    const rawProcessed = processStoreData(allStores);
    return await augmentStoreCategories(rawProcessed);
}

/**
 * 업종 대분류 표시명 매핑
 * 공공데이터 API의 분류명 → 사용자 친화적 표시명
 */
const CATEGORY_DISPLAY_MAP = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'server/data/categories.json'), 'utf8'));

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
const KNOWN_FRANCHISES = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'server/data/franchises.json'), 'utf8'));

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
                // 완전 일치
                if (normalizedStoreName === f.normalized) return true;
                // 원본 이름이 독립된 단어로 존재하거나, 뒤에 '점/본점/직영/가' 등으로 끝나는 지점명 패턴 인정
                const regex = new RegExp(`(^|\\s)${f.original}(점|지점|본점|직영|\\s|$)`, 'i');
                if (regex.test(store.name)) return true;
                // 정규화된 이름에서 "브랜드+지점명" 형태 (예: CU신논현점, BHC강남점)
                // 브랜드명으로 시작하고 끝이 '점'으로 끝나는 경우 허용
                if (normalizedStoreName.startsWith(f.normalized) && normalizedStoreName.endsWith('점')) return true;
                return false;
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
