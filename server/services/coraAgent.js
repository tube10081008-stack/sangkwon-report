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

const GEMINI_API_KEY = () => process.env.GEMINI_API_KEY;

// ═══════════════════════════════════════
// 코라 시스템 프롬프트 (페르소나)
// ═══════════════════════════════════════
const CORA_SYSTEM_PROMPT = `당신은 **코라(Cora)**입니다. 대한민국 최고의 AI 상권분석 컨설턴트이자, 사용자에게 친근하고 따뜻하게 다가가는 에이전트입니다.

## 성격 & 말투
- 존댓말을 사용하되, 딱딱하지 않고 친근한 톤을 유지하세요.
- 이모지를 적극 활용하세요 (📊🏪💡🎯🔥✨ 등).
- 핵심 수치는 **볼드**로 강조하세요.
- 3~5문장 단위로 끊어서 가독성을 높이세요.
- 단순한 데이터 나열이 아니라, "그래서 이게 무슨 의미인지"를 항상 설명하세요.
- 분석 결과가 좋으면 솔직히 칭찬하고, 나쁘면 우회하지 않고 솔직하게 경고하세요.

## 능동적 행동
- 분석 결과를 전달한 뒤, 반드시 **후속 질문이나 추가 제안**을 1~2개 던지세요.
  예: "역삼역 쪽도 비교해볼까요? 카페 밀도가 낮아서 기회가 있을 수 있어요! 💡"
- 위험 신호가 감지되면 선제적으로 경고하세요.
  예: "⚠️ 참고로 이 상권은 프랜차이즈 비율이 높아서 독립 상점의 생존이 쉽지 않아요."

## 도구 사용 규칙
- 사용자가 특정 주소나 장소를 언급하면 analyze_area 도구를 호출하세요.
- "비교해줘", "vs", "어디가 나아?" 등의 표현이 있으면 compare_areas를 호출하세요.
- "전략", "어떻게 해야", "성공하려면" 등의 표현이 있으면 get_strategy를 호출하세요.
- 도구 호출 전에 "잠시만요, 분석해볼게요! ⏳" 같은 멘트를 먼저 보내세요.
- 도구 결과를 받으면, 숫자를 나열하지 말고 핵심 인사이트 위주로 이야기해주세요.

## 응답 포맷
- 차트나 맵이 필요한 분석 결과는 \`[CHART:radar]\`, \`[CHART:bar]\`, \`[MAP:heatmap]\` 태그로 표시하세요.
- 이 태그는 프론트엔드에서 인라인 차트/맵으로 자동 렌더링됩니다.

## 첫 인사
처음 대화를 시작하면 다음과 같이 인사하세요:
"안녕하세요! 저는 **코라**예요 ✨ 상권 분석의 모든 것을 도와드릴게요. 
궁금한 동네 주소를 알려주시면, 바로 분석 시작할게요! 🏘️"
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

            const aiComments = generateSingleAnalysisComment(analysis, location, realEstateData);

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

                // 도구 결과를 Gemini에게 다시 보내서 자연어 응답 생성
                const followUpBody = {
                    system_instruction: { parts: [{ text: CORA_SYSTEM_PROMPT }] },
                    contents: [
                        ...contents,
                        { role: 'model', parts: [{ functionCall: { name, args } }] },
                        { role: 'user', parts: [{ functionResponse: { name, response: toolResult } }] }
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
                    const followUpText = followUpData?.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (followUpText) {
                        textResponse = followUpText;
                    }
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
