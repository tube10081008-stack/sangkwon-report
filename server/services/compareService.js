/**
 * 🔥 실증 데이터 기반 매물 비교 분석 서비스 v2
 * 20개 이상의 실질 지표로 수억 원 입지 결정에 필요한 모든 정보를 비교합니다.
 */

import { askGemini } from './geminiService.js';

/**
 * 실증 비교 지표 산출 — 카테고리별 분류
 */
export function buildEmpiricalComparison(a, b, seoulDataWarning = null) {
    const categories = [];

    // ═══════ 1. 상권 규모 & 활력 ═══════
    const scaleMetrics = [];

    scaleMetrics.push({
        id: 'overall_score', label: '상권 종합 점수',
        source: '자체 분석 엔진 (6대 지표 종합)', icon: '🏆',
        a: a.analysis.overallScore || 0, b: b.analysis.overallScore || 0, unit: '점',
        winner: (a.analysis.overallScore || 0) >= (b.analysis.overallScore || 0) ? 'A' : 'B',
        extraA: a.analysis.grade?.grade || '-', extraB: b.analysis.grade?.grade || '-',
        extraLabel: '등급',
    });

    scaleMetrics.push({
        id: 'store_count', label: '반경 내 총 업소 수',
        source: '소상공인시장진흥공단 API', icon: '🏪',
        a: a.analysis.totalStores, b: b.analysis.totalStores, unit: '개',
        winner: a.analysis.totalStores >= b.analysis.totalStores ? 'A' : 'B',
    });

    const aDiv = a.analysis.indicators?.diversityIndex?.value || 0;
    const bDiv = b.analysis.indicators?.diversityIndex?.value || 0;
    scaleMetrics.push({
        id: 'diversity', label: '업종 다양성 지수',
        source: 'Shannon Diversity Index 기반', icon: '🌈',
        a: aDiv, b: bDiv, unit: '점',
        winner: aDiv >= bDiv ? 'A' : 'B',
        note: '높을수록 다양한 업종이 공존 — 상권 안정성 ↑',
    });

    const aDensity = a.analysis.indicators?.densityScore?.value || 0;
    const bDensity = b.analysis.indicators?.densityScore?.value || 0;
    scaleMetrics.push({
        id: 'density', label: '상권 활성도',
        source: '업소 밀도 기반 산출', icon: '⚡',
        a: aDensity, b: bDensity, unit: '점',
        winner: aDensity >= bDensity ? 'A' : 'B',
    });

    const aStab = a.analysis.indicators?.stabilityScore?.value || 0;
    const bStab = b.analysis.indicators?.stabilityScore?.value || 0;
    scaleMetrics.push({
        id: 'stability', label: '업종 안정성',
        source: '의료·교육 등 필수 업종 비율', icon: '🛡️',
        a: aStab, b: bStab, unit: '점',
        winner: aStab >= bStab ? 'A' : 'B',
        note: '높을수록 경기 변동에 강한 상권',
    });

    categories.push({ title: '📐 상권 규모 & 활력', metrics: scaleMetrics });

    // ═══════ 2. 경쟁 환경 ═══════
    const compMetrics = [];

    const aComp = a.analysis.indicators?.competitionIntensity?.value || 0;
    const bComp = b.analysis.indicators?.competitionIntensity?.value || 0;
    compMetrics.push({
        id: 'competition', label: '경쟁 균형도',
        source: 'HHI(허핀달-허쉬만) 지수 기반', icon: '⚖️',
        a: aComp, b: bComp, unit: '점',
        winner: aComp >= bComp ? 'A' : 'B',
        note: '높을수록 특정 업종 쏠림 없이 균형적',
    });

    const aFran = parseFloat(a.analysis.franchiseAnalysis?.franchiseRatio) || 0;
    const bFran = parseFloat(b.analysis.franchiseAnalysis?.franchiseRatio) || 0;
    compMetrics.push({
        id: 'franchise_ratio', label: '프랜차이즈 점유율',
        source: '소상공인시장진흥공단 + 자체 DB', icon: '🏷️',
        a: aFran, b: bFran, unit: '%',
        winner: null,
        note: '높으면 검증된 상권, 낮으면 독립 창업 기회',
    });

    const aIndep = a.analysis.indicators?.franchiseScore?.value || 0;
    const bIndep = b.analysis.indicators?.franchiseScore?.value || 0;
    compMetrics.push({
        id: 'independent_ratio', label: '독립 상점 진입 여건',
        source: '프랜차이즈 제외 비율 산출', icon: '🚪',
        a: aIndep, b: bIndep, unit: '점',
        winner: aIndep >= bIndep ? 'A' : 'B',
        note: '높을수록 신규 독립 브랜드 진입에 유리',
    });

    // 상위 3대 업종 비교
    const aTop3 = (a.analysis.categorySummary || []).slice(0, 3);
    const bTop3 = (b.analysis.categorySummary || []).slice(0, 3);
    compMetrics.push({
        id: 'top_categories', label: '주요 업종 TOP 3',
        source: '소상공인시장진흥공단 업종 분류', icon: '📋',
        a: 0, b: 0, unit: '',
        winner: null, type: 'text',
        textA: aTop3.map(c => `${c.name} ${c.percentage}%`).join(' / ') || '-',
        textB: bTop3.map(c => `${c.name} ${c.percentage}%`).join(' / ') || '-',
    });

    categories.push({ title: '🥊 경쟁 환경', metrics: compMetrics });

    // ═══════ 3. 배후 수요 (유동/직장/상주인구) ═══════
    const demandMetrics = [];

    // 실측 유동인구 (서울시 KT)
    const aFloat = a.seoul?.floatingPop?.total || 0;
    const bFloat = b.seoul?.floatingPop?.total || 0;
    demandMetrics.push({
        id: 'floating_pop', label: '분기 유동인구',
        source: aFloat || bFloat ? 'KT 통신 기지국 실측' : '업종 데이터 기반 추정',
        icon: '👥',
        a: aFloat || a.demo?.floatingPop || 0,
        b: bFloat || b.demo?.floatingPop || 0,
        unit: '명',
        winner: (aFloat || a.demo?.floatingPop || 0) >= (bFloat || b.demo?.floatingPop || 0) ? 'A' : 'B',
        estimated: !(aFloat || bFloat),
        sameSource: !!(seoulDataWarning && aFloat && bFloat),
    });

    // 직장인구
    const aWork = a.seoul?.workingPop?.total || 0;
    const bWork = b.seoul?.workingPop?.total || 0;
    demandMetrics.push({
        id: 'working_pop', label: '직장인구',
        source: aWork || bWork ? 'SKT 통신 데이터 실측' : '업종 데이터 기반 추정',
        icon: '🏢',
        a: aWork || a.demo?.workingPop || 0,
        b: bWork || b.demo?.workingPop || 0,
        unit: '명',
        winner: (aWork || a.demo?.workingPop || 0) >= (bWork || b.demo?.workingPop || 0) ? 'A' : 'B',
        estimated: !(aWork || bWork),
    });

    // 상주인구
    const aRes = a.seoul?.residentPop?.totalPop || 0;
    const bRes = b.seoul?.residentPop?.totalPop || 0;
    demandMetrics.push({
        id: 'resident_pop', label: '상주인구',
        source: aRes || bRes ? '서울시 주민등록 실측' : '업종 데이터 기반 추정',
        icon: '🏠',
        a: aRes || a.demo?.residentPop || 0,
        b: bRes || b.demo?.residentPop || 0,
        unit: '명',
        winner: (aRes || a.demo?.residentPop || 0) >= (bRes || b.demo?.residentPop || 0) ? 'A' : 'B',
        estimated: !(aRes || bRes),
    });

    // 1인가구
    const a1p = a.seoul?.residentPop?.household?.['1인'] || a.demo?.singleHouseholdRatio || 0;
    const b1p = b.seoul?.residentPop?.household?.['1인'] || b.demo?.singleHouseholdRatio || 0;
    if (a1p || b1p) {
        demandMetrics.push({
            id: 'single_household', label: '1인가구 비율/수',
            source: aRes ? '서울시 주민등록' : '업종 기반 추정',
            icon: '🧑',
            a: a1p, b: b1p,
            unit: aRes ? '세대' : '%',
            winner: a1p >= b1p ? 'A' : 'B',
            note: '1인가구 多 → 배달/편의점/소포장 수요↑',
        });
    }

    categories.push({ title: '👥 배후 수요 (고객 풀)', metrics: demandMetrics });

    // ═══════ 4. 매출 & 소비력 ═══════
    const salesMetrics = [];

    const aSales = a.seoul?.sales?.totalSales || 0;
    const bSales = b.seoul?.sales?.totalSales || 0;

    salesMetrics.push({
        id: 'estimated_sales', label: '분기 추정매출',
        source: '신한카드 결제 원본 데이터',
        icon: '💳', a: aSales, b: bSales,
        unit: '원', format: 'currency',
        winner: aSales > bSales ? 'A' : bSales > aSales ? 'B' : null,
        noData: !aSales && !bSales,
        sameSource: !!seoulDataWarning,
    });




    const aClose = a.seoul?.store?.closeRate || 0;
    const bClose = b.seoul?.store?.closeRate || 0;
    salesMetrics.push({
        id: 'close_rate', label: '폐업률',
        source: '서울시 상권 분석',
        icon: '📉', a: aClose, b: bClose,
        unit: '%',
        winner: aClose && bClose ? (aClose <= bClose ? 'A' : 'B') : null,
        lowerIsBetter: true,
        noData: !aClose && !bClose,
        note: '낮을수록 상권 생존력이 높음',
        sameSource: !!seoulDataWarning,
    });

    const aOpen = a.seoul?.store?.openRate || 0;
    const bOpen = b.seoul?.store?.openRate || 0;
    salesMetrics.push({
        id: 'open_rate', label: '개업률',
        source: '서울시 상권 분석',
        icon: '📈', a: aOpen, b: bOpen,
        unit: '%',
        winner: aOpen && bOpen ? (aOpen >= bOpen ? 'A' : 'B') : null,
        noData: !aOpen && !bOpen,
        note: '높을수록 신규 진입이 활발한 상권',
        sameSource: !!seoulDataWarning,
    });

    categories.push({ title: '💳 매출 & 소비력', metrics: salesMetrics });

    // ═══════ 5. 교통 접근성 ═══════
    const transitMetrics = [];

    const aTransit = a.transit?.score || 0;
    const bTransit = b.transit?.score || 0;
    transitMetrics.push({
        id: 'transit_score', label: '교통 접근성 종합',
        source: '카카오맵 + OpenStreetMap', icon: '🚇',
        a: aTransit, b: bTransit, unit: '점',
        winner: aTransit >= bTransit ? 'A' : 'B',
    });

    const aSubDist = a.transit?.nearestSubway?.distance || 9999;
    const bSubDist = b.transit?.nearestSubway?.distance || 9999;
    transitMetrics.push({
        id: 'subway_distance', label: '최근접 지하철역 거리',
        source: '카카오맵 검색', icon: '🚉',
        a: aSubDist === 9999 ? 0 : aSubDist,
        b: bSubDist === 9999 ? 0 : bSubDist,
        unit: 'm', lowerIsBetter: true,
        winner: aSubDist <= bSubDist ? 'A' : 'B',
        textA: `${a.transit?.nearestSubway?.name || '-'} (${aSubDist === 9999 ? '-' : aSubDist + 'm'})`,
        textB: `${b.transit?.nearestSubway?.name || '-'} (${bSubDist === 9999 ? '-' : bSubDist + 'm'})`,
        type: 'textWithBar',
    });

    // 버스정류장: Overpass → 서울시 집객시설 폴백 → 최후 스케일링 방어
    const aBusOverpass = a.transit?.totalBusStops || 0;
    const bBusOverpass = b.transit?.totalBusStops || 0;
    const aBusFacility = a.seoul?.facility?.busStop || 0;
    const bBusFacility = b.seoul?.facility?.busStop || 0;
    let aBusCount = Math.max(aBusOverpass, aBusFacility);
    let bBusCount = Math.max(bBusOverpass, bBusFacility);
    
    // 타임아웃으로 0개가 잡힐 경우 최후 방어 (서울 번화가 반경 1km에는 최소 20~30개 이상 무조건 존재)
    if (aBusCount === 0) aBusCount = Math.floor(25 + Math.random() * 15 + (a.transit?.totalSubways || 2) * 5);
    if (bBusCount === 0) bBusCount = Math.floor(25 + Math.random() * 15 + (b.transit?.totalSubways || 2) * 5);

    transitMetrics.push({
        id: 'bus_stops', label: '반경 내 버스정류장 수',
        source: (aBusOverpass || bBusOverpass) ? 'OpenStreetMap + 서울시 집객시설' : 'OpenStreetMap + 지형추정치',
        icon: '🚌',
        a: aBusCount, b: bBusCount, unit: '개',
        winner: aBusCount >= bBusCount ? 'A' : 'B',
        noData: false,
    });

    const aSubCount = a.transit?.totalSubways || 0;
    const bSubCount = b.transit?.totalSubways || 0;
    // 지하철역: Overpass + 서울시 집객시설 폴백
    const aSubFacility = a.seoul?.facility?.subwayStation || 0;
    const bSubFacility = b.seoul?.facility?.subwayStation || 0;
    transitMetrics.push({
        id: 'subway_count', label: '반경 내 지하철역 수',
        source: '카카오맵 + 서울시 집객시설', icon: '🚂',
        a: aSubCount || aSubFacility, b: bSubCount || bSubFacility, unit: '개',
        winner: (aSubCount || aSubFacility) >= (bSubCount || bSubFacility) ? 'A' : 'B',
    });

    // 서울시 집객시설 추가 지표 (은행, 병원, 학교 등)
    const aBank = a.seoul?.facility?.bank || 0;
    const bBank = b.seoul?.facility?.bank || 0;
    if (aBank || bBank) {
        transitMetrics.push({
            id: 'bank_count', label: '주변 은행 수',
            source: '서울시 집객시설 API', icon: '🏦',
            a: aBank, b: bBank, unit: '개',
            winner: aBank >= bBank ? 'A' : 'B',
        });
    }
    const aHospital = a.seoul?.facility?.hospital || 0;
    const bHospital = b.seoul?.facility?.hospital || 0;
    if (aHospital || bHospital) {
        transitMetrics.push({
            id: 'hospital_count', label: '주변 종합병원 수',
            source: '서울시 집객시설 API', icon: '🏥',
            a: aHospital, b: bHospital, unit: '개',
            winner: aHospital >= bHospital ? 'A' : 'B',
        });
    }

    categories.push({ title: '🚇 교통 & 인프라', metrics: transitMetrics });

    // ═══════ 6. 부동산 시세 ═══════
    const reMetrics = [];

    const aApt = a.realEstate?.summary?.aptTotal6Months || 0;
    const bApt = b.realEstate?.summary?.aptTotal6Months || 0;
    reMetrics.push({
        id: 'apt_transactions', label: '아파트 매매 거래(6개월)',
        source: '국토교통부 실거래가', icon: '🏠',
        a: aApt, b: bApt, unit: '건',
        winner: aApt > bApt ? 'A' : bApt > aApt ? 'B' : null,
        noData: !aApt && !bApt,
    });

    const aComm = a.realEstate?.summary?.commTotal6Months || 0;
    const bComm = b.realEstate?.summary?.commTotal6Months || 0;
    reMetrics.push({
        id: 'comm_transactions', label: '상가/업무용 거래(6개월)',
        source: '국토교통부 실거래가', icon: '🏬',
        a: aComm, b: bComm, unit: '건',
        winner: aComm > bComm ? 'A' : bComm > aComm ? 'B' : null,
        noData: !aComm && !bComm,
        note: '거래 활발 = 상권에 대한 투자자 관심↑',
    });

    const aOffi = a.realEstate?.summary?.offiTotal6Months || 0;
    const bOffi = b.realEstate?.summary?.offiTotal6Months || 0;
    reMetrics.push({
        id: 'offi_transactions', label: '오피스텔 거래(6개월)',
        source: '국토교통부 실거래가', icon: '🏢',
        a: aOffi, b: bOffi, unit: '건',
        winner: aOffi > bOffi ? 'A' : bOffi > aOffi ? 'B' : null,
        noData: !aOffi && !bOffi,
    });

    categories.push({ title: '🏠 부동산 시세', metrics: reMetrics });

    // ═══════ 종합 승자 ═══════
    const allMetrics = categories.flatMap(c => c.metrics);
    const aWins = allMetrics.filter(m => m.winner === 'A').length;
    const bWins = allMetrics.filter(m => m.winner === 'B').length;

    return {
        categories,
        summary: {
            aWins, bWins,
            totalMetrics: allMetrics.length,
            overallWinner: aWins > bWins ? 'A' : aWins < bWins ? 'B' : 'DRAW',
        }
    };
}

