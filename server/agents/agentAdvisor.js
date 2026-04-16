/**
 * 💡 Agent Advisor V2 — QA 결과 요약 리포터
 * 
 * Inspector의 QA 결과를 사람이 읽기 좋은 형태로 요약합니다.
 * 더 이상 Gemini에게 개선안을 생성하지 않습니다.
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
        const summary = `✅ ${district} 서비스 QA 통과 — 모든 엔드포인트, 보고서 완결성, 데이터 파이프라인, AI 팩트체크, 성능 모두 정상입니다.`;
        console.log(`   ${summary}`);
        return {
            district,
            timestamp: new Date().toISOString(),
            totalIssues: 0,
            improvements: [],
            autoFixable: [], // 빈 배열 유지 (loopController 호환)
            manualReview: [],
            summary
        };
    }

    // Phase별로 그룹핑
    const byPhase = {};
    allIssues.forEach(issue => {
        const phase = issue.phase || 'Unknown';
        if (!byPhase[phase]) byPhase[phase] = [];
        byPhase[phase].push(issue);
    });

    // 사람이 읽을 수 있는 요약 생성
    const summaryParts = [];
    const manualReview = [];

    // CRITICAL/HIGH 먼저
    const criticals = allIssues.filter(i => i.severity === 'CRITICAL');
    const highs = allIssues.filter(i => i.severity === 'HIGH');
    const mediums = allIssues.filter(i => i.severity === 'MEDIUM');
    const lows = allIssues.filter(i => i.severity === 'LOW');

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
        autoFixable: [], // V2에서는 자동 수정 없음
        manualReview,
        summary
    };
}
