/**
 * 📢 Discord Notifier V3
 * 
 * QA 결과를 Discord 웹훅으로 전송합니다.
 * V3: 앵무새 나열 → AI 복면 심사관의 서술형 품평으로 전환.
 */

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || '';

/**
 * QA 결과를 Discord로 전송
 */
export async function sendLoopResult(loopResult) {
    if (!DISCORD_WEBHOOK_URL) {
        console.warn('   ⚠️ DISCORD_WEBHOOK_URL이 설정되지 않았습니다. Discord 알림 건너뜀.');
        return { sent: false, reason: 'No webhook URL' };
    }

    const { district, inspectionReport, improvementPlan, loopNumber, timestamp } = loopResult;
    const totalIssues = inspectionReport?.totalIssuesFound || 0;
    const criticals = inspectionReport?.summary?.critical || 0;
    const highs = inspectionReport?.summary?.high || 0;

    // 전체 판정
    const verdict = criticals > 0 ? '🔴 FAIL' : highs > 0 ? '🟡 WARNING' : '🟢 PASS';
    const color = criticals > 0 ? 0xEF4444 : highs > 0 ? 0xF59E0B : 0x22C55E;

    // 파이프라인 상태
    const pipelineStatus = inspectionReport?.pipelineHealth || '확인 불가';

    // 주소별 스냅샷 (V3: 미슐랭 점수 포함)
    const snapshots = (inspectionReport?.results || [])
        .filter(r => r.analysisSnapshot)
        .map(r => {
            const snap = r.analysisSnapshot;
            const michelin = snap.michelinScore ? ` [🎭${snap.michelinScore}/5]` : '';
            return `📍 ${r.address?.split(' ').slice(-2).join(' ') || '?'}: ${snap.overallScore}점 ${snap.grade}등급 (${snap.storeCount}개 업소)${michelin}`;
        })
        .join('\n');

    const embeds = [
        {
            title: `${verdict} 서비스 QA #${loopNumber} — ${district}`,
            description: `**${district}** 서비스 품질 점검 완료`,
            color,
            fields: [
                {
                    name: '📊 판정',
                    value: `${verdict} | 이슈 **${totalIssues}건** 발견`,
                    inline: true
                },
                {
                    name: '🏪 테스트 주소',
                    value: `${inspectionReport?.addressesTested || 0}개`,
                    inline: true
                },
                {
                    name: '🔌 데이터 파이프라인',
                    value: pipelineStatus === 'ALL_HEALTHY' ? '✅ 모두 정상' : `⚠️ ${pipelineStatus}`,
                    inline: true
                },
                ...(totalIssues > 0 ? [{
                    name: '🚨 심각도 분포',
                    value: formatSeverity(inspectionReport.summary),
                    inline: false
                }] : []),
                ...(snapshots ? [{
                    name: '📈 분석 스냅샷',
                    value: snapshots.substring(0, 600),
                    inline: false
                }] : [])
            ],
            timestamp,
            footer: { text: '상권분석 서비스 QA 시스템 V3 — 미슐랭 복면 심사관' }
        }
    ];

    // V3: 🎭 AI 복면 심사 종합 (서술형)
    const michelinSummary = inspectionReport?.michelinSummary;
    if (michelinSummary && michelinSummary.length > 0) {
        const avgScore = (michelinSummary.reduce((s, m) => s + m.score, 0) / michelinSummary.length).toFixed(1);
        const michelinLines = michelinSummary
            .map(m => `${'⭐'.repeat(m.score)}${'☆'.repeat(5 - m.score)} ${m.address}: "${m.verdict}"`)
            .join('\n');

        embeds.push({
            title: `🎭 복면 심사 결과 — 평균 ${avgScore}/5점`,
            description: michelinLines.substring(0, 1800),
            color: avgScore >= 4 ? 0x22C55E : avgScore >= 3 ? 0xF59E0B : 0xEF4444
        });
    }

    // V3: 🔀 교차 비교 내러티브 (서술형)
    const crossReview = inspectionReport?.crossReview;
    if (crossReview) {
        embeds.push({
            title: '🔀 교차 비교 종합 평가',
            description: crossReview.substring(0, 1800),
            color: 0x6366F1
        });
    }

    // CRITICAL/HIGH 이슈 상세 (V3: 앵무새 합산된 버전)
    if (improvementPlan?.manualReview?.length > 0) {
        embeds.push({
            title: '⚠️ 점검 필요 항목',
            description: improvementPlan.manualReview
                .slice(0, 5) // 최대 5건
                .map((item, idx) => `**${idx + 1}. [${item.severity}] ${item.title}**\n${item.description || ''}`)
                .join('\n\n')
                .substring(0, 2000),
            color: 0xFF6B6B
        });
    }

    try {
        const response = await fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: '상권분석 QA 봇 🎭',
                avatar_url: 'https://cdn.discordapp.com/embed/avatars/0.png',
                embeds: embeds.slice(0, 10)
            })
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Discord API 오류 (${response.status}): ${text}`);
        }

        console.log('   ✅ Discord 알림 전송 완료');
        return { sent: true };

    } catch (error) {
        console.error('   ❌ Discord 알림 전송 실패:', error.message);
        return { sent: false, error: error.message };
    }
}

function formatSeverity(summary) {
    const parts = [];
    if (summary.critical > 0) parts.push(`🔴 CRITICAL: ${summary.critical}`);
    if (summary.high > 0) parts.push(`🟠 HIGH: ${summary.high}`);
    if (summary.medium > 0) parts.push(`🟡 MEDIUM: ${summary.medium}`);
    if (summary.low > 0) parts.push(`🟢 LOW: ${summary.low}`);
    return parts.join('\n') || '이슈 없음 ✅';
}
