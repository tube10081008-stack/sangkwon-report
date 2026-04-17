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
import { getRealEstateData } from '../services/realEstateData.js';
import { reverseGeocode } from '../services/geocoding.js';
import { askGemini } from '../services/geminiService.js';
import { buildEmpiricalComparison, generateAICompareComment } from '../services/compareService.js';
import { generateMarketingReport } from '../services/opieService.js';

const router = Router();

/**
 * GET /api/geocode
 * 특정 주소를 위경도로 변환 (3D 스카이뷰 인터랙티브 이동 등 활용)
 */
router.get('/geocode', async (req, res) => {
    try {
        const { address } = req.query;
        if (!address) {
            return res.status(400).json({ error: '주소를 입력해주세요.' });
        }
        const location = await geocodeAddress(address);
        res.json({ success: true, location });
    } catch (error) {
        res.status(404).json({ error: error.message || '지오코딩 실패' });
    }
});

/**
 * POST /api/analyze/heatmap
 * 히트맵 전용 데이터만 빠르게 재렌더링
 */
router.post('/analyze/heatmap', async (req, res) => {
    try {
        const { lat, lng, radius = 500 } = req.body;
        if (!lat || !lng) {
            return res.status(400).json({ error: '위경도 값이 필요합니다.' });
        }
        
        // 1. 상가업소 조회
        const stores = await getStoresInRadius(lat, lng, radius);
        
        // 2. 히트맵 데이터만 추출 (AI 코멘트 없음)
        const analysis = analyzeDistrict(stores, null);
        
        res.json({
            success: true,
            data: {
                multiHeatmaps: analysis.multiHeatmaps,
                heatmapData: analysis.heatmapData
            }
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

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

        // 2. 독립적인 외부 API 사전 병렬 요청 (성능 최적화의 핵심)
        // 가장 오래 걸리는 상가업소 데이터(stores)를 기다리는 동안, 좌표만 있으면 되는 정보들을 백그라운드에서 캐싱
        const pendingTransitInfo = getTransitInfo(location.latitude, location.longitude, radius).catch(e => { console.warn('교통 정보 조회 실패:', e.message); return null; });
        const pendingSeoulData = getSeoulDistrictData(location.latitude, location.longitude).catch(e => { console.warn('서울시 데이터 조회 실패:', e.message); return null; });
        const pendingRegionInfo = reverseGeocode(location.latitude, location.longitude).catch(e => null);

        // 3. 반경 내 상가업소 조회 (병목 구간)
        const stores = await getStoresInRadius(location.latitude, location.longitude, radius);
        console.log(`   업소 수: ${stores.length}개`);

        // 4. 데이터 분석 (의존성: stores)
        const analysis = analyzeDistrict(stores, targetCategory);

        // 5. 종속된 API 병렬 요청
        // demographics는 stores 결과를, realEstate는 regionInfo 결과를 필요로 함
        const pendingDemographics = getDemographics(location.latitude, location.longitude, location, stores).catch(e => { console.warn('인구통계 조회 실패:', e.message); return null; });
        
        const regionInfo = await pendingRegionInfo;
        const bCode = regionInfo ? regionInfo.code : null;
        const pendingRealEstateData = bCode
            ? getRealEstateData(bCode, location, radius).catch(e => { console.warn('부동산 데이터 조회 실패:', e.message); return null; })
            : Promise.resolve(null);

        // 6. 모든 병렬 작업 최종 대기
        const [transitInfo, seoulData, demographics, realEstateData] = await Promise.all([
            pendingTransitInfo,
            pendingSeoulData,
            pendingDemographics,
            pendingRealEstateData
        ]);

        // 💡 단일 진실 원천(Single Source of Truth) 통합 객체 생성
        const integratedAnalysisResult = {
            location,
            radius,
            analysis,
            transitInfo,
            demographics,
            seoulData,
            realEstateData
        };

        // AI 컨설팅 코멘트에 통합 분석 결과 적용 (데이터 파편화 방지)
        const aiComments = await generateSingleAnalysisComment(integratedAnalysisResult);

        res.json({
            success: true,
            data: {
                ...integratedAnalysisResult,
                aiComments,
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
 * 🔥 실증 데이터 기반 매물 비교 분석기 (서울시 12종 API + 교통 + 부동산 + AI)
 */
router.post('/analyze/compare', async (req, res) => {
    try {
        const { address1, address2, radius = 500, targetCategory } = req.body;
        if (!address1 || !address2) {
            return res.status(400).json({ error: '두 주소를 모두 입력해주세요.' });
        }

        console.log(`📊 실증 비교 분석 시작: ${address1} vs ${address2}`);

        // 1. 좌표 변환 (병렬)
        const [location1, location2] = await Promise.all([
            geocodeAddress(address1), geocodeAddress(address2)
        ]);

        // 2. 상가업소 수집 (병렬)
        const [stores1, stores2] = await Promise.all([
            getStoresInRadius(location1.latitude, location1.longitude, radius),
            getStoresInRadius(location2.latitude, location2.longitude, radius)
        ]);

        // 3. 기본 분석
        const analysis1 = analyzeDistrict(stores1, targetCategory);
        const analysis2 = analyzeDistrict(stores2, targetCategory);

        // 4. 실증 데이터 풀 병렬 수집
        let seoul1 = null, seoul2 = null, transit1 = null, transit2 = null;
        let realEstate1 = null, realEstate2 = null, demo1 = null, demo2 = null;
        try {
            const [ri1, ri2] = await Promise.all([
                reverseGeocode(location1.latitude, location1.longitude).catch(() => null),
                reverseGeocode(location2.latitude, location2.longitude).catch(() => null)
            ]);
            [seoul1, seoul2, transit1, transit2, realEstate1, realEstate2, demo1, demo2] = await Promise.all([
                getSeoulDistrictData(location1.latitude, location1.longitude).catch(() => null),
                getSeoulDistrictData(location2.latitude, location2.longitude).catch(() => null),
                getTransitInfo(location1.latitude, location1.longitude, radius).catch(() => null),
                getTransitInfo(location2.latitude, location2.longitude, radius).catch(() => null),
                (ri1?.code ? getRealEstateData(ri1.code, location1, radius) : Promise.resolve(null)).catch(() => null),
                (ri2?.code ? getRealEstateData(ri2.code, location2, radius) : Promise.resolve(null)).catch(() => null),
                getDemographics(location1.latitude, location1.longitude, location1, stores1).catch(() => null),
                getDemographics(location2.latitude, location2.longitude, location2, stores2).catch(() => null),
            ]);
        } catch (e) { console.warn('실증 데이터 수집 부분 실패:', e.message); }

        // 5. 실증 비교 지표
        const empiricalComparison = buildEmpiricalComparison(
            { analysis: analysis1, seoul: seoul1, transit: transit1, demo: demo1, realEstate: realEstate1 },
            { analysis: analysis2, seoul: seoul2, transit: transit2, demo: demo2, realEstate: realEstate2 }
        );

        // 6. AI 비교 코멘트
        const aiCompareComment = await generateAICompareComment(address1, address2, empiricalComparison);

        // 7. 기본 비교
        const comparison = compareDistricts(analysis1, analysis2);

        res.json({
            success: true,
            data: {
                area1: { location: location1, analysis: analysis1, seoul: seoul1, transit: transit1, realEstate: realEstate1, demographics: demo1 },
                area2: { location: location2, analysis: analysis2, seoul: seoul2, transit: transit2, realEstate: realEstate2, demographics: demo2 },
                comparison, empiricalComparison, aiCompareComment,
                radius, generatedAt: new Date().toISOString()
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
        const aiComments = await generateSingleAnalysisComment({ analysis, location, realEstateData: null });

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

/**
 * POST /api/ask-ai
 * 섹션별 Gemini 채팅 연동
 */
router.post('/ask-ai', async (req, res) => {
    try {
        const { prompt, contextData, sectionName } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: '질문(prompt)을 입력해주세요.' });
        }

        console.log(`🤖 AI 질문 요청 수신 [섹션: ${sectionName}] - "${prompt.substring(0, 30)}..."`);

        const systemInstruction = `당신은 대한민국 최고의 상권 분석 및 부동산 실무 전문가입니다. 
제공된 분석 데이터(JSON 형식)를 바탕으로 사용자의 질문에 답하세요. 
데이터에 없는 내용을 지어내지 말고, 데이터에 기반한 날카로운 인사이트만 제공하세요.`;

        const answer = await askGemini(prompt, contextData, systemInstruction);

        res.json({
            success: true,
            answer: answer
        });

    } catch (error) {
        console.error('AI 질문 오류:', error);
        res.status(500).json({ error: error.message || 'AI 서버 통신 중 오류가 발생했습니다.' });
    }
});

/**
 * POST /api/opie/generate
 * 오피(Opie) 브랜딩 리포트 생성
 */
router.post('/opie/generate', async (req, res) => {
    try {
        const { district, agencyName, brokerName, phone } = req.body;
        
        if (!district || !agencyName || !brokerName || !phone) {
            return res.status(400).json({ error: '지점, 연락처 등 필수 정보가 누락되었습니다.' });
        }

        const reportMarkdown = await generateMarketingReport(district, agencyName, brokerName, phone);
        
        res.json({
            success: true,
            markdown: reportMarkdown
        });

    } catch (error) {
        console.error('[Opie] 브랜딩 리포트 생성 실패:', error);
        res.status(500).json({ error: '컨텐츠 생성 중 오류가 발생했습니다.' });
    }
});

export default router;
