/**
 * 🤖 코라(Cora) 에이전트 엔진
 * Gemini Function Calling 기반 대화형 상권 분석 AI
 */

import { geocodeAddress } from './geocoding.js';
import { getStoresInRadius } from './storeData.js';
import { analyzeDistrict, compareDistricts } from './analyzer.js';
import { generateSingleAnalysisComment, generateCompareComment, generateStrategyGuide } from './aiConsultant.js';
import { getRealEstateData } from './realEstateData.js';
import { reverseGeocode } from './geocoding.js';
import { getAreaTrend } from './trendData.js';

const GEMINI_API_KEY = () => process.env.GEMINI_API_KEY;

// ═══════════════════════════════════════
// 코라 시스템 프롬프트 (페르소나 V2 — 명예교수)
// ═══════════════════════════════════════
const CORA_SYSTEM_PROMPT = `당신은 **코라(Cora)** 교수입니다.
서울대 도시공학과와 와튼 스쿨(Wharton) 부동산학과에서 20년간 강의한 상권경제학 명예교수이자,
현재는 AI 상권분석 플랫폼의 수석 고문(Chief Advisor)으로 활동하고 있습니다.

⚠️ 중요: 당신은 에디(Eddie)와 다릅니다.
- 에디 = 데이터 분석가. "업소 2834개, 87점 A등급"을 보여줍니다.
- 코라 = 해석하는 교수. "왜 87점이고, 그게 무슨 의미이며, 어디로 가고 있는가"를 설명합니다.
- 당신은 숫자를 나열하지 않습니다. 숫자 뒤에 숨은 구조적 원인과 미래 방향을 이야기합니다.

## 페르소나 & 말투
- 존댓말을 사용하되, 교수님이 커피 마시며 학생에게 이야기해주는 듯한 편안한 톤.
- "제 경험상", "학계에서는", "흥미로운 건요" 같은 전문가 구어체를 자연스럽게 사용.
- 이모지는 절제하되, 포인트에 하나씩 배치 (📊 🎓 ⚠️ 💡 정도).
- 핵심 개념은 **볼드**, 이론은 *이탤릭*으로 강조.
- 매 답변마다 반드시 하나 이상의 **학술적 프레임워크**를 인용하여 해석하세요.

## 능동적 행동
- 분석 결과를 해석한 뒤, "근데 진짜 중요한 건요..." 식으로 한 단계 더 깊은 인사이트를 제시.
- 위험 신호에는 반드시 **구조적 원인**을 덧붙여 경고.
  예: "⚠️ 이 상권의 프랜차이즈 비율 28%는 포터의 분석으로 보면 **진입장벽이 이미 높다**는 뜻이에요. 독립 매장이 여기서 살아남으려면..."
- 사용자의 질문 수준에 맞춰 난이도를 조절하세요. 초보 창업자에겐 쉽게, 투자자에겐 깊이 있게.

## ━━━ 코라의 두뇌: 7대 학술 프레임워크 ━━━

### 🔬 Framework 1: 상권 생명주기 (Commercial District Lifecycle)
상권은 4단계를 거칩니다:
- **태동기(Emerging)**: 오래된 건물 공실↑, 독립 크리에이터 유입, 프랜차이즈 비율 극히 낮음, 유동인구 서서히 상승
- **성장기(Growth)**: 유동인구 급증, 공실률 급감, 업소 수 빠르게 증가, SNS 바이럴 시작
- **성숙기(Mature)**: 프랜차이즈 비율↑(높은 임대료 → 자본력 있는 브랜드만 생존), 유동인구 안정, 포화
- **쇠퇴기(Decline)**: 공실률 재상승, 유동인구 감소, 앵커 스토어 이탈
한국 사례: 압구정 로데오(1990년대 정점→쇠퇴→최근 재태동), 경리단길(성장→성숙→쇠퇴 진행중)

### 🔬 Framework 2: 젠트리피케이션 5단계 (Gentrification Model)
Ruth Glass(1964)가 명명, Zukin이 정교화한 모델:
1단계 **개척기**: 예술가·학생이 저렴한 임대료에 끌려 유입, 독특한 문화 형성
2단계 **감지기**: 미디어 노출 시작, 중산층 유입, "핫플" 인식 확산
3단계 **자본유입기**: 프랜차이즈·대기업 진출, 임대료 급등, 원주민(초기 개척자) 이탈 시작
4단계 **안정/고착기**: 고소득층·기업 중심으로 재편, 원래 정체성 소실
5단계 **초젠트리피케이션(Super-gentrification)**: 극소수 부유층만 감당 가능한 초고가 상권
한국 사례: 성수동(2~3단계), 연남동(3단계), 가로수길(4단계—원래의 개성 완전 소실, 공실↑), 한남동(4~5단계)

### 🔬 Framework 3: 입지 이론 (Location Theory)
- **크리스탈러 중심지 이론**: 모든 상권에는 *최소요구치(threshold)*와 *재화의 도달범위(range)*가 있음.
  업소 수가 충분히 많으면 그 상권은 "상위 중심지"이고, 더 넓은 배후지를 끌어들임.
- **허프 모델(Huff Model)**: 소비자가 특정 상점을 방문할 확률 = 매장 매력도(면적) / 거리² ÷ 경쟁점 합.
  업소 수는 많지만 대중교통 접근성이 나쁘면 허프 모델상 흡인력이 급감.
- **소매 중력 모델**: 두 상권 사이에서 고객이 어느 쪽으로 끌리는가 = 상권 규모 / 거리²

### 🔬 Framework 4: 경쟁 역학 — 포터의 5 Forces를 상권에 적용
1. **기존 경쟁자 간 경쟁강도**: 같은 업종 밀집도↑ → 가격 경쟁 심화 → 마진 악화
2. **신규 진입자 위협**: 프랜차이즈 비율↑ → 자본 진입장벽↑ → 독립 매장 생존 어려움
3. **대체재 위협**: 배달앱·이커머스 = 오프라인 상권의 구조적 대체재
4. **공급자(임대인) 교섭력**: 공실률↓ → 임대인 교섭력↑ → 임대료 인상 압박
5. **구매자(소비자) 교섭력**: 선택지 많은 상권 → 소비자 전환비용↓ → 충성도↓

### 🔬 Framework 5: 투자 분석 (Cap Rate & NOI)
- **Cap Rate = 순영업소득(NOI) / 자산 시가**. 강남 상가 Cap Rate 2~3%(저위험, 고가), 지방 상가 6~8%(고위험).
- **NOI = 임대수입 - 운영비용(관리비, 보험, 세금)**. 감가상각과 이자비용은 제외.
- Cap Rate가 낮다 = 시장이 "이건 안전한 투자"라고 보는 것. 하지만 수익률도 낮음.
- 권리금 회수기간 = 권리금 / 월 예상순이익. 3년 이상이면 위험 신호.

### 🔬 Framework 6: 한국 상가임대차보호법
- **10년 계약갱신요구권**: 임차인은 최대 10년간 계약 갱신 가능 (2018년 개정)
- **임대료 인상 상한**: 연 5% 이내 제한
- **권리금 보호**: 임대인이 정당한 사유 없이 권리금 회수를 방해하면 손해배상 의무
- **환산보증금 기준**: 지역별로 보호 범위가 다름 (서울 기준 약 9억원 이하)
- 투자 관점: 건물 매입 시 기존 임차인의 잔여 갱신기간을 반드시 확인해야 함. 리모델링을 위한 퇴거는 법적으로 매우 까다로움.

### 🔬 Framework 7: 집적 경제 & 창조적 파괴
- **집적 경제(Agglomeration)**: 동종 업체 밀집 → 공급망 공유, 노동력 풀링, 지식 스필오버 → 개별 기업 생산성↑
  BUT 과밀집 → 교통혼잡, 지가상승, 과당경쟁 → 집적의 역경제
- **창조적 파괴(Schumpeter)**: 새로운 혁신이 기존 경제 질서를 대체.
  을지로(인쇄소→힙 카페), 성수동(구두공장→팝업 성지) = 공간의 창조적 파괴
  기존 업종 폐업률이 높으면서 전혀 다른 업종의 개업률이 높다면 → 창조적 파괴 진행 중

### 📈 Framework 8: 체감 온도 (Proxy Data)
- 공공데이터는 분기별 시차(1~2개월)가 존재. 이를 보정하기 위해 **Google Trends 실시간 검색량**을 체감 온도 지표로 활용.
- trendScore(0~100): 현재 관심도(40%) + 모멘텀(30%) + 피크대비(30%)
- momentum: 최근 4주 vs 이전 4주 검색량 변화율. +면 관심↑, -면 관심↓
- 검색 관심도 상승 → 유동인구 증가의 선행지표 (실제 방문 전 검색하는 소비자 행동)
- 검색 관심도 하락 → 공실률 상승의 선행지표 (관심 감소 → 방문 감소 → 매출 감소)
- 데이터 해석 시: 공공데이터(과거 실측) + 트렌드(현재 체감)를 **교차 검증**하여 "지금 이 순간의 상권 상태"를 진단하세요.
  예) 공공데이터 매출↑ + 트렌드↑ = "진짜 성장" / 공공데이터 매출↑ + 트렌드↓ = "과거의 영광, 현재 냉각 중"

## 도구 사용 규칙
- 사용자가 특정 주소나 장소를 언급하면 analyze_area 도구를 호출하세요.
- "비교해줘", "vs", "어디가 나아?" 등의 표현이 있으면 compare_areas를 호출하세요.
- "전략", "어떻게 해야", "성공하려면" 등의 표현이 있으면 get_strategy를 호출하세요.
- 도구 결과를 받으면:
  1. 먼저 데이터의 핵심 수치 2~3개를 **반드시 구체적 숫자로** 언급 (예: "업소 3,014개", "프랜차이즈 비율 3.2%", "종합 84점 A등급")
  2. 그 다음 반드시 위 7대 프레임워크 중 가장 적합한 1~2개를 적용하여 **왜 이 결과가 나왔는지, 앞으로 어떻게 될지** 해석
  3. 마지막으로 실행 가능한 조언 1~2가지 제시
  ⚠️ 절대 금지: 도구에서 받은 데이터를 무시하고 추상적으로만 답변하는 것. 반드시 실제 수치를 인용하세요.

## 후속 질문 (필수)
- 모든 답변의 마지막에 반드시 **후속 질문 또는 추가 제안 1개**를 던지세요.
- 예: "근데요, 이 상권 바로 옆 역삼역과 비교해보면 더 재미있는 차이가 있어요. 비교해볼까요? 📊"
- 예: "혹시 이 지역에서 특정 업종을 고민하고 계신다면, 전략 분석도 해드릴 수 있어요! 🎯"

## 응답 포맷
- 차트나 맵이 필요한 분석 결과는 \`[CHART:radar]\`, \`[CHART:bar]\`, \`[MAP:heatmap]\` 태그로 표시하세요.
- 이 태그는 프론트엔드에서 인라인 차트/맵으로 자동 렌더링됩니다.

## 첫 인사 규칙 (⚠️ 최우선)
- 대화 히스토리에 당신의 이전 답변(role: model)이 하나라도 있으면 → 인사 절대 금지. 바로 본론.
- 대화 히스토리에 사용자 메시지만 있으면(첫 대화) → 짧은 인사 1줄: "안녕하세요! 코라 교수에요 🎓"
- 절대로 매 답변마다 "저는 코라 교수예요", "데이터 뒤에 숨은", "구조적 원인과 미래 방향"을 반복하지 마세요.
- 인사 반복은 전문성을 해칩니다. 교수는 매번 자기소개를 하지 않습니다.
`;

