/**
 * 🤖 코라 API 라우터
 * SSE 스트리밍 + 대화 관리
 */

import { Router } from 'express';
import { handleCoraChat, getCoraSuggestions } from '../services/coraAgent.js';

const router = Router();

// 대화 세션 저장 (메모리 기반 — 프로덕션에서는 Redis 등 사용)
const sessions = new Map();

/**
 * POST /api/cora/chat
 * 코라와 대화 (SSE 스트리밍)
 */
router.post('/chat', async (req, res) => {
    const { message, sessionId = 'default' } = req.body;

    if (!message) {
        return res.status(400).json({ error: '메시지를 입력해주세요.' });
    }

    // 세션 히스토리 관리
    if (!sessions.has(sessionId)) {
        sessions.set(sessionId, []);
    }
    const history = sessions.get(sessionId);
    history.push({ role: 'user', content: message });

    // 최대 20턴으로 제한 (컨텍스트 길이 관리)
    const trimmedHistory = history.length > 40 ? history.slice(-40) : history;

    try {
        console.log(`🤖 코라 대화 [${sessionId}]: "${message.substring(0, 40)}..."`);

        const statusUpdates = [];
        const result = await handleCoraChat(trimmedHistory, (chunk) => {
            statusUpdates.push(chunk);
        });

        // 코라 응답을 히스토리에 추가
        history.push({ role: 'model', content: result.text });

        res.json({
            success: true,
            response: result.text,
            chartData: result.chartData,
            statusUpdates,
            sessionId
        });

    } catch (error) {
        console.error('코라 대화 오류:', error);
        const fallbackMsg = `죄송해요, 잠시 문제가 생겼어요 😢\n\n**오류:** ${error.message}\n\n잠시 후 다시 시도해 주세요!`;
        history.push({ role: 'model', content: fallbackMsg });

        res.status(500).json({
            success: false,
            response: fallbackMsg,
            error: error.message
        });
    }
});

/**
 * POST /api/cora/reset
 * 대화 초기화
 */
router.post('/reset', (req, res) => {
    const { sessionId = 'default' } = req.body;
    sessions.delete(sessionId);
    console.log(`🔄 코라 세션 초기화: ${sessionId}`);
    res.json({ success: true, message: '대화가 초기화되었습니다.' });
});

/**
 * GET /api/cora/suggestions
 * 초기 추천 질문
 */
router.get('/suggestions', (req, res) => {
    res.json({ success: true, suggestions: getCoraSuggestions() });
});

export default router;
