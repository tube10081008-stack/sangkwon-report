/**
 * 🔥 실증 데이터 기반 매물 비교 분석 서비스
 * 서울시 12종 실측 API + 교통 + 부동산 + AI를 활용한 A vs B 비교
 */

import { askGemini } from './geminiService.js';

/**
 * 실증 비교 지표 산출
 */
export function buildEmpiricalComparison(a, b) {
    const metrics = [];

    // 1. 유동인구 (KT 통신 실측)
    const aPop = a.seoul?.floatingPop?.total || 0;
    const bPop = b.seoul?.floatingPop?.total || 0;
    if (aPop || bPop) {
        metrics.push({
            id: 'floating_pop', label: '분기 유동인구',
            source: 'KT 통신 기지국 실측', icon: '👥',
            a: aPop, b: bPop, unit: '명',
            winner: aPop >= bPop ? 'A' : 'B',
            diff: aPop && bPop ? Math.round(Math.abs(aPop - bPop) / Math.min(aPop, bPop) * 100) : null,
            detail: {
                aByTime: a.seoul?.floatingPop?.byTime || null,
                bByTime: b.seoul?.floatingPop?.byTime || null,
                aByAge: a.seoul?.floatingPop?.age || null,
                bByAge: b.seoul?.floatingPop?.age || null,
            }
        });
    }

    // 2. 추정매출 (신한카드 실측)
    const aSales = a.seoul?.sales?.totalSales || 0;
    const bSales = b.seoul?.sales?.totalSales || 0;
    if (aSales || bSales) {
        metrics.push({
            id: 'estimated_sales', label: '분기 추정매출',
            source: '신한카드 결제 데이터', icon: '💳',
            a: aSales, b: bSales, unit: '원', format: 'currency',
            winner: aSales >= bSales ? 'A' : 'B',
            diff: aSales && bSales ? Math.round(Math.abs(aSales - bSales) / Math.min(aSales, bSales) * 100) : null,
            detail: {
                aSalesByTime: a.seoul?.sales?.byTime || null,
                bSalesByTime: b.seoul?.sales?.byTime || null,
                aSalesByAge: a.seoul?.sales?.byAge || null,
                bSalesByAge: b.seoul?.sales?.byAge || null,
            }
        });
    }

    // 3. 폐업률 (서울시 + 카드사)
    const aClose = a.seoul?.store?.closeRate || 0;
    const bClose = b.seoul?.store?.closeRate || 0;
    if (aClose || bClose) {
        metrics.push({
            id: 'close_rate', label: '폐업률',
            source: '서울시 + 카드사', icon: '📉',
            a: aClose, b: bClose, unit: '%',
            winner: aClose <= bClose ? 'A' : 'B',
            lowerIsBetter: true,
            diff: aClose && bClose ? Math.round(Math.abs(aClose - bClose) / Math.max(aClose, bClose) * 100) : null,
        });
    }

    // 4. 개업률
    const aOpen = a.seoul?.store?.openRate || 0;
    const bOpen = b.seoul?.store?.openRate || 0;
    if (aOpen || bOpen) {
        metrics.push({
            id: 'open_rate', label: '개업률',
            source: '서울시 + 카드사', icon: '📈',
            a: aOpen, b: bOpen, unit: '%',
            winner: aOpen >= bOpen ? 'A' : 'B',
            diff: aOpen && bOpen ? Math.round(Math.abs(aOpen - bOpen) / Math.max(aOpen, bOpen) * 100) : null,
        });
    }

    // 5. 배후세대 월평균소득 (KB카드 + 건보공단)
    const aIncome = a.seoul?.incomeSpending?.monthlyIncome || 0;
    const bIncome = b.seoul?.incomeSpending?.monthlyIncome || 0;
    if (aIncome || bIncome) {
        metrics.push({
            id: 'avg_income', label: '배후세대 월평균소득',
            source: 'KB카드 + 국민건강보험공단', icon: '💰',
            a: aIncome, b: bIncome, unit: '원', format: 'currency',
            winner: aIncome >= bIncome ? 'A' : 'B',
            diff: aIncome && bIncome ? Math.round(Math.abs(aIncome - bIncome) / Math.min(aIncome, bIncome) * 100) : null,
        });
    }

    // 6. 상주인구 (주민등록 실측)
    const aResident = a.seoul?.residentPop?.totalPop || 0;
    const bResident = b.seoul?.residentPop?.totalPop || 0;
    if (aResident || bResident) {
        metrics.push({
            id: 'resident_pop', label: '상주인구',
            source: '서울시 주민등록', icon: '🏠',
            a: aResident, b: bResident, unit: '명',
            winner: aResident >= bResident ? 'A' : 'B',
            diff: aResident && bResident ? Math.round(Math.abs(aResident - bResident) / Math.min(aResident, bResident) * 100) : null,
            detail: {
                aHousehold1: a.seoul?.residentPop?.household?.['1인'] || 0,
                bHousehold1: b.seoul?.residentPop?.household?.['1인'] || 0,
            }
        });
    }

    // 7. 직장인구 (SKT 통신 실측)
    const aWork = a.seoul?.workingPop?.total || 0;
    const bWork = b.seoul?.workingPop?.total || 0;
    if (aWork || bWork) {
        metrics.push({
            id: 'working_pop', label: '직장인구',
            source: 'SKT 통신 데이터', icon: '🏢',
            a: aWork, b: bWork, unit: '명',
            winner: aWork >= bWork ? 'A' : 'B',
            diff: aWork && bWork ? Math.round(Math.abs(aWork - bWork) / Math.min(aWork, bWork) * 100) : null,
        });
    }

    // 8. 교통 접근성 점수
    const aTransit = a.transit?.score || 0;
    const bTransit = b.transit?.score || 0;
    metrics.push({
        id: 'transit_score', label: '교통 접근성',
        source: '카카오맵 + OpenStreetMap', icon: '🚇',
        a: aTransit, b: bTransit, unit: '점',
        winner: aTransit >= bTransit ? 'A' : 'B',
        diff: aTransit && bTransit ? Math.round(Math.abs(aTransit - bTransit)) : null,
        detail: {
            aNearestSubway: a.transit?.nearestSubway?.name || '-',
            aNearestDist: a.transit?.nearestSubway?.distance || 0,
            bNearestSubway: b.transit?.nearestSubway?.name || '-',
            bNearestDist: b.transit?.nearestSubway?.distance || 0,
        }
    });

    // 9. 반경 내 총 업소 수
    metrics.push({
        id: 'store_count', label: '반경 내 총 업소 수',
        source: '소상공인시장진흥공단', icon: '🏪',
        a: a.analysis.totalStores, b: b.analysis.totalStores, unit: '개',
        winner: a.analysis.totalStores >= b.analysis.totalStores ? 'A' : 'B',
        diff: Math.round(Math.abs(a.analysis.totalStores - b.analysis.totalStores) / Math.max(a.analysis.totalStores || 1, b.analysis.totalStores || 1) * 100),
    });

    // 10. 프랜차이즈 점유율
    const aFran = parseFloat(a.analysis.franchiseAnalysis?.franchiseRatio) || 0;
    const bFran = parseFloat(b.analysis.franchiseAnalysis?.franchiseRatio) || 0;
    metrics.push({
        id: 'franchise_ratio', label: '프랜차이즈 점유율',
        source: '소상공인시장진흥공단 + 자체 DB', icon: '🏷️',
        a: aFran, b: bFran, unit: '%',
        winner: null,
        note: '높으면 검증된 상권, 낮으면 독립 창업 기회',
    });

    // 종합 승자 카운트
    const aWins = metrics.filter(m => m.winner === 'A').length;
    const bWins = metrics.filter(m => m.winner === 'B').length;

    return {
        metrics,
        summary: { aWins, bWins, totalMetrics: metrics.length, overallWinner: aWins > bWins ? 'A' : aWins < bWins ? 'B' : 'DRAW' }
    };
}

