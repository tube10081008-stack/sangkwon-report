/**
 * AI 컨설팅 분석 서비스
 * Gemini API 없이 규칙 기반 전문가 분석 코멘트 생성
 * (Gemini API 키가 있으면 AI 분석 활성화 가능)
 */

/**
 * 단일 상권 분석 AI 코멘트 생성
 */
export function generateSingleAnalysisComment(analysis, location) {
    const { grade, overallScore, totalStores, categorySummary, franchiseAnalysis, indicators, targetAnalysis } = analysis;

    const topCategories = categorySummary.slice(0, 3);
    const topCatNames = topCategories.map(c => c.name).join(', ');

    const comments = {
        overview: generateOverview(location, grade, overallScore, totalStores, topCatNames),
        strengths: identifyStrengths(indicators, categorySummary, franchiseAnalysis),
        weaknesses: identifyWeaknesses(indicators, categorySummary, franchiseAnalysis),
        opportunities: identifyOpportunities(categorySummary, franchiseAnalysis, totalStores),
        threats: identifyThreats(indicators, categorySummary, totalStores),
        recommendations: generateRecommendations(grade, indicators, categorySummary, targetAnalysis),
        conclusion: generateConclusion(grade, overallScore, location)
    };

    if (targetAnalysis) {
        comments.targetInsight = generateTargetInsight(targetAnalysis, location);
    }

    return comments;
}

/**
 * 비교 분석 AI 코멘트 생성
 */
export function generateCompareComment(comparison, location1, location2) {
    const { summary, indicatorComparison, advantages, recommendation } = comparison;

    let recommendationText = '';
    if (recommendation === 'area1') {
        recommendationText = `종합적으로 **${location1.address}** 상권이 더 유리합니다. ` +
            `종합 점수 ${summary.area1.score}점(${summary.area1.grade.grade}등급)으로, ` +
            `${location2.address}(${summary.area2.score}점)보다 ${summary.area1.score - summary.area2.score}점 높습니다.`;
    } else if (recommendation === 'area2') {
        recommendationText = `종합적으로 **${location2.address}** 상권이 더 유리합니다. ` +
            `종합 점수 ${summary.area2.score}점(${summary.area2.grade.grade}등급)으로, ` +
            `${location1.address}(${summary.area1.score}점)보다 ${summary.area2.score - summary.area1.score}점 높습니다.`;
    } else {
        recommendationText = `두 상권의 종합 점수가 근접하여(${summary.area1.score}점 vs ${summary.area2.score}점), ` +
            `업종 특성과 개인 조건에 따라 선택이 달라질 수 있습니다.`;
    }

    const advantageText1 = advantages.area1.length > 0
        ? `${location1.address}은(는) **${advantages.area1.join(', ')}** 측면에서 우위에 있습니다.`
        : '';
    const advantageText2 = advantages.area2.length > 0
        ? `${location2.address}은(는) **${advantages.area2.join(', ')}** 측면에서 우위에 있습니다.`
        : '';

    return {
        recommendation: recommendationText,
        advantages: { area1: advantageText1, area2: advantageText2 },
        detailedComparison: generateDetailedComparison(indicatorComparison, location1, location2),
        finalAdvice: recommendation === 'similar'
            ? '두 상권 모두 장단점이 있습니다. 본인의 업종, 자본금, 영업 전략에 가장 부합하는 곳을 선택하시기 바랍니다.'
            : `추천 상권을 기반으로 하되, 실제 현장 답사 및 임대료 조건 등을 반드시 확인하시기 바랍니다.`
    };
}

/**
 * 필승전략 가이드 생성
 */
export function generateStrategyGuide(analysis, location, targetCategory) {
    const { grade, overallScore, categorySummary, franchiseAnalysis, indicators, targetAnalysis } = analysis;

    return {
        // 1. 시장 진입 판단
        marketEntry: generateMarketEntryAdvice(grade, targetAnalysis, categorySummary),

        // 2. 타겟 고객 프로파일
        targetCustomer: generateTargetCustomerProfile(categorySummary, location),

        // 3. 포지셔닝 전략
        positioning: generatePositioningStrategy(targetAnalysis, categorySummary, franchiseAnalysis, targetCategory),

        // 4. 경쟁 전략
        competitiveStrategy: generateCompetitiveStrategy(targetAnalysis, franchiseAnalysis, targetCategory),

        // 5. 마케팅 채널 & 전략
        marketing: generateMarketingPlan(location, targetCategory, categorySummary),

        // 6. 매출 시나리오
        revenueScenarios: generateRevenueScenarios(targetAnalysis, location),

        // 7. 리스크 & 대응
        riskAnalysis: generateRiskAnalysis(indicators, targetAnalysis, categorySummary),

        // 8. 오픈 전 체크리스트
        checklist: generateOpeningChecklist(targetCategory, location),

        // 9. 최종 종합 조언
        finalAdvice: generateFinalAdvice(grade, overallScore, targetCategory, location)
    };
}

