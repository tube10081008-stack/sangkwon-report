/**
 * AI 기반 업종 보조 분류 시스템
 * 규칙 기반으로 분류되지 못해 '기타'로 남은 상점의 이름을 분석하여 가장 적합한 대분류를 추천합니다.
 */

import { askGemini } from './geminiService.js';

/**
 * 전처리된 상점 목록 중 카테고리가 '기타'인 상점들을 찾아 일괄(Batch)로 Gemini에 분류를 요청하여 교정합니다.
 * @param {Array} stores processStoreData() 처리가 완료된 형태의 상점 객체 배열
 * @returns {Array} AI로 보강된 상점 배열 
 */
export async function augmentStoreCategories(stores) {
    // 1. 카테고리가 '기타'인 상점들 추출
    const unmappedStores = stores.filter(store => !store.categoryL || store.categoryL === '기타' || store.categoryL === '알 수 없음');
    
    if (unmappedStores.length === 0) {
        return stores; // 보정 불필요
    }

    // 2. 고유 키워드 추출 (상호명 우선, 없으면 원래 카테고리S 이름 등)
    // 상호명이 있는 경우 그 상호명이 무엇을 파는 곳인지 유추할 수 있음
    const uniqueKeywords = [...new Set(unmappedStores.map(s => {
        // 이름이 너무 길면 자름 처리
        let name = s.name.substring(0, 15);
        if (s.categoryS && s.categoryS !== '기타') name += `(${s.categoryS})`;
        return name;
    }).filter(Boolean))];

    if (uniqueKeywords.length === 0) {
        return stores;
    }

    // API 최대 길이 및 토큰 제한을 위해 상위 50개 키워드만 배치 처리 (빈도수 최적화)
    const keywordsToMap = uniqueKeywords.slice(0, 50);

    // 3. Gemini에 매핑 요청 (배치)
    const prompt = `다음은 상권 데이터에서 규칙으로 자동 분류되지 못한(기타로 처리된) 상점/업종명 목록입니다.
각 항목을 보고, 가장 잘 어울리는 표준 대분류 중 하나를 선택하여 JSON 형태로 매핑해 반환해주세요.
만약 도저히 알 수 없거나 속하는 것이 없다면 "기타" 그대로 두세요.

[표준 대분류 목록]
"일반사업·사무", "부동산·시설관리", "생활서비스", "외식·음료", "쇼핑·판매", "교육·학원", "문화·여가시설", "숙박시설", "스포츠·레저", "병원·의료", "자동차·정비", "뷰티·미용", "기타", "편의점·슈퍼", "약국·의료"

[분석 대상 목록]
${keywordsToMap.map((k, i) => `${i + 1}. ${k}`).join('\n')}

출력 형식 (반드시 JSON 객체 하나만 출력, 다른 설명 금지):
{
  "검색어1": "표준대분류명",
  "검색어2": "표준대분류명"
}`;

    const systemInstruction = '당신은 상권 분석 업종 분류 전문가입니다. 무조건 순수 JSON만 반환합니다.';
    
    try {
        console.log(`[Category Classifier] 🤖 미분류 업종 ${keywordsToMap.length}개 대상 AI 분류 보강 요청...`);
        const responseText = await askGemini(prompt, null, systemInstruction);
        
        const cleaned = responseText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
        const mappedData = JSON.parse(cleaned);

        let augmentedCount = 0;

        // 4. 원래 리스트에 보정 결과 반영
        stores.forEach(store => {
            if (!store.categoryL || store.categoryL === '기타') {
                let nameKey = store.name.substring(0, 15);
                if (store.categoryS && store.categoryS !== '기타') nameKey += `(${store.categoryS})`;
                
                const aiSuggestedCategory = mappedData[nameKey] || mappedData[store.name];
                
                if (aiSuggestedCategory && aiSuggestedCategory !== '기타') {
                    store.categoryL = aiSuggestedCategory; // 보정 완료
                    store.isAiAugmented = true; // 프론트에 표시 가능
                    augmentedCount++;
                }
            }
        });
        console.log(`[Category Classifier] AI 보강 완료: ${augmentedCount}개 상점 재분류 성공!`);
    } catch (e) {
        console.warn('[Category Classifier] 업종 보강 실패 (API 연동 에러 또는 파싱 에러):', e.message);
    }
    
    return stores;
}