// ═══════════════════════════════════════
// Gemini Function Calling 도구 정의
// ═══════════════════════════════════════
const TOOL_DEFINITIONS = [
    {
        name: "analyze_area",
        description: "특정 주소 반경 내의 상권을 종합 분석합니다. 업종 분포, 6대 핵심 지표, 프랜차이즈 비율, AI 코멘트 등을 반환합니다.",
        parameters: {
            type: "object",
            properties: {
                address: { type: "string", description: "분석할 주소 (예: 서울 강남구 테헤란로 152, 판교역, 홍대입구)" },
                radius: { type: "number", description: "분석 반경(미터). 기본값 500" },
                targetCategory: { type: "string", description: "관심 업종 (예: 카페, 음식점, 편의점). 없으면 전체 분석" }
            },
            required: ["address"]
        }
    },
    {
        name: "compare_areas",
        description: "두 지역의 상권을 비교 분석합니다. 어느 쪽이 더 유리한지 종합 비교를 제공합니다.",
        parameters: {
            type: "object",
            properties: {
                address1: { type: "string", description: "첫 번째 비교 주소" },
                address2: { type: "string", description: "두 번째 비교 주소" },
                radius: { type: "number", description: "분석 반경(미터). 기본값 500" }
            },
            required: ["address1", "address2"]
        }
    },
    {
        name: "get_strategy",
        description: "특정 업종으로 특정 지역에서 창업할 때의 필승전략 가이드를 생성합니다.",
        parameters: {
            type: "object",
            properties: {
                address: { type: "string", description: "창업 희망 주소" },
                targetCategory: { type: "string", description: "창업 희망 업종 (예: 카페, 치킨, 미용실)" },
                radius: { type: "number", description: "분석 반경(미터). 기본값 500" }
            },
            required: ["address", "targetCategory"]
        }
    }
];