// ===== Helper Functions =====

function generateOverview(location, grade, score, totalStores, topCats) {
    return `${location.address} (${location.region3}) 상권은 반경 내 총 **${totalStores.toLocaleString()}개** 업소가 운영 중이며, ` +
        `종합 **${grade.grade}등급 (${score}점/100점)**으로 평가됩니다. ` +
        `주요 업종은 ${topCats}이며, ${grade.description}`;
}

function identifyStrengths(indicators, categories, franchise) {
    const strengths = [];
    if (indicators.diversityIndex.value >= 70) strengths.push('다양한 업종이 균형 있게 분포하여 복합 상권의 장점을 가지고 있습니다.');
    if (indicators.densityScore.value >= 70) strengths.push('적정 수준의 업소 밀도로 활성화된 상권입니다.');
    if (indicators.competitionIntensity.value >= 70) strengths.push('특정 업종에 편중되지 않아 신규 진입 기회가 열려 있습니다.');
    if (indicators.stabilityScore.value >= 70) strengths.push('의료·교육 등 생활밀착형 업종이 많아 지역 기반이 안정적입니다.');
    if (parseFloat(franchise.franchiseRatio) < 30) strengths.push('독립 상점 비율이 높아 개인 창업에 유리한 환경입니다.');
    if (strengths.length === 0) strengths.push('전반적으로 보통 수준의 상권으로, 전략적 접근이 필요합니다.');
    return strengths;
}

function identifyWeaknesses(indicators, categories, franchise) {
    const weaknesses = [];
    if (indicators.diversityIndex.value < 50) weaknesses.push('업종 다양성이 부족하여 특정 업종에 의존하는 경향이 있습니다.');
    if (indicators.densityScore.value < 50) weaknesses.push('업소 수가 적어 상권 활성화가 미흡합니다.');
    if (indicators.competitionIntensity.value < 50) weaknesses.push('특정 업종의 과잉 경쟁이 우려됩니다.');
    if (indicators.stabilityScore.value < 40) weaknesses.push('생활밀착형 인프라(의료, 교육)가 부족하여 유동인구가 제한적일 수 있습니다.');
    if (parseFloat(franchise.franchiseRatio) > 50) weaknesses.push('프랜차이즈 비율이 높아 독립 매장의 경쟁이 치열할 수 있습니다.');
    return weaknesses;
}

function identifyOpportunities(categories, franchise, total) {
    const opportunities = [];
    const underserved = categories.filter(c => parseFloat(c.percentage) < 5 && !['기타', '수리·개인'].includes(c.name));
    if (underserved.length > 0) {
        opportunities.push(`${underserved.map(c => c.name).join(', ')} 업종이 상대적으로 비어있어 진입 기회가 있습니다.`);
    }
    if (total > 500) opportunities.push('상권이 활발하여 유동인구 확보에 유리합니다.');
    if (parseFloat(franchise.franchiseRatio) < 20) opportunities.push('프랜차이즈가 적어 브랜드 없는 독립 매장으로도 성공 가능성이 있습니다.');
    return opportunities;
}

function identifyThreats(indicators, categories, total) {
    const threats = [];
    if (total > 3000) threats.push('업소 수가 매우 많아 과열 경쟁이 우려됩니다.');
    if (indicators.competitionIntensity.value < 40) threats.push('소수 업종에 편중되어 해당 업종 경기 변동에 취약합니다.');
    const topCat = categories[0];
    if (topCat && parseFloat(topCat.percentage) > 40) {
        threats.push(`${topCat.name} 업종이 ${topCat.percentage}%로 압도적이어서 타 업종 성장이 제한될 수 있습니다.`);
    }
    return threats;
}

