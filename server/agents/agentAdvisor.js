/**
 * 💡 Agent Advisor V3 — QA 결과 요약 리포터
 * 
 * V3: 동일 유형 이슈 합산으로 앵무새 방지 + AI 복면 심사 통합.
 */

/**
 * QA 리포트를 사람이 읽을 수 있는 요약으로 변환
 */
export async function generateImprovementPlan(inspectionReport) {
    const { district, results, totalIssuesFound } = inspectionReport;

    console.log(`\n💡 === QA 요약: ${district} (${totalIssuesFound}건 이슈) ===\n`);

    // 모든 이슈 수집
    const allIssues = [];
    results.forEach(r => {
        if (r.issues) {
            r.issues.forEach(issue => allIssues.push({ ...issue, sourceAddress: r.address }));
        }
    });

    if (allIssues.length === 0) {
        const summary = `✅ ${district} 서비스 QA 통과 — 모든 검증 항목 정상입니다.`;
        console.log(`   ${summary}`);
        return {
            district,
            timestamp: new Date().toISOString(),
            totalIssues: 0,
            improvements: [],
            autoFixable: [],
            manualReview: [],
            summary
        };
    }

    // V3: 동일 type 이슈 합산 (앵무새 방지)
    const deduped = deduplicateIssues(allIssues);

    // Phase별로 그룹핑
    const byPhase = {};
    deduped.forEach(issue => {
        const phase = issue.phase || 'Unknown';
        if (!byPhase[phase]) byPhase[phase] = [];
        byPhase[phase].push(issue);
    });

    // 사람이 읽을 수 있는 요약 생성
    const summaryParts = [];
    const manualReview = [];

    const criticals = deduped.filter(i => i.severity === 'CRITICAL');
    const highs = deduped.filter(i => i.severity === 'HIGH');
    const mediums = deduped.filter(i => i.severity === 'MEDIUM');
    const lows = deduped.filter(i => i.severity === 'LOW');

    if (criticals.length > 0) {
        summaryParts.push(`🔴 CRITICAL ${criticals.length}건: ${criticals.map(i => i.type).join(', ')}`);
        criticals.forEach(i => manualReview.push({
            type: i.type,
            severity: 'CRITICAL',
            title: i.description,
            description: i.suggestion || '즉시 점검 필요'
        }));
    }
    if (highs.length > 0) {
        summaryParts.push(`🟠 HIGH ${highs.length}건: ${highs.map(i => i.type).join(', ')}`);
        highs.forEach(i => manualReview.push({
            type: i.type,
            severity: 'HIGH',
            title: i.description,
            description: i.suggestion || '점검 권장'
        }));
    }
    if (mediums.length > 0) {
        summaryParts.push(`🟡 MEDIUM ${mediums.length}건`);
        mediums.forEach(i => manualReview.push({
            type: i.type,
            severity: 'MEDIUM',
            title: i.description,
            description: i.suggestion || '참고사항 확인'
        }));
    }
    if (lows.length > 0) {
        summaryParts.push(`🟢 LOW ${lows.length}건`);
    }

    // Phase별 상태 요약
    const phaseStatus = Object.entries(byPhase).map(([phase, issues]) => {
        const worst = issues.find(i => i.severity === 'CRITICAL') ? '❌' :
                      issues.find(i => i.severity === 'HIGH') ? '⚠️' : '📝';
        return `${worst} ${phase}: ${issues.length}건`;
    }).join('\n');

    const summary = `📊 ${district} QA 결과: ${totalIssuesFound}건 이슈\n${summaryParts.join(' | ')}\n\n${phaseStatus}`;

    console.log(`   ${summary.replace(/\n/g, '\n   ')}`);

    return {
        district,
        timestamp: new Date().toISOString(),
        totalIssues: allIssues.length,
        improvements: Object.entries(byPhase).map(([phase, issues]) => ({
            phase,
            issueCount: issues.length,
            issues: issues.map(i => ({ type: i.type, severity: i.severity, description: i.description }))
        })),
        autoFixable: [],
        manualReview,
        summary
    };
}


/**
 * V3: 동일 type 이슈 합산 (앵무새 방지)
 * 같은 type이 3건 이상이면 한 줄로 합산
 */
function deduplicateIssues(issues) {
    const byType = {};
    issues.forEach(issue => {
        if (!byType[issue.type]) byType[issue.type] = [];
        byType[issue.type].push(issue);
    });

    const deduped = [];
    Object.entries(byType).forEach(([type, group]) => {
        if (group.length >= 3) {
            // 합산: 같은 type이 3건 이상이면 한 줄로
            const addresses = group.map(i => {
                const addr = i.sourceAddress?.split(' ').slice(-2).join(' ');
                return addr || '?';
            }).join(', ');
            deduped.push({
                ...group[0],
                description: `${group[0].description.split(' — ')[0]} — ${group.length}건 (${addresses})`,
                _mergedCount: group.length
            });
        } else {
            // 개별 유지
            deduped.push(...group);
        }
    });

    return deduped;
}

