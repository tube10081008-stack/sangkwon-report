/**
 * 📈 트렌드 데이터 서비스 (Proxy Data) V2
 * 
 * 공공데이터의 분기별 시차(1~2개월)를 보정하기 위해
 * Google Trends 직접 fetch로 '체감 온도' 지표를 생성합니다.
 * 
 * - 비용: 무료
 * - 갱신: 실시간 (최근 90일 기준)
 * - 폴백: 조회 실패 시에도 서비스 전체에 영향 없음
 */

const TREND_CACHE = new Map();
const CACHE_TTL = 1000 * 60 * 60 * 6; // 6시간 캐시

/**
 * Google Trends 직접 호출로 검색 관심도를 조회합니다.
 */
async function fetchGoogleTrends(keyword) {
    // 캐시 확인
    const cached = TREND_CACHE.get(keyword);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`[Trend] 캐시 히트: ${keyword}`);
        return cached.data;
    }

    const encodedKeyword = encodeURIComponent(keyword);
    const url = `https://trends.google.com/trends/api/dailytrends?hl=ko&tz=-540&geo=KR&ns=15`;
    
    // Google Trends의 explore API로 최근 90일 데이터 조회 시도
    const exploreUrl = `https://trends.google.com/trends/api/explore?hl=ko&tz=-540&req=${encodeURIComponent(JSON.stringify({
        comparisonItem: [{ keyword, geo: 'KR', time: 'today 3-m' }],
        category: 0,
        property: ''
    }))}`;

    try {
        const response = await fetch(exploreUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
            }
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const text = await response.text();
        // Google Trends는 ")]}'" prefix를 붙임
        const cleanJson = text.replace(/^\)\]\}\'\n/, '');
        const data = JSON.parse(cleanJson);
        
        // token 추출 후 interestOverTime 호출
        const widgets = data?.widgets || [];
        const timeWidget = widgets.find(w => w.id === 'TIMESERIES');
        
        if (!timeWidget?.token) throw new Error('토큰 없음');
        
        const timeUrl = `https://trends.google.com/trends/api/widgetdata/multiline?hl=ko&tz=-540&req=${encodeURIComponent(JSON.stringify(timeWidget.request))}&token=${timeWidget.token}`;
        
        const timeResponse = await fetch(timeUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        
        const timeText = await timeResponse.text();
        const cleanTimeJson = timeText.replace(/^\)\]\}\'\n/, '');
        const timeData = JSON.parse(cleanTimeJson);
        
        const timeline = timeData?.default?.timelineData || [];
        const values = timeline.map(d => d.value[0]);
        
        TREND_CACHE.set(keyword, { data: values, timestamp: Date.now() });
        return values;
        
    } catch (e) {
        console.warn(`[Trend] Google Trends fetch 실패 (${keyword}):`, e.message);
        return null;
    }
}

/**
 * 특정 상권/지역명의 검색 트렌드를 조회합니다.
 * @param {string} areaName - 상권명 (예: "성수동", "가로수길", "홍대")
 * @returns {Object} 트렌드 분석 결과
 */
export async function getAreaTrend(areaName) {
    try {
        const values = await fetchGoogleTrends(areaName);
        
        if (!values || values.length < 8) {
            // Google Trends 실패 시 → 심플 추정 (검색 결과 수 기반)
            return await estimateTrendFromSearch(areaName);
        }
        
        // 최근 4주 vs 이전 4주 모멘텀
        const recent4w = values.slice(-4);
        const prev4w = values.slice(-8, -4);
        const recentAvg = avg(recent4w);
        const prevAvg = avg(prev4w);
        const momentum = prevAvg > 0 ? ((recentAvg - prevAvg) / prevAvg * 100) : 0;
        
        const peakValue = Math.max(...values);
        const currentValue = values[values.length - 1] || 0;
        const heatLevel = peakValue > 0 ? (currentValue / peakValue) : 0;
        
        const trendScore = calculateTrendScore(recentAvg, momentum, heatLevel);
        
        return buildResult(areaName, trendScore, momentum, heatLevel, recentAvg, peakValue, 'Google Trends (최근 90일)');

    } catch (error) {
        console.warn(`[Trend] ${areaName} 트렌드 최종 실패:`, error.message);
        return await estimateTrendFromSearch(areaName);
    }
}

/**
 * Google Trends 실패 시 대체: 구글 검색 결과 수 기반 추정
 * "[지역명] 맛집", "[지역명] 카페" 등의 검색 결과 수로 상대적 관심도 추정
 */
