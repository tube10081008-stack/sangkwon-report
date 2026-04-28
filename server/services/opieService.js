import { askGemini } from './geminiService.js';
import { geocodeAddress } from './geocoding.js';
import { getStoresInRadius, getCategorySummary } from './storeData.js';
import { analyzeDistrict } from './analyzer.js';
import { getDemographics } from './demographicData.js';

let getSeoulDistrictData;
try {
    const seoulMod = await import('./seoulData.js');
    getSeoulDistrictData = seoulMod.getSeoulDistrictData;
} catch (e) { getSeoulDistrictData = async () => null; }

/**
 * 오피(Opie) V2 — 데이터 기반 브랜딩 리포트 생성
 * 
 * V1: "상상하여 채워넣어 작성하세요" → 할루시네이션 공장 🤥
 * V2: "제공된 데이터만을 근거로 작성하세요" → 팩트 기반 리포트 ✅
 */

// 강남구 핵심 상권별 대표 주소 (실데이터 수집 포인트)
const DISTRICT_HOTSPOTS = {
    '강남구': [
        { name: '압구정 로데오', address: '서울 강남구 도산대로 318', category: '카페' },
        { name: '신사동 가로수길', address: '서울 강남구 논현로 508', category: '편의점' },
        { name: '역삼역 오피스', address: '서울 강남구 테헤란로 152', category: '음식점' },
    ],
    '서초구': [
        { name: '교대역 골목상권', address: '서울 서초구 서초대로 411', category: '카페' },
        { name: '양재천 카페거리', address: '서울 서초구 양재대로 285', category: '카페' },
        { name: '강남역 이면도로', address: '서울 서초구 강남대로 465', category: '음식점' },
    ],
    '송파구': [
        { name: '송리단길', address: '서울 송파구 백제고분로 200', category: '카페' },
        { name: '잠실역 상권', address: '서울 송파구 잠실로 240', category: '음식점' },
        { name: '문정동', address: '서울 송파구 문정로 148', category: '편의점' },
    ],
    '마포구': [
        { name: '연남동', address: '서울 마포구 연남로 42', category: '카페' },
        { name: '합정/당인리', address: '서울 마포구 양화로 188', category: '음식점' },
        { name: '홍대입구', address: '서울 마포구 어울마당로 120', category: '편의점' },
    ],
    '성동구': [
        { name: '성수역 연무장길', address: '서울 성동구 연무장길 43', category: '카페' },
        { name: '뚝섬역', address: '서울 성동구 뚝섬로 400', category: '음식점' },
        { name: '왕십리역', address: '서울 성동구 왕십리로 315', category: '편의점' },
    ],
    '용산구': [
        { name: '이태원/경리단길', address: '서울 용산구 이태원로 200', category: '카페' },
        { name: '한남동', address: '서울 용산구 한남대로 92', category: '음식점' },
        { name: '용리단길', address: '서울 용산구 원효로 200', category: '편의점' },
    ],
};