function generateRecommendations(grade, indicators, categories, targetAnalysis) {
    const recs = [];

    if (grade.grade === 'S' || grade.grade === 'A') {
        recs.push('✅ 이 상권은 전반적으로 우수한 환경입니다. 빠른 진입이 유리할 수 있습니다.');
    } else if (grade.grade === 'B') {
        recs.push('⚠️ 양호한 상권이나, 차별화된 서비스/상품으로 경쟁력을 확보해야 합니다.');
    } else {
        recs.push('🚨 신중한 판단이 필요합니다. 반드시 현장 답사 후 최종 결정하시기 바랍니다.');
    }

    if (targetAnalysis) {
        const sat = targetAnalysis.saturationLevel;
        recs.push(`📌 ${targetAnalysis.targetCategory} 업종: ${sat.level} 상태 - ${sat.advice}`);
    }

    recs.push('💡 최종 결정 전 반드시 해당 상권의 임대료, 권리금, 유동인구(주중/주말)를 현장 확인하시기 바랍니다.');

    return recs;
}

function generateConclusion(grade, score, location) {
    return `${location.address} 상권은 종합 ${grade.grade}등급(${score}점)으로, ${grade.description} ` +
        `본 리포트의 데이터 분석은 공공데이터를 기반으로 한 객관적 평가이며, ` +
        `실제 창업 결정 시에는 현장 답사, 임대 조건, 개인 역량 등을 종합적으로 고려하시기 바랍니다.`;
}

function generateTargetInsight(targetAnalysis, location) {
    const { targetCategory, competitorCount, marketShare, saturationLevel } = targetAnalysis;
    return `${location.region3} 지역의 **${targetCategory}** 업종은 현재 **${competitorCount}개** 업소가 운영 중이며, ` +
        `전체 대비 **${marketShare}%**의 비중을 차지합니다. ` +
        `시장 상태는 **"${saturationLevel.level}"**으로 판단되며, ${saturationLevel.advice}`;
}

function generateDetailedComparison(indicatorComparison, loc1, loc2) {
    const details = [];
    Object.entries(indicatorComparison).forEach(([key, comp]) => {
        const winner = comp.winner === 'area1' ? loc1.address : comp.winner === 'area2' ? loc2.address : '동점';
        details.push({
            indicator: comp.label,
            area1: comp.area1,
            area2: comp.area2,
            winner,
            diff: comp.diff
        });
    });
    return details;
}

function generateMarketEntryAdvice(grade, targetAnalysis, categories) {
    let advice;
    if (grade.grade === 'S' || grade.grade === 'A') {
        advice = { verdict: '추천', icon: '🟢', text: '이 상권은 진입하기에 적합한 환경입니다.' };
    } else if (grade.grade === 'B') {
        advice = { verdict: '조건부 추천', icon: '🟡', text: '차별화 전략이 뒷받침된다면 성공 가능성이 있습니다.' };
    } else {
        advice = { verdict: '신중 검토', icon: '🔴', text: '리스크가 높으므로, 대안 지역도 함께 검토하시기 바랍니다.' };
    }

    if (targetAnalysis) {
        const sat = targetAnalysis.saturationLevel;
        if (sat.level === '포화') {
            advice.verdict = '비추천';
            advice.icon = '🔴';
            advice.text = `${targetAnalysis.targetCategory} 업종이 이미 포화 상태입니다. 강력한 차별화 없이는 생존이 어렵습니다.`;
        } else if (sat.level === '미진입') {
            advice.text += ` 특히 ${targetAnalysis.targetCategory} 업종은 진입 기회가 열려 있어 선점 효과를 기대할 수 있습니다.`;
        }
    }

    return advice;
}

