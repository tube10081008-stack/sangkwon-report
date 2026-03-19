// 내장 fetch API 사용 (Node.js 18+)

/**
 * Google Gemini API 연동 모듈
 * 기본 모델: gemini-2.5-flash
 */

export async function askGemini(prompt, contextData, systemInstruction) {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY가 서버에 설정되지 않았습니다.');
    }

    // 최신/가장 빠르고 가성비 좋은 모델: gemini-2.5-flash
    // 상권 분석 데이터(JSON)를 읽고 답변하는 태스크에 가장 적합합니다.
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    // 프롬프트 구성: 시스템 인스트럭션 + 제공된 컨텍스트(데이터) + 사용자의 실제 질문
    let fullPrompt = `${systemInstruction}\n\n`;
    if (contextData) {
        fullPrompt += `[분석할 핵심 데이터 (Context)]\n`;
        // 객체일 경우 보기 편하게 JSON 변환
        fullPrompt += typeof contextData === 'object' ? JSON.stringify(contextData, null, 2) : contextData;
        fullPrompt += `\n\n`;
    }
    fullPrompt += `[사용자 질문]\n${prompt}\n\n[답변 형식]\n가독성있게 마크다운과 이모지를 사용해서 3-4문단 내외로 간결하게 핵심만 답변하세요.`;

    const requestBody = {
        contents: [
            {
                role: "user",
                parts: [{ text: fullPrompt }]
            }
        ]
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini API 오류 (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        const aiAnswer = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!aiAnswer) {
            throw new Error('Gemini API에서 유효한 응답을 받지 못했습니다.');
        }

        return aiAnswer;

    } catch (error) {
        console.error('askGemini 에러:', error);
        throw error;
    }
}