async function estimateTrendFromSearch(areaName) {
    try {
        // Google Search suggestions를 통한 간접 추정
        const suggestUrl = `https://suggestqueries.google.com/complete/search?client=firefox&hl=ko&q=${encodeURIComponent(areaName + ' ')}`;
        
        const response = await fetch(suggestUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        const suggestions = data[1] || [];
        
        // 자동완성 제안 수 = 인기도 간접 지표
        const suggestionCount = suggestions.length;
        
        // 맛집/카페/핫플 관련 키워드 포함 여부
        const buzzWords = ['맛집', '카페', '핫플', '데이트', '놀거리', '가볼만한', '인스타', '맛집추천'];
        const buzzCount = suggestions.filter(s => buzzWords.some(b => s.includes(b))).length;
        
        // 추정 점수 계산
        const baseScore = Math.min(suggestionCount * 10, 70); // 최대 70점 (제안 7개 이상)
        const buzzBonus = buzzCount * 5; // 버즈워드당 +5
        const trendScore = Math.min(baseScore + buzzBonus, 95);
        
        // 모멘텀은 추정 불가 → 0 (보합)
        const momentum = 0;
        const heatLevel = trendScore / 100;
        
        console.log(`[Trend] ${areaName}: 검색제안 기반 추정 (제안 ${suggestionCount}개, 버즈 ${buzzCount}개) → 체감 ${trendScore}점`);
        
        return buildResult(areaName, trendScore, momentum, heatLevel, trendScore, 100, 
            `Google 자동완성 기반 추정 (제안 ${suggestionCount}개)`);
            
    } catch (e) {
        console.warn(`[Trend] ${areaName} 추정도 실패:`, e.message);
        return buildFallback(areaName, e.message);
    }
}

/**
 * 두 상권의 트렌드를 비교합니다.
 */
export async function compareTrends(area1, area2) {
    const [t1, t2] = await Promise.all([getAreaTrend(area1), getAreaTrend(area2)]);
    
    if (!t1.trendScore && !t2.trendScore) return null;
    
    return {
        [area1]: t1.trendScore || 0,
        [area2]: t2.trendScore || 0,
        winner: (t1.trendScore || 0) > (t2.trendScore || 0) ? area1 : area2,
        summary: `${area1}(${t1.trendScore || '?'}점) vs ${area2}(${t2.trendScore || '?'}점)`,
    };
}

// ═══════════════════════════════════════
// 내부 유틸리티
// ═══════════════════════════════════════

function avg(arr) {
    if (!arr.length) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function calculateTrendScore(currentAvg, momentum, heatLevel) {
    const interestScore = Math.min(currentAvg, 100);
    const momentumScore = Math.min(Math.max(momentum + 50, 0), 100);
    const heatScore = heatLevel * 100;
    return Math.round(interestScore * 0.4 + momentumScore * 0.3 + heatScore * 0.3);
}

function buildResult(areaName, trendScore, momentum, heatLevel, currentAvg, peakValue, dataSource) {
    return {
        areaName,
        trendScore: Math.round(trendScore),
        momentum: Math.round(momentum * 10) / 10,
        heatLevel: Math.round(heatLevel * 100),
        currentInterest: Math.round(currentAvg),
        peakInterest: peakValue,
        direction: momentum > 5 ? '상승' : momentum < -5 ? '하락' : '보합',
        directionEmoji: momentum > 5 ? '📈' : momentum < -5 ? '📉' : '➡️',
        interpretation: interpretTrend(trendScore, momentum, heatLevel),
        dataSource,
        retrievedAt: new Date().toISOString(),
    };
}

function interpretTrend(score, momentum, heatLevel) {
    if (score >= 80 && momentum > 10)
        return '🔥 현재 급상승 중인 핫 상권. 검색 관심도가 피크에 가까우며, 진입 타이밍 신중 판단 필요.';
    if (score >= 60 && momentum > 0)
        return '📈 꾸준한 관심의 안정 상권. 검색량 완만 상승 중이며, 유동인구 증가와 상관관계 높음.';
    if (score >= 40 && momentum < -5)
        return '📉 관심도 하락 추세. 이전에 핫했으나 시들해지는 중, 공실률 상승 선행지표일 수 있음.';
    if (score < 40 && momentum > 10)
        return '🌱 떠오르는 상권. 아직 인지도 낮지만 관심 급증 중, 선점 기회 가능성 있음.';
    if (score < 30)
        return '❄️ 검색 관심도 낮음. 대중적 인지도 부족하나 역으로 젠트리 1단계 가능성.';
    return '➡️ 보합세. 뚜렷한 상승/하락 없이 안정적 관심도 유지 중.';
}

function buildFallback(areaName, reason) {
    return {
        areaName,
        trendScore: null,
        momentum: null,
        heatLevel: null,
        currentInterest: null,
        direction: '조회불가',
        directionEmoji: '❓',
        interpretation: `트렌드 데이터를 조회하지 못했습니다 (${reason}). 공공데이터만으로 분석합니다.`,
        dataSource: 'N/A',
        retrievedAt: new Date().toISOString(),
    };
}