function generateTargetCustomerProfile(categories, location) {
    const profiles = [];

    const hasFoodCategory = categories.some(c => c.name.includes('음식'));
    const hasEducation = categories.some(c => c.name.includes('교육'));
    const hasRetail = categories.some(c => c.name.includes('소매'));
    const hasMedical = categories.some(c => c.name.includes('보건') || c.name.includes('의료'));

    if (hasEducation) profiles.push({ segment: '학부모·학생층', description: '교육 시설이 밀집해 있어 학부모 및 학생 유동인구가 예상됩니다.', strategy: '학원가 주변 식사·간식 수요, 문구·학용품 수요를 공략' });
    if (hasFoodCategory) profiles.push({ segment: '직장인·생활인', description: '음식점 밀집 지역으로 점심·저녁 식사 수요가 풍부합니다.', strategy: '점심 특선, 회식 메뉴, 빠른 서비스 등으로 차별화' });
    if (hasRetail) profiles.push({ segment: '쇼핑 고객', description: '소매업 밀집으로 쇼핑 목적의 방문객이 많습니다.', strategy: '체험형 매장, 온라인 연계 O2O 전략 적용' });
    if (hasMedical) profiles.push({ segment: '의료 방문객', description: '의료 시설 밀집으로 환자 및 보호자 유동인구가 많습니다.', strategy: '약국, 건강식품, 환자 편의시설 등 의료 연계 사업' });

    if (profiles.length === 0) {
        profiles.push({ segment: '지역 주민', description: '일반적인 주거·생활 상권입니다.', strategy: '지역 주민의 일상 니즈를 충족하는 서비스에 집중' });
    }

    return profiles;
}

function generatePositioningStrategy(targetAnalysis, categories, franchise, targetCategory) {
    const strategies = [];

    strategies.push({
        title: '차별화 포인트',
        items: [
            `${targetCategory} 업종 내에서 '전문성'을 강조한 포지셔닝`,
            '상위 프랜차이즈에 없는 독자적 메뉴/서비스 개발',
            'SNS·리뷰 기반 마케팅으로 초기 인지도 확보'
        ]
    });

    strategies.push({
        title: '가격 전략',
        items: [
            '주변 경쟁 업소 대비 적정 가격대 유지',
            '초기 할인·이벤트로 고객 유입 후 정상가 전환',
            '세트 메뉴/패키지로 객단가 상승 유도'
        ]
    });

    if (targetAnalysis && targetAnalysis.saturationLevel.level === '미진입') {
        strategies.push({
            title: '선발 주자 전략',
            items: [
                '경쟁자가 적은 만큼 빠른 진입으로 시장 선점',
                '지역 커뮤니티 활동으로 단골 고객 확보',
                '후발 주자 대비 브랜드 인지도 우선 확보'
            ]
        });
    }

    return strategies;
}

function generateCompetitiveStrategy(targetAnalysis, franchise, targetCategory) {
    const strategies = [];

    if (targetAnalysis && targetAnalysis.competitorCount > 20) {
        strategies.push({ type: '레드오션 전략', detail: `${targetCategory} 업종 경쟁이 심하므로, 품질·서비스·분위기에서 확실한 차별화가 필요합니다.` });
    }

    if (franchise.topBrands.length > 0) {
        const topBrand = franchise.topBrands[0];
        strategies.push({ type: '프랜차이즈 대응', detail: `${topBrand.name}(${topBrand.count}개점) 등 프랜차이즈 대비, 개인 매장만의 '수제'·'로컬' 감성을 부각하세요.` });
    }

    strategies.push({ type: '온라인 경쟁력', detail: '네이버 플레이스, 카카오맵 리뷰 관리, 배달앱 입점으로 온라인 접점을 확대하세요.' });
    strategies.push({ type: '체험 마케팅', detail: '시식·체험·이벤트 등 오프라인에서만 가능한 경험을 제공하여 재방문율을 높이세요.' });

    return strategies;
}

function generateMarketingPlan(location, targetCategory, categories) {
    return {
        online: [
            { channel: '네이버 플레이스', priority: '높음', action: '오픈 2주 전 등록, 사진 20장 이상, 영업시간·메뉴 정확히 기입' },
            { channel: '카카오맵', priority: '높음', action: '카카오톡 채널 연동, 장소 등록' },
            { channel: '인스타그램', priority: '높음', action: '주 3회 이상 게시물, 지역 해시태그 활용, 매장 인테리어/메뉴 사진' },
            { channel: '배달앱 (배달의민족·요기요)', priority: '중간', action: '오픈 1주일 내 입점, 초기 할인 쿠폰' },
            { channel: '블로그·유튜브', priority: '중간', action: '맛집·체험 블로거 초대, 리뷰 컨텐츠 생성' }
        ],
        offline: [
            { channel: '전단지·현수막', priority: '높음', action: `${location.region3} 주요 동선에 오픈 안내 배포` },
            { channel: '오픈 이벤트', priority: '높음', action: '오픈 3일간 특별 할인, 무료 시식/체험' },
            { channel: '지역 커뮤니티', priority: '중간', action: '동네 밴드·카페 홍보, 아파트 게시판' },
            { channel: '제휴 마케팅', priority: '중간', action: '주변 매장과의 상호 추천 제휴' }
        ]
    };
}

