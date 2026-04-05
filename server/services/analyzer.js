/**
 * 상권 데이터 분석 엔진
 * Shannon Diversity Index, HHI, 포화도, 활력도 등 학술적 분석 기법 적용
 */

import { getCategorySummary, analyzeFranchises } from './storeData.js';

/**
 * 종합 상권 분석 실행
 */
export function analyzeDistrict(stores, targetCategory = null) {
    const totalStores = stores.length;
    const categorySummary = getCategorySummary(stores);
    const franchiseAnalysis = analyzeFranchises(stores);

    // 데이터 품질 체크 — 극단값 방지
    const dataQuality = {
        sufficient: totalStores >= 10,
        level: totalStores === 0 ? 'NONE' : totalStores < 10 ? 'VERY_LOW' : totalStores < 50 ? 'LOW' : totalStores < 200 ? 'MODERATE' : 'GOOD',
        warning: totalStores === 0
            ? '⚠️ 해당 반경 내 상가업소 데이터가 없습니다. 좌표 또는 반경을 조정해보세요.'
            : totalStores < 10
                ? '⚠️ 데이터가 매우 부족하여(10건 미만) 지표 신뢰도가 낮습니다.'
                : null
    };

    // 6대 핵심 지표 산출
    const diversityIndex = calculateDiversityIndex(categorySummary, totalStores);
    const saturationScore = calculateSaturationScore(categorySummary, totalStores);
    const competitionIntensity = calculateHHI(categorySummary, totalStores);
    const franchiseRatio = parseFloat(franchiseAnalysis.franchiseRatio);
    const densityScore = calculateDensityScore(totalStores);
    const stabilityScore = calculateStabilityScore(categorySummary);

    // 종합 점수 산출 (100점 만점)
    const overallScore = calculateOverallScore({
        diversityIndex,
        saturationScore,
        competitionIntensity,
        franchiseRatio,
        densityScore,
        stabilityScore
    });

    const grade = getGrade(overallScore);

    // 타겟 업종 분석
    let targetAnalysis = null;
    if (targetCategory) {
        targetAnalysis = analyzeTargetCategory(stores, categorySummary, targetCategory);
    }

    // 다중 히트맵 데이터 생성
    const validStores = stores.filter(s => s.lat && s.lng);
    const multiHeatmaps = generateMultiHeatmaps(validStores, categorySummary, franchiseAnalysis);

    return {
        totalStores,
        dataQuality,
        categorySummary,
        franchiseAnalysis,
        indicators: {
            diversityIndex: { value: diversityIndex, label: '업종 다양성', description: '다양한 업종이 골고루 분포할수록 높음', max: 100, reliable: dataQuality.sufficient },
            saturationScore: { value: saturationScore, label: '상권 밀집도', description: '업소 밀집 정도 (적정 수준이 좋음)', max: 100, reliable: dataQuality.sufficient },
            competitionIntensity: { value: competitionIntensity, label: '경쟁 균형도', description: '특정 업종 쏠림 없이 균형잡힐수록 높음', max: 100, reliable: dataQuality.sufficient },
            franchiseScore: { value: Math.min(100, 100 - franchiseRatio), label: '독립 상점 비율', description: '독립 상점 비율이 높을수록 진입 기회 많음', max: 100, reliable: dataQuality.sufficient },
            densityScore: { value: densityScore, label: '상권 활성도', description: '적정 수준의 업소 밀도일수록 높음', max: 100, reliable: true },
            stabilityScore: { value: stabilityScore, label: '업종 안정성', description: '안정적인 업종(의료, 교육 등) 비율', max: 100, reliable: dataQuality.sufficient }
        },
        overallScore,
        grade,
        targetAnalysis,
        heatmapData: validStores.map(s => ({
            lat: s.lat,
            lng: s.lng,
            intensity: 1,
            category: s.categoryL,
            name: s.name
        })),
        multiHeatmaps,
        categoryHeatmap: generateCategoryHeatmap(stores)
    };
}

/**
 * Shannon Diversity Index - 업종 다양성
 * H = -Σ(pi * ln(pi)), 정규화하여 0~100 반환
 */
function calculateDiversityIndex(categories, total) {
    if (total === 0 || categories.length === 0) return 0;

    let H = 0;
    categories.forEach(cat => {
        const pi = cat.count / total;
        if (pi > 0) {
            H -= pi * Math.log(pi);
        }
    });

    // 최대 다양성 (모든 업종 균등 분포)
    const Hmax = Math.log(categories.length);
    const evenness = Hmax > 0 ? H / Hmax : 0;

    return Math.round(evenness * 100);
}

/**
 * 포화도 점수 - 적정 밀집도가 가장 좋음 (역 U자 곡선)
 */