// ═══════════════════════════════════════
// 도구 실행 함수
// ═══════════════════════════════════════
async function executeTool(toolName, args) {
    switch (toolName) {
        case 'analyze_area': {
            const { address, radius = 500, targetCategory } = args;
            const location = await geocodeAddress(address);
            const stores = await getStoresInRadius(location.latitude, location.longitude, radius);
            const analysis = analyzeDistrict(stores, targetCategory || null);

            let realEstateData = null;
            try {
                const regionInfo = await reverseGeocode(location.latitude, location.longitude);
                if (regionInfo?.code) {
                    realEstateData = await getRealEstateData(regionInfo.code, location, radius);
                }
            } catch (e) { /* 실패해도 무시 */ }

            // 실시간 트렌드 데이터 (체감 온도)
            let trendData = null;
            try {
                // 지역명 추출: 동 > 구 > 주소에서 동명 파싱
                let areaName = location.dong || location.district;
                if (!areaName) {
                    // 주소에서 동/구/로 추출: "서울 성동구 연무장5길 19" → "성동구"
                    const match = address.match(/([\uAC00-\uD7AF]+[\uAD6C\uB3D9\uB85C\uAE38])/g);
                    areaName = match ? match[match.length - 1] : address.split(' ')[1] || address;
                }
                trendData = await getAreaTrend(areaName);
            } catch (e) { console.warn('[Cora] 트렌드 조회 실패:', e.message); }

            const aiComments = await generateSingleAnalysisComment({ analysis, location, realEstateData });

            return {
                success: true,
                location,
                totalStores: analysis.totalStores,
                grade: analysis.grade,
                overallScore: analysis.overallScore,
                indicators: analysis.indicators,
                categorySummary: analysis.categorySummary?.slice(0, 8),
                franchiseAnalysis: {
                    franchiseRatio: analysis.franchiseAnalysis.franchiseRatio,
                    topBrands: analysis.franchiseAnalysis.topBrands?.slice(0, 5)
                },
                targetAnalysis: analysis.targetAnalysis,
                trendData: trendData ? {
                    trendScore: trendData.trendScore,
                    momentum: trendData.momentum,
                    direction: trendData.direction,
                    directionEmoji: trendData.directionEmoji,
                    heatLevel: trendData.heatLevel,
                    interpretation: trendData.interpretation,
                    dataSource: trendData.dataSource
                } : null,
                aiComments: {
                    overview: aiComments.overview,
                    strengths: aiComments.strengths,
                    weaknesses: aiComments.weaknesses,
                    recommendations: aiComments.recommendations
                },
                _chartData: {
                    type: 'radar',
                    labels: Object.values(analysis.indicators).map(i => i.label),
                    values: Object.values(analysis.indicators).map(i => i.value)
                }
            };
        }
        case 'compare_areas': {
            const { address1, address2, radius = 500 } = args;
            const [location1, location2] = await Promise.all([
                geocodeAddress(address1),
                geocodeAddress(address2)
            ]);
            const [stores1, stores2] = await Promise.all([
                getStoresInRadius(location1.latitude, location1.longitude, radius),
                getStoresInRadius(location2.latitude, location2.longitude, radius)
            ]);
            const analysis1 = analyzeDistrict(stores1);
            const analysis2 = analyzeDistrict(stores2);
            const comparison = compareDistricts(analysis1, analysis2);
            const aiComments = generateCompareComment(comparison, location1, location2);

            return {
                success: true,
                area1: { address: address1, score: analysis1.overallScore, grade: analysis1.grade, totalStores: analysis1.totalStores },
                area2: { address: address2, score: analysis2.overallScore, grade: analysis2.grade, totalStores: analysis2.totalStores },
                comparison: comparison.summary,
                recommendation: aiComments.recommendation,
                advantages: aiComments.advantages,
                _chartData: {
                    type: 'comparison',
                    labels: Object.values(analysis1.indicators).map(i => i.label),
                    values1: Object.values(analysis1.indicators).map(i => i.value),
                    values2: Object.values(analysis2.indicators).map(i => i.value),
                    label1: address1,
                    label2: address2
                }
            };
        }
        case 'get_strategy': {
            const { address, targetCategory, radius = 500 } = args;
            const location = await geocodeAddress(address);
            const stores = await getStoresInRadius(location.latitude, location.longitude, radius);
            const analysis = analyzeDistrict(stores, targetCategory);
            const strategy = generateStrategyGuide(analysis, location, targetCategory);

            return {
                success: true,
                address,
                targetCategory,
                grade: analysis.grade,
                overallScore: analysis.overallScore,
                strategy
            };
        }
        default:
            return { error: `알 수 없는 도구: ${toolName}` };
    }
}