function generateRevenueScenarios(targetAnalysis, location) {
    const base = targetAnalysis ? targetAnalysis.competitorCount : 10;
    return {
        note: '※ 아래 시나리오는 일반적인 소상공인 매출 통계를 기반으로 한 참고용 추정이며, 실제 매출은 업종·운영 역량·입지 세부 조건에 따라 크게 달라질 수 있습니다.',
        conservative: { label: '보수적 시나리오', description: '경쟁 심화, 초기 인지도 낮음', factor: '하위 25%' },
        base: { label: '기본 시나리오', description: '평균적 운영, 보통 마케팅', factor: '중위 50%' },
        optimistic: { label: '낙관적 시나리오', description: '차별화 성공, 적극 마케팅', factor: '상위 25%' }
    };
}

function generateRiskAnalysis(indicators, targetAnalysis, categories) {
    const risks = [];

    risks.push({ risk: '임대료 상승 리스크', level: '중간', mitigation: '장기 계약 시 인상률 상한 명시, 보증금 대비 권리금 비율 확인' });

    if (targetAnalysis && targetAnalysis.saturationLevel.level !== '미진입') {
        risks.push({
            risk: '경쟁 심화 리스크', level: targetAnalysis.saturationLevel.level === '포화' ? '높음' : '중간',
            mitigation: '독자적 경쟁력 확보, 충성 고객 관리, 온라인 마케팅 강화'
        });
    }

    risks.push({ risk: '고객 확보 지연', level: '중간', mitigation: '오픈 전 사전 마케팅, 오픈 이벤트, 블로거 초대 등으로 초기 인지도 돌파' });
    risks.push({ risk: '원자재 가격 변동', level: '낮음', mitigation: '다수 공급처 확보, 메뉴 가격 조정 체계 수립' });

    return risks;
}

function generateOpeningChecklist(targetCategory, location) {
    return [
        { phase: 'D-90 (3개월 전)', items: ['사업자등록', '점포 계약 (임대/전대)', '인테리어 설계', '메뉴/상품 기획'] },
        { phase: 'D-60 (2개월 전)', items: ['인테리어 시공', '설비·장비 주문', '직원 채용·교육 시작', '위생교육·영업허가 신청'] },
        { phase: 'D-30 (1개월 전)', items: ['네이버 플레이스 등록', '카카오맵 등록', 'SNS 계정 개설 및 사전 마케팅', '배달앱 입점 신청'] },
        { phase: 'D-14 (2주 전)', items: ['최종 시운전', '친지·지인 초대 시범 운영', '블로거 초대', '전단지·현수막 배포'] },
        { phase: 'D-Day (오픈)', items: ['오픈 이벤트 실행', '고객 피드백 수집', 'SNS 실시간 업로드', '운영 동선 최적화'] },
        { phase: 'D+30 (오픈 후 1개월)', items: ['고객 데이터 분석', '메뉴/서비스 보완', '재방문 유도 캠페인', '매출 대비 비용 분석'] }
    ];
}

function generateFinalAdvice(grade, score, targetCategory, location) {
    if (grade.grade === 'S' || grade.grade === 'A') {
        return `${location.address} 상권은 **${grade.grade}등급(${score}점)**으로, ${targetCategory} 창업에 매우 유리한 입지입니다. ` +
            `빠른 진입과 적극적인 마케팅으로 선점 효과를 극대화하시기 바랍니다. 성공을 기원합니다! 🎉`;
    } else if (grade.grade === 'B') {
        return `${location.address} 상권은 **${grade.grade}등급(${score}점)**으로, 준비된 창업자에게는 좋은 기회가 될 수 있습니다. ` +
            `차별화된 상품/서비스와 꾸준한 마케팅이 성공의 열쇠입니다. 준비를 철저히 하시면 충분히 승부할 수 있습니다! 💪`;
    } else {
        return `${location.address} 상권은 **${grade.grade}등급(${score}점)**으로, 신중한 접근이 필요합니다. ` +
            `반드시 현장 답사와 주변 상인 인터뷰를 진행하고, 대안 지역과 비교 분석 후 최종 결정하시기 바랍니다. ` +
            `철저한 준비가 리스크를 줄입니다. 화이팅! 🙏`;
    }
}