function calculateSaturationScore(categories, total) {
    if (total === 0) return 0;

    // 상위 3개 업종의 비율
    const topCategories = categories.slice(0, 3);
    const topRatio = topCategories.reduce((sum, cat) => sum + cat.count, 0) / total;

    // 상위 3개 업종이 50~65%를 차지하면 적정 (100점)
    // 너무 집중(>80%) 또는 너무 분산(<30%)은 감점
    if (topRatio >= 0.50 && topRatio <= 0.65) return 100;
    if (topRatio > 0.65) return Math.max(0, Math.round(100 - (topRatio - 0.65) * 300));
    return Math.max(0, Math.round(100 - (0.50 - topRatio) * 200));
}

/**
 * HHI (Herfindahl-Hirschman Index) - 경쟁 균형도
 * 낮은 HHI = 경쟁 분산 (좋음), 높은 HHI = 독과점 (나쁨)
 * 역으로 변환하여 균형잡힐수록 높은 점수
 */
function calculateHHI(categories, total) {
    if (total === 0) return 0;

    let hhi = 0;
    categories.forEach(cat => {
        const share = (cat.count / total) * 100;
        hhi += share * share;
    });

    // HHI 범위: 10000/N ~ 10000
    // 정규화: 10000이면 독점(0점), 10000/N이면 완전분산(100점)
    const N = categories.length;
    const minHHI = N > 0 ? 10000 / N : 10000;
    const maxHHI = 10000;

    const normalized = 1 - (hhi - minHHI) / (maxHHI - minHHI);
    return Math.max(0, Math.min(100, Math.round(normalized * 100)));
}

/**
 * 상권 활성도 - 업소 밀도 기반
 */
function calculateDensityScore(totalStores) {
    // 반경 500m 기준 적정 업소 수: 300~2000개
    if (totalStores >= 300 && totalStores <= 2000) return 100;
    if (totalStores < 300) return Math.max(20, Math.round((totalStores / 300) * 100));
    if (totalStores > 2000) return Math.max(40, Math.round(100 - ((totalStores - 2000) / 5000) * 60));
    return 50;
}

/**
 * 업종 안정성 - 생활밀착형 업종 비율
 */
function calculateStabilityScore(categories) {
    const stableCategories = ['보건의료', '교육', '부동산', '시설관리·임대', '공공기관'];
    const total = categories.reduce((sum, cat) => sum + cat.count, 0);
    if (total === 0) return 0;

    const stableCount = categories
        .filter(cat => stableCategories.some(sc => cat.name.includes(sc)))
        .reduce((sum, cat) => sum + cat.count, 0);

    const ratio = stableCount / total;
    // 안정 업종 10~25%가 적정
    if (ratio >= 0.10 && ratio <= 0.25) return 100;
    if (ratio < 0.10) return Math.round(ratio * 1000);
    return Math.max(50, Math.round(100 - (ratio - 0.25) * 200));
}

/**
 * 종합 점수 산출 (가중 평균)
 */
function calculateOverallScore(indicators) {
    const weights = {
        diversityIndex: 0.20,
        saturationScore: 0.15,
        competitionIntensity: 0.20,
        franchiseRatio: 0.10,
        densityScore: 0.20,
        stabilityScore: 0.15
    };

    let score = 0;
    score += indicators.diversityIndex * weights.diversityIndex;
    score += indicators.saturationScore * weights.saturationScore;
    score += indicators.competitionIntensity * weights.competitionIntensity;
    score += (100 - indicators.franchiseRatio) * weights.franchiseRatio;
    score += indicators.densityScore * weights.densityScore;
    score += indicators.stabilityScore * weights.stabilityScore;

    return Math.round(score);
}

/**
 * 등급 부여
 */
function getGrade(score) {
    if (score >= 90) return { grade: 'S', label: '최우수', color: '#6366f1', description: '창업에 매우 유리한 최상의 상권입니다.' };
    if (score >= 80) return { grade: 'A', label: '우수', color: '#3b82f6', description: '안정적이고 잠재력 있는 우수 상권입니다.' };
    if (score >= 65) return { grade: 'B', label: '양호', color: '#22c55e', description: '전략적 접근 시 성공 가능성이 높은 상권입니다.' };
    if (score >= 50) return { grade: 'C', label: '보통', color: '#f59e0b', description: '신중한 분석과 전략이 필요한 상권입니다.' };
    return { grade: 'D', label: '주의', color: '#ef4444', description: '진입 시 상당한 리스크를 동반하는 상권입니다.' };
}

/**
 * 타겟 업종 분석
 */