/**
 * AI 비교 코멘트 생성
 */
export async function generateAICompareComment(address1, address2, empiricalComparison) {
    try {
        const prompt = `당신은 대한민국 최고의 상가 부동산 분석가입니다. 아래 두 매물의 실증 비교 데이터를 바탕으로, 부동산 중개인이 고객에게 설명할 수 있는 전문적이고 설득력 있는 비교 분석 코멘트를 작성하세요.

[A 매물]: ${address1}
[B 매물]: ${address2}

[실증 비교 데이터]
${empiricalComparison.metrics.map(m => `${m.icon} ${m.label}: A=${m.a}${m.unit} vs B=${m.b}${m.unit} (출처: ${m.source})${m.winner ? ` → ${m.winner} 우세` : ''}`).join('\n')}

[종합 스코어보드]
A 승: ${empiricalComparison.summary.aWins}개 지표 / B 승: ${empiricalComparison.summary.bWins}개 지표

반드시 아래 JSON 형식 하나만 출력하세요:
{
  "verdict": "A 또는 B 중 종합적으로 유리한 쪽과 핵심 근거 1~2문장 (데이터 수치 인용 필수)",
  "aStrengths": ["A의 데이터 기반 핵심 강점 1", "A의 강점 2"],
  "bStrengths": ["B의 데이터 기반 핵심 강점 1", "B의 강점 2"],
  "targetGuide": "업종/타겟에 따른 선택 가이드 2~3문장 (예: 직장인 대상 점심이라면 A, 1인가구 배달이라면 B 등)"
}`;
        const raw = await askGemini(prompt, null, '부동산 상권 비교 분석 전문가. 순수 JSON만 반환.');
        const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
        return JSON.parse(cleaned);
    } catch (e) {
        console.warn('[Compare AI] 비교 코멘트 생성 실패:', e.message);
        return null;
    }
}