export async function generateMarketingReport(district, agencyName, brokerName, phone) {
    const month = new Date().getMonth() + 1;
    const hotspots = DISTRICT_HOTSPOTS[district];

    if (!hotspots) {
        // 등록되지 않은 구는 기존 방식 폴백 (데이터 없이)
        return generateFallbackReport(district, agencyName, brokerName, phone, month);
    }

    console.log(`\n🎯 [Opie V2] ${district} 실데이터 수집 시작 (${hotspots.length}개 상권)...`);

    // ── 실데이터 수집 ──
    const spotDataList = [];
    for (const spot of hotspots) {
        try {
            const location = await geocodeAddress(spot.address);
            const stores = await getStoresInRadius(location.latitude, location.longitude, 500);
            const analysis = analyzeDistrict(stores, spot.category);
            const demographics = await getDemographics(location.latitude, location.longitude, location, stores).catch(() => null);
            const seoulData = await getSeoulDistrictData(location.latitude, location.longitude).catch(() => null);

            const categorySummary = analysis.categorySummary.slice(0, 5);
            
            // 개업/폐업 데이터
            const storeStats = seoulData?.store || null;
            const openRate = storeStats?.openRate ? `${(storeStats.openRate * 100).toFixed(1)}%` : '데이터 없음';
            const closeRate = storeStats?.closeRate ? `${(storeStats.closeRate * 100).toFixed(1)}%` : '데이터 없음';
            const totalSales = storeStats?.totalSales ? `${Math.floor(storeStats.totalSales / 100000000)}억원` : '데이터 없음';

            spotDataList.push({
                name: spot.name,
                address: spot.address,
                targetCategory: spot.category,
                totalStores: stores.length,
                score: analysis.overallScore,
                grade: analysis.grade.grade,
                top5Categories: categorySummary.map(c => `${c.name}(${c.count}개, ${c.percentage}%)`).join(', '),
                franchiseRatio: analysis.franchiseAnalysis.franchiseRatio + '%',
                quarterSales: totalSales,
                openRate,
                closeRate,
                floatingPop: seoulData?.population?.totalFloat ? seoulData.population.totalFloat.toLocaleString() + '명' : '데이터 없음',
            });

            console.log(`   ✅ ${spot.name}: ${stores.length}개 업소, ${analysis.overallScore}점 ${analysis.grade.grade}등급`);
        } catch (e) {
            console.warn(`   ⚠️ ${spot.name} 데이터 수집 실패: ${e.message}`);
        }

        // API 과부하 방지
        await new Promise(r => setTimeout(r, 1500));
    }

    if (spotDataList.length === 0) {
        return generateFallbackReport(district, agencyName, brokerName, phone, month);
    }

    // ── 실데이터 기반 프롬프트 생성 ──
    const dataBlock = spotDataList.map(d => `
### ${d.name} (${d.address})
- 반경 500m 업소: ${d.totalStores}개
- 종합점수: ${d.score}점 (${d.grade}등급)
- 상위 5대 업종: ${d.top5Categories}
- 프랜차이즈 비율: ${d.franchiseRatio}
- 분기 추정매출 합계: ${d.quarterSales}
- 분기 유동인구: ${d.floatingPop}
- 개업률: ${d.openRate} / 폐업률: ${d.closeRate}
`).join('\n');

    const systemPrompt = `
당신은 '오피(Opie)'라는 이름의 부동산 콘텐츠 마케팅 디렉터입니다.
목적: 부동산 중개인(${brokerName} 공인중개사, ${agencyName})의 전문성을 보여주는 상권 동향 리포트를 작성하는 것.

⛔ 절대 규칙 (위반 시 리포트 폐기):
1. 아래 [실측 데이터]에 있는 수치만 인용하세요. 데이터에 없는 수치(%, 명, 원)를 절대 지어내지 마세요.
2. "유동인구 X% 증가" 같은 전월/전년 대비 변동률은 비교 데이터가 없으므로 절대 언급하지 마세요.
3. 데이터가 '데이터 없음'인 항목은 언급하지 말고 건너뛰세요.
4. 불확실한 전망은 "~로 보입니다" "~일 가능성이 있습니다"로 표현하세요.

[실측 데이터 — ${new Date().toISOString().split('T')[0]} 기준 수집]
${dataBlock}

[작성 가이드라인]
- 전문성과 깊이를 보여주면서도 SNS/블로그에서 읽기 쉬운 친절한 어투 (존댓말)
- 이모티콘 적재적소 배치, 마크다운(Markdown) 적극 활용
- "현장에서 발로 뛰는 전문가의 생생한 리포트" 톤

[리포트 구조]
▶ 제목: [${district}] ${month}월 상권 동향 프라이빗 리포트 📊 - by ${agencyName} ${brokerName} 대표
▶ 도입부: ${month}월의 계절적 특성 + 데이터 기반 인사이트 (2~3문장)
▶ 1. 상권별 현황 분석
   - 각 상권(${spotDataList.map(s => s.name).join(', ')})의 실측 데이터를 바탕으로 뜨는 곳/조심할 곳 분류
   - 반드시 업소 수, 점수, 등급, 주요 업종 등 실데이터를 인용
▶ 2. 업종 트렌드 분석
   - 상위 업종 데이터를 바탕으로 어떤 업종이 강세인지, 프랜차이즈 비율이 시사하는 바
▶ 3. 예비 창업자/투자자를 위한 현실적 조언
   - 개업률/폐업률 데이터가 있다면 인용, 없다면 이 섹션은 짧게
▶ 4. 다음 달 전망 (1~2문장, 확정적 표현 금지)
▶ 5. CTA(Call To Action)
   > 🏢 상가/건물 매물 접수 및 상권 분석 상담
   > 💼 **${agencyName} | ${brokerName} 공인중개사**
   > 📞 **${phone}**

약 1000~1500자 분량. 리포트 본문만 깔끔하게 출력하세요.
`;

    try {
        const markdown = await askGemini(systemPrompt);
        console.log(`   🎯 [Opie V2] ${district} 리포트 생성 완료`);
        return markdown;
    } catch (error) {
        console.error('Gemini API Error in OpieService V2:', error);
        throw new Error('마케팅 리포트 생성에 실패했습니다. AI 연동 상태를 확인하세요.');
    }
}


/**
 * 등록되지 않은 구 폴백 (데이터 없이 기본 리포트)
 */
async function generateFallbackReport(district, agencyName, brokerName, phone, month) {
    const prompt = `
당신은 '오피(Opie)'라는 이름의 부동산 콘텐츠 마케팅 디렉터입니다.
${district}의 ${month}월 상권 동향 리포트를 작성해주세요.

⛔ 중요: 구체적인 수치(유동인구 X명, 매출 X억, 권리금 X% 상승 등)를 절대 지어내지 마세요.
대신 일반적인 트렌드와 계절적 특성 중심으로 작성하세요.

제목: [${district}] ${month}월 상권 동향 프라이빗 리포트 📊 - by ${agencyName} ${brokerName} 대표
마지막에 CTA:
> 🏢 상가/건물 매물 접수 및 상권 분석 상담
> 💼 **${agencyName} | ${brokerName} 공인중개사**
> 📞 **${phone}**

약 800자 분량, 마크다운, 존댓말, 이모티콘 활용.`;

    const markdown = await askGemini(prompt);
    return markdown;
}

