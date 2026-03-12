/**
 * API 라우트
 * 3종 리포트 엔드포인트
 */

import { Router } from 'express';
import { geocodeAddress } from '../services/geocoding.js';
import { getStoresInRadius } from '../services/storeData.js';
import { analyzeDistrict, compareDistricts } from '../services/analyzer.js';
import { generateSingleAnalysisComment, generateCompareComment, generateStrategyGuide } from '../services/aiConsultant.js';
import { getTransitInfo } from '../services/transitData.js';
import { getDemographics } from '../services/demographicData.js';
import { getSeoulDistrictData } from '../services/seoulData.js';

const router = Router();

/**
 * POST /api/analyze/single
 * 단일 상권 분석
 */
router.post('/analyze/single', async (req, res) => {
    try {
        const { address, radius = 500, targetCategory } = req.body;

        if (!address) {
            return res.status(400).json({ error: '주소를 입력해주세요.' });
        }

        console.log(`📍 단일 상권 분석 시작: ${address} (반경 ${radius}m)`);

        // 1. 주소 → 좌표 변환
        const location = await geocodeAddress(address);
        console.log(`   좌표: ${location.latitude}, ${location.longitude}`);

        // 2. 반경 내 상가업소 조회
        const stores = await getStoresInRadius(location.latitude, location.longitude, radius);
        console.log(`   업소 수: ${stores.length}개`);

        // 3. 데이터 분석
        const analysis = analyzeDistrict(stores, targetCategory);

        // 4. AI 컨설팅 코멘트
        const aiComments = generateSingleAnalysisComment(analysis, location);

        // 5. 교통 접근성 & 인구통계 & 서울시 데이터 (병렬 조회 - 실패해도 메인 분석에 영향 없음)
        let transitInfo = null;
        let demographics = null;
        let seoulData = null;
        try {
            [transitInfo, demographics, seoulData] = await Promise.all([
                getTransitInfo(location.latitude, location.longitude, radius).catch(e => { console.warn('교통 정보 조회 실패:', e.message); return null; }),
                getDemographics(location.latitude, location.longitude, location, stores).catch(e => { console.warn('인구통계 조회 실패:', e.message); return null; }),
                getSeoulDistrictData(location.latitude, location.longitude).catch(e => { console.warn('서울시 데이터 조회 실패:', e.message); return null; })
            ]);
        } catch (e) {
            console.warn('프리미엄 데이터 조회 실패:', e.message);
        }

        res.json({
            success: true,
            data: {
                location,
                radius,
                analysis,
                aiComments,
                transitInfo,
                demographics,
                seoulData,
                generatedAt: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('단일 분석 오류:', error);
        res.status(500).json({ error: error.message || '분석 중 오류가 발생했습니다.' });
    }
});

/**
 * POST /api/analyze/compare
 * 두 상권 비교 분석
 */
router.post('/analyze/compare', async (req, res) => {
    try {
        const { address1, address2, radius = 500, targetCategory } = req.body;

        if (!address1 || !address2) {
            return res.status(400).json({ error: '두 주소를 모두 입력해주세요.' });
        }

        console.log(`📊 비교 분석 시작: ${address1} vs ${address2}`);

        // 1. 두 주소 좌표 변환 (병렬)
        const [location1, location2] = await Promise.all([
            geocodeAddress(address1),
            geocodeAddress(address2)
        ]);

        // 2. 반경 내 상가업소 조회 (병렬)
        const [stores1, stores2] = await Promise.all([
            getStoresInRadius(location1.latitude, location1.longitude, radius),
            getStoresInRadius(location2.latitude, location2.longitude, radius)
        ]);

        // 3. 개별 분석
        const analysis1 = analyzeDistrict(stores1, targetCategory);
        const analysis2 = analyzeDistrict(stores2, targetCategory);

        // 4. 비교 분석
        const comparison = compareDistricts(analysis1, analysis2);

        // 5. AI 비교 코멘트
        const aiComments = generateCompareComment(comparison, location1, location2);

        res.json({
            success: true,
            data: {
                area1: { location: location1, analysis: analysis1 },
                area2: { location: location2, analysis: analysis2 },
                comparison,
                aiComments,
                radius,
                generatedAt: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('비교 분석 오류:', error);
        res.status(500).json({ error: error.message || '비교 분석 중 오류가 발생했습니다.' });
    }
});

/**
 * POST /api/analyze/strategy
 * 필승전략 가이드
 */
router.post('/analyze/strategy', async (req, res) => {
    try {
        const { address, radius = 500, targetCategory } = req.body;

        if (!address || !targetCategory) {
            return res.status(400).json({ error: '주소와 희망 업종을 모두 입력해주세요.' });
        }

        console.log(`🎯 필승전략 분석 시작: ${address} / ${targetCategory}`);

        // 1. 주소 → 좌표 변환
        const location = await geocodeAddress(address);

        // 2. 반경 내 상가업소 조회
        const stores = await getStoresInRadius(location.latitude, location.longitude, radius);

        // 3. 데이터 분석 (타겟 업종 포함)
        const analysis = analyzeDistrict(stores, targetCategory);

        // 4. AI 컨설팅 코멘트
        const aiComments = generateSingleAnalysisComment(analysis, location);

        // 5. 필승전략 가이드
        const strategy = generateStrategyGuide(analysis, location, targetCategory);

        res.json({
            success: true,
            data: {
                location,
                radius,
                analysis,
                aiComments,
                strategy,
                targetCategory,
                generatedAt: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('전략 분석 오류:', error);
        res.status(500).json({ error: error.message || '전략 분석 중 오류가 발생했습니다.' });
    }
});

/**
 * 리포트 저장소 (메모리 기반)
 * 프로덕션에서는 DB로 교체 필요
 */
const reportStore = new Map();

function generateId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let id = '';
    for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return id;
}

/**
 * POST /api/reports
 * 리포트 데이터 저장 후 공유 ID 반환
 */
router.post('/reports', (req, res) => {
    try {
        const { type, data, address1, address2, targetCategory, radius } = req.body;
        if (!data) return res.status(400).json({ error: '리포트 데이터가 없습니다.' });

        const id = generateId();
        reportStore.set(id, {
            type, data, address1, address2, targetCategory, radius,
            createdAt: new Date().toISOString()
        });

        console.log(`📎 리포트 저장: ${id} (${type})`);
        res.json({ success: true, id });
    } catch (error) {
        console.error('리포트 저장 오류:', error);
        res.status(500).json({ error: '리포트 저장 중 오류가 발생했습니다.' });
    }
});

/**
 * GET /api/reports/:id
 * 저장된 리포트 조회
 */
router.get('/reports/:id', (req, res) => {
    const report = reportStore.get(req.params.id);
    if (!report) {
        return res.status(404).json({ error: '리포트를 찾을 수 없습니다. 링크가 만료되었거나 잘못되었습니다.' });
    }
    res.json({ success: true, report });
});

/**
 * GET /api/health
 * 서버 상태 확인
 */
router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
