/**
 * 🤖 Agent API Routes
 * 
 * 에이전트 루프 시스템의 REST API 엔드포인트
 */

import { Router } from 'express';
import {
    runLoop,
    getTodayDistrict,
    getLoopHistory,
    getLoopDetail,
    getCurrentLoopStatus,
    setCurrentLoop,
    getAvailableDistricts,
    getOverallStats
} from '../agents/loopController.js';

const router = Router();

/**
 * GET /api/agent/status
 * 전체 통계 및 현재 상태
 */
router.get('/status', (req, res) => {
    try {
        const stats = getOverallStats();
        const currentLoop = getCurrentLoopStatus();
        res.json({
            success: true,
            data: {
                stats,
                currentLoop,
                todayDistrict: getTodayDistrict()
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/agent/run-loop
 * 루프 1사이클 실행 (수동 트리거)
 */
router.post('/run-loop', async (req, res) => {
    const { district } = req.body;

    // 이미 실행 중인 루프가 있는지 확인
    const current = getCurrentLoopStatus();
    if (current && current.status === 'running') {
        return res.status(409).json({
            error: '이미 실행 중인 루프가 있습니다.',
            currentLoop: current
        });
    }

    try {
        // 비동기로 루프 실행 (즉시 응답)
        const targetDistrict = district || getTodayDistrict();
        
        setCurrentLoop({
            status: 'running',
            district: targetDistrict,
            startedAt: new Date().toISOString()
        });

        res.json({
            success: true,
            message: `${targetDistrict} 루프 실행을 시작했습니다.`,
            district: targetDistrict
        });

        // 백그라운드 실행
        runLoop(targetDistrict)
            .then(result => {
                setCurrentLoop({
                    status: 'completed',
                    district: targetDistrict,
                    completedAt: new Date().toISOString(),
                    result: {
                        totalIssues: result.inspectionReport?.totalIssuesFound || 0,
                        autoFixed: result.autoFixResult?.applied?.length || 0,
                        elapsedSeconds: result.elapsedSeconds
                    }
                });
            })
            .catch(error => {
                setCurrentLoop({
                    status: 'failed',
                    district: targetDistrict,
                    error: error.message,
                    failedAt: new Date().toISOString()
                });
            });

    } catch (error) {
        setCurrentLoop(null);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/agent/history
 * 루프 히스토리 조회
 */
router.get('/history', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 30;
        const history = getLoopHistory(limit);
        res.json({ success: true, data: history });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/agent/history/:filename
 * 특정 루프 상세 조회
 */
router.get('/history/:filename', (req, res) => {
    try {
        const detail = getLoopDetail(req.params.filename);
        if (!detail) {
            return res.status(404).json({ error: '루프 결과를 찾을 수 없습니다.' });
        }
        res.json({ success: true, data: detail });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/agent/districts
 * 사용 가능한 구 목록
 */
router.get('/districts', (req, res) => {
    try {
        const districts = getAvailableDistricts();
        res.json({ success: true, data: districts });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/agent/today
 * 오늘의 검증 대상
 */
router.get('/today', (req, res) => {
    try {
        const district = getTodayDistrict();
        const districts = getAvailableDistricts();
        const todayData = districts.find(d => d.name === district);
        res.json({
            success: true,
            data: {
                district,
                ...todayData
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