function analyzeTargetCategory(stores, categorySummary, targetCategory) {
    const matchedCategory = categorySummary.find(cat =>
        cat.name.includes(targetCategory) || targetCategory.includes(cat.name)
    );

    const total = stores.length;
    const targetStores = stores.filter(s =>
        s.categoryL.includes(targetCategory) ||
        s.categoryM.includes(targetCategory) ||
        s.categoryS.includes(targetCategory) ||
        targetCategory.includes(s.categoryL) ||
        targetCategory.includes(s.categoryM)
    );

    const competitorCount = targetStores.length;
    const marketShare = total > 0 ? ((competitorCount / total) * 100).toFixed(1) : 0;

    // 포화 상태 판단
    let saturationLevel;
    if (competitorCount <= 5) saturationLevel = { level: '미진입', color: '#22c55e', advice: '경쟁자가 거의 없는 블루오션입니다.' };
    else if (competitorCount <= 20) saturationLevel = { level: '적정', color: '#3b82f6', advice: '적당한 경쟁이 형성된 건강한 시장입니다.' };
    else if (competitorCount <= 50) saturationLevel = { level: '경쟁', color: '#f59e0b', advice: '경쟁이 심한 시장이므로 차별화 전략이 필수입니다.' };
    else saturationLevel = { level: '포화', color: '#ef4444', advice: '이미 포화 상태입니다. 강력한 차별화 없이는 성공이 어렵습니다.' };

    return {
        targetCategory,
        competitorCount,
        marketShare,
        saturationLevel,
        competitors: targetStores.slice(0, 20),
        nearbyCategories: categorySummary.slice(0, 5)
    };
}

/**
 * 업종별 히트맵 데이터 생성
 */
function generateCategoryHeatmap(stores) {
    const categoryGroups = {};

    stores.forEach(store => {
        if (!store.lat || !store.lng) return;
        const cat = store.categoryL;
        if (!categoryGroups[cat]) categoryGroups[cat] = [];
        categoryGroups[cat].push({
            lat: store.lat,
            lng: store.lng,
            name: store.name,
            category: store.categoryM
        });
    });

    return categoryGroups;
}

/**
 * 두 상권 비교 분석
 */
export function compareDistricts(analysis1, analysis2) {
    const comparison = {
        summary: {
            area1: { totalStores: analysis1.totalStores, score: analysis1.overallScore, grade: analysis1.grade },
            area2: { totalStores: analysis2.totalStores, score: analysis2.overallScore, grade: analysis2.grade }
        },
        indicatorComparison: {},
        advantages: { area1: [], area2: [] },
        recommendation: ''
    };

    // 지표별 비교
    const indicatorKeys = Object.keys(analysis1.indicators);
    indicatorKeys.forEach(key => {
        const v1 = analysis1.indicators[key].value;
        const v2 = analysis2.indicators[key].value;
        comparison.indicatorComparison[key] = {
            label: analysis1.indicators[key].label,
            area1: v1,
            area2: v2,
            winner: v1 > v2 ? 'area1' : v1 < v2 ? 'area2' : 'tie',
            diff: Math.abs(v1 - v2)
        };

        if (v1 > v2 + 5) comparison.advantages.area1.push(analysis1.indicators[key].label);
        if (v2 > v1 + 5) comparison.advantages.area2.push(analysis2.indicators[key].label);
    });

    // 종합 추천
    if (analysis1.overallScore > analysis2.overallScore + 10) {
        comparison.recommendation = 'area1';
    } else if (analysis2.overallScore > analysis1.overallScore + 10) {
        comparison.recommendation = 'area2';
    } else {
        comparison.recommendation = 'similar';
    }

    // 업종 분포 비교
    comparison.categoryComparison = compareCategoryDistribution(
        analysis1.categorySummary,
        analysis2.categorySummary
    );

    return comparison;
}

function compareCategoryDistribution(cats1, cats2) {
    const allCategories = new Set([
        ...cats1.map(c => c.name),
        ...cats2.map(c => c.name)
    ]);

    return Array.from(allCategories).map(catName => {
        const c1 = cats1.find(c => c.name === catName);
        const c2 = cats2.find(c => c.name === catName);
        return {
            category: catName,
            area1Count: c1 ? c1.count : 0,
            area1Pct: c1 ? c1.percentage : '0',
            area2Count: c2 ? c2.count : 0,
            area2Pct: c2 ? c2.percentage : '0'
        };
    }).sort((a, b) => (b.area1Count + b.area2Count) - (a.area1Count + a.area2Count));
}

/**
 * 4종 다중 히트맵 데이터 생성
 */