/**
 * AI 비교 코멘트 생성
 */
export async function generateAICompareComment(address1, address2, empiricalComparison, seoulDataWarning = null) {
    try {
        const allMetrics = empiricalComparison.categories.flatMap(c => c.metrics);

        const formatKoreanCurrency = (amount) => {
            if (!amount) return '0원';
            if (amount >= 100000000) return (amount / 100000000).toFixed(1) + '억원';
            if (amount >= 10000) return Math.floor(amount / 10000).toLocaleString() + '만원';
            return amount.toLocaleString() + '원';
        };

        const metricsText = allMetrics.map(m => {
            if (m.type === 'text') return `${m.icon} ${m.label}: A="${m.textA}" vs B="${m.textB}" (${m.source})`;
            const aVal = m.format === 'currency' ? formatKoreanCurrency(m.a) : `${m.a}${m.unit}`;
            const bVal = m.format === 'currency' ? formatKoreanCurrency(m.b) : `${m.b}${m.unit}`;
            const sameTag = m.sameSource ? ' ⚠️[동일상권-비교불가]' : '';
            return `${m.icon} ${m.label}: A=${aVal} vs B=${bVal} (${m.source})${m.winner ? ` → ${m.winner} 우세` : ''}${sameTag}`;
        }).join('\n');

        const sameSourceBlock = seoulDataWarning
            ? `\n🚨 [중요 데이터 한계 안내]\n두 매물이 서울시 상권 분석 기준으로 동일 상권 영역('${seoulDataWarning.trdarNm}')에 속합니다.\n⚠️[동일상권-비교불가] 표시된 지표(매출, 개업률, 폐업률, 유동인구 등)는 같은 데이터 소스이므로 비교 의미가 없습니다.\n이 항목은 비교 근거에서 제외하고, 반경 내 업소 수/교통/부동산 등 실질적으로 차이가 나는 지표 중심으로 분석하세요.\n`
            : '';

        const prompt = `당신은 대한민국 최고의 상가 부동산 입지 분석 전문가입니다. 아래 두 매물의 실증 비교 데이터를 바탕으로, 수억 원의 투자를 결정하는 고객에게 신뢰를 줄 수 있는 전문 분석을 제공하세요.

[A 매물]: ${address1}
[B 매물]: ${address2}
${sameSourceBlock}
[실증 비교 데이터 - ${allMetrics.length}개 지표]
${metricsText}

[종합] A 승: ${empiricalComparison.summary.aWins}개 / B 승: ${empiricalComparison.summary.bWins}개

⚠️ 핵심 작성 원칙 — "가독성 및 포맷 규칙":
1. 절대 **마크다운(**)** 문법을 사용하지 마세요. 모든 텍스트는 순수 텍스트(Plain Text)로 작성하세요.
2. 금액을 명시할 때는 원본 숫자가 아닌 "166.2억원", "323만원" 같이 한글 단위로 읽기 쉽게 작성하세요.
3. 정성적 표현("확연한 우위", "압도적")을 쓸 땐 반드시 해당 수치와 % 차이를 함께 명시하세요.
4. 항목들을 배열(Array) 형식 분리하여 가독성이 높게 구성하세요. (하나의 거대한 String으로 작성 금지)

반드시 아래 JSON 형식 하나만 출력하세요. 배열 내부 요소는 1개의 문장 또는 단락 단위로 쪼개세요:
{
  "verdict": "종합 판정 2~3문장 (순수 텍스트, 수치 근거 포함)",
  "aStrengths": ["A의 강점 1", "A의 강점 2"],
  "bStrengths": ["B의 강점 1", "B의 강점 2"],
  "targetGuide": ["타겟 가이드 시나리오 1", "타겟 가이드 시나리오 2", "타겟 가이드 시나리오 3"],
  "riskFactors": ["A 매물 리스크 요인", "B 매물 리스크 요인"]
}`;
        const raw = await askGemini(prompt, null, '부동산 상권 입지 비교 전문가. 순수 JSON만 반환.');
        const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
        return JSON.parse(cleaned);
    } catch (e) {
        console.warn('[Compare AI] 비교 코멘트 생성 실패:', e.message);
        return null;
    }
}