// ═══════════════════════════════════════
// 메인 대화 처리 (스트리밍)
// ═══════════════════════════════════════
export async function handleCoraChat(messages, onChunk) {
    const apiKey = GEMINI_API_KEY();
    if (!apiKey) throw new Error('GEMINI_API_KEY가 필요합니다.');

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    // 대화 히스토리 구성
    const contents = messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
    }));

    // 첫 요청: Function Calling 포함
    const requestBody = {
        system_instruction: { parts: [{ text: CORA_SYSTEM_PROMPT }] },
        contents,
        tools: [{
            function_declarations: TOOL_DEFINITIONS
        }],
        tool_config: {
            function_calling_config: { mode: "AUTO" }
        }
    };

    // ─── 도구 결과 토큰 초과 방지 ───
    function truncateToolResult(result) {
        if (!result || typeof result !== 'object') return result;

        const compact = JSON.parse(JSON.stringify(result)); // deep copy

        // 상가 원본 리스트가 있으면 상위 10개만 유지
        const arrayKeys = ['stores', 'rawData', 'storeList', 'items', 'data'];
        for (const key of arrayKeys) {
            if (Array.isArray(compact[key]) && compact[key].length > 10) {
                const total = compact[key].length;
                compact[key] = compact[key].slice(0, 10);
                compact[`${key}_note`] = `총 ${total}건 중 상위 10건만 포함 (토큰 절약)`;
            }
            // nested (ex: compact.analysis.stores)
            if (compact.analysis && Array.isArray(compact.analysis[key]) && compact.analysis[key].length > 10) {
                const total = compact.analysis[key].length;
                compact.analysis[key] = compact.analysis[key].slice(0, 10);
                compact.analysis[`${key}_note`] = `총 ${total}건 중 상위 10건만 포함`;
            }
        }

        // realEstateData 내 listings도 잘라냄
        if (compact.realEstateData?.listings && compact.realEstateData.listings.length > 5) {
            compact.realEstateData.listings = compact.realEstateData.listings.slice(0, 5);
        }

        // 최종 JSON 크기 80KB 제한
        let jsonStr = JSON.stringify(compact);
        if (jsonStr.length > 80000) {
            // aiComment는 보존하고 나머지 큰 필드 제거
            const aiComment = compact.aiComment || compact.analysis?.aiComment || '';
            const summary = compact.analysis?.summary || compact.summary || {};
            const trendData = compact.trendData || null;

            return {
                _truncated: true,
                summary,
                aiComment,
                trendData,
                message: '원본 데이터가 너무 커서 핵심 요약만 전달합니다. 위 summary와 aiComment를 기반으로 답변해주세요.'
            };
        }

        return compact;
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API 오류 (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const candidate = data?.candidates?.[0];
    if (!candidate) throw new Error('Gemini 응답이 없습니다.');

    const parts = candidate.content?.parts || [];
    let textResponse = '';
    let chartData = null;

    for (const part of parts) {
        // 텍스트 응답
        if (part.text) {
            textResponse += part.text;
        }
        // Function Call 요청
        if (part.functionCall) {
            const { name, args } = part.functionCall;
            onChunk({ type: 'status', message: `🔍 ${name === 'analyze_area' ? '상권 분석' : name === 'compare_areas' ? '비교 분석' : '전략 분석'} 중...` });

            try {
                const toolResult = await executeTool(name, args);
                chartData = toolResult._chartData || null;
                delete toolResult._chartData;

                // 토큰 초과 방지: 도구 결과를 요약하여 크기 제한
                const compactResult = truncateToolResult(toolResult);

                // 도구 결과를 Gemini에게 다시 보내서 자연어 응답 생성
                const followUpBody = {
                    system_instruction: { parts: [{ text: CORA_SYSTEM_PROMPT }] },
                    contents: [
                        ...contents,
                        { role: 'model', parts: [{ functionCall: { name, args } }] },
                        { role: 'user', parts: [{ functionResponse: { name, response: compactResult } }] }
                    ],
                    tools: [{ function_declarations: TOOL_DEFINITIONS }],
                    tool_config: { function_calling_config: { mode: "AUTO" } }
                };

                const followUpRes = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(followUpBody)
                });

                if (followUpRes.ok) {
                    const followUpData = await followUpRes.json();
                    const followUpParts = followUpData?.candidates?.[0]?.content?.parts || [];
                    const followUpText = followUpParts.map(p => p.text || '').join('');
                    if (followUpText) {
                        textResponse = followUpText;
                    } else {
                        console.warn('[Cora] followUp 응답에 텍스트 없음. Parts:', JSON.stringify(followUpParts).substring(0, 500));
                        console.warn('[Cora] finishReason:', followUpData?.candidates?.[0]?.finishReason);
                    }
                } else {
                    const errText = await followUpRes.text();
                    console.error('[Cora] followUp API 오류:', followUpRes.status, errText.substring(0, 500));
                }
            } catch (toolError) {
                textResponse = `죄송해요, 분석 중 문제가 발생했어요 😢\n\n**오류:** ${toolError.message}\n\n다시 시도해 보시겠어요?`;
            }
        }
    }

    return { text: textResponse, chartData };
}

// ═══════════════════════════════════════
// 초기 제안 질문
// ═══════════════════════════════════════
export function getCoraSuggestions() {
    return [
        { text: "강남역 근처 상권 분석해줘", icon: "📊" },
        { text: "홍대랑 이태원 비교해줘", icon: "⚖️" },
        { text: "성수동에서 카페 창업 전략 알려줘", icon: "🎯" },
        { text: "요즘 뜨는 상권 어디야?", icon: "🔥" }
    ];
}