function generateMultiHeatmaps(validStores, categorySummary, franchiseAnalysis) {
    // 1. 전체 업소 밀집도
    const allPoints = validStores.map(s => ({
        lat: s.lat, lng: s.lng, intensity: 1, name: s.name, category: s.categoryL
    }));

    // 2. 상위 3개 업종별 히트맵
    const top3Categories = categorySummary.slice(0, 3).map(c => c.name);
    const categoryColors = ['#6366f1', '#f59e0b', '#06b6d4'];
    const top3Data = top3Categories.map((catName, idx) => {
        const points = validStores
            .filter(s => s.categoryL === catName)
            .map(s => ({ lat: s.lat, lng: s.lng, intensity: 1, name: s.name, category: s.categoryM }));
        return { category: catName, color: categoryColors[idx], count: points.length, points };
    });

    // 3. 소비 활성화 지수 (통합: 유동인구 + 소비 + 생활인프라)
    const SPENDING_KEYWORDS = [
        // 유동인구 관련 (편의점·카페·패스트푸드)
        'CU', 'GS25', '세븐일레븐', '이마트24', '미니스톱',
        '스타벅스', '투썸', '이디야', '메가', '백다방', '컴포즈',
        '맥도날드', '버거킹', '롯데리아', '맘스터치', 'KFC',
        // 소비 활성 (브랜드·소매)
        '올리브영', '다이소', '파리바게뜨', '뚜레쥬르', 'ABC마트',
        '이마트', '홈플러스', '롯데마트', '쿠팡',
        // 생활 인프라 (필수 시설)
        '은행', '약국', '병원', '의원', '치과', '안과', '내과', '정형외과',
        '어린이집', '유치원', '학원', '학교',
        '우체국', '주민센터', '파출소'
    ];
    const SPENDING_CATEGORIES = ['소매', '음식', '보건의료', '교육', '부동산·시설관리'];

    const spendingPoints = validStores.map(s => {
        let intensity = 0;
        // 키워드 매칭: 최고 가중치
        if (SPENDING_KEYWORDS.some(kw => s.name.includes(kw))) {
            intensity = 1.0;
        }
        // 소비·생활 업종: 높은 가중치
        else if (SPENDING_CATEGORIES.some(cat => s.categoryL.includes(cat))) {
            intensity = 0.6;
        }
        // 나머지 업종: 낮은 가중치
        else {
            intensity = 0.1;
        }
        return { lat: s.lat, lng: s.lng, intensity, name: s.name, category: s.categoryL };
    });

    // 4. 야간 경제 활성도 (주점·유흥·오락·편의점 등 야간 운영 업종)
    const NIGHTLIFE_KEYWORDS = [
        // 주점·바
        '호프', '맥주', '포차', '이자카야', '바', 'BAR', 'bar', '술집',
        '와인', '칵테일', '소주방', '막걸리',
        // 오락·여가
        '노래방', '노래연습', '코인노래', 'PC방', 'PC룸', '피씨방',
        '당구', '볼링', '오락실', 'VR', '방탈출', '보드게임',
        // 심야 편의시설
        'CU', 'GS25', '세븐일레븐', '이마트24', '미니스톱',
        // 심야 음식
        '치킨', '피자', '족발', '보쌈', '야식', '포장마차', '곱창', '삼겹',
        '라멘', '라면'
    ];
    const NIGHTLIFE_CATEGORIES = ['숙박', '음식'];
    const NIGHTLIFE_SUBCATEGORIES = ['주점', '유흥', '오락', '스포츠·여가'];

    const nightlifePoints = validStores
        .map(s => {
            let intensity = 0;
            // 야간 키워드 직접 매칭
            if (NIGHTLIFE_KEYWORDS.some(kw => s.name.includes(kw))) {
                intensity = 1.0;
            }
            // 중분류가 야간 관련
            else if (NIGHTLIFE_SUBCATEGORIES.some(sub => s.categoryM.includes(sub))) {
                intensity = 0.9;
            }
            // 숙박·음식 대분류 (일부 야간 관련)
            else if (NIGHTLIFE_CATEGORIES.some(cat => s.categoryL.includes(cat))) {
                intensity = 0.2;
            }
            return { lat: s.lat, lng: s.lng, intensity, name: s.name, category: s.categoryM };
        })
        .filter(p => p.intensity > 0); // 관련 없는 업소 제외 → 분별력 ↑

    return {
        all: { label: '🏪 전체 업소 밀집도', description: '모든 업소의 공간 분포', points: allPoints, colorScheme: 'heat' },
        top3: { label: '🍽️ 상위 업종별 분포', description: `상위 3개 업종: ${top3Categories.join(', ')}`, categories: top3Data, colorScheme: 'categorical' },
        spending: { label: '💳 소비 활성화', description: '소매·음식·생활인프라(의료·교육·금융) 종합 밀집도', points: spendingPoints, colorScheme: 'warm' },
        nightlife: { label: '🌙 야간 경제', description: '주점·오락·심야 편의시설 등 야간 운영 업종 밀집도', points: nightlifePoints, colorScheme: 'cool' }
    };
}

