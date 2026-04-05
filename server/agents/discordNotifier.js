/**
 * 📢 Discord Notifier
 * 
 * 루프 결과를 Discord 웹훅으로 전송합니다.
 */

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || '';

/**
 * 루프 결과를 Discord로 전송
 */
export async function sendLoopResult(loopResult) {
    if (!DISCORD_WEBHOOK_URL) {
        console.warn('   ⚠️ DISCORD_WEBHOOK_URL이 설정되지 않았습니다. Discord 알림 건너뜀.');
        return { sent: false, reason: 'No webhook URL' };
    }

    const { district, inspectionReport, improvementPlan, autoFixResult, loopNumber, timestamp } = loopResult;

    // 임베드 메시지 구성
    const embeds = [
        {
            title: `🔄 상권 분석 에이전트 루프 #${loopNumber} 완료`,
            description: `**${district}** 지역 검증 결과입니다.`,
            color: getColorByIssueCount(inspectionReport.totalIssuesFound),
            fields: [
                {
                    name: '📍 검증 지역',
                    value: district,
                    inline: true
                },
                {
                    name: '🏪 테스트 주소',
                    value: `${inspectionReport.addressesTested}개`,
                    inline: true
                },
                {
                    name: '🔍 발견 이슈',
                    value: `**${inspectionReport.totalIssuesFound}건**`,
                    inline: true
                },
                {
                    name: '🚨 심각도 분포',
                    value: formatSeverity(inspectionReport.summary),
                    inline: false
                },
                {
                    name: '💡 개선 제안',
                    value: improvementPlan.summary || '요약 없음',
                    inline: false
                },
                {
                    name: '🛠️ 자동 수정',
                    value: autoFixResult ? autoFixResult.summary : '자동 수정 없음',
                    inline: false
                }
            ],
            timestamp: timestamp,
            footer: {
                text: '상권 분석 AI 에이전트 루프 시스템'
            }
        }
    ];

    // 수동 검토 필요 항목이 있으면 두 번째 임베드 추가
    if (improvementPlan.manualReview && improvementPlan.manualReview.length > 0) {
        embeds.push({
            title: '👨‍💻 관리자 수동 검토 필요',
            description: improvementPlan.manualReview
                .map((item, idx) => `**${idx + 1}. [${item.severity}] ${item.title}**\n${item.description}`)
                .join('\n\n')
                .substring(0, 2000), // Discord 제한
            color: 0xFF6B6B
        });
    }

    // 자동 수정된 항목 상세
    if (autoFixResult && autoFixResult.applied && autoFixResult.applied.length > 0) {
        embeds.push({
            title: '✅ 자동 수정 완료 상세',
            description: autoFixResult.applied
                .map(fix => `**${fix.type}**: ${fix.message}`)
                .join('\n')
                .substring(0, 2000),
            color: 0x22C55E
        });
    }

    try {
        const response = await fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: '상권분석 AI 에이전트 🤖',
                avatar_url: 'https://cdn.discordapp.com/embed/avatars/0.png',
                embeds: embeds.slice(0, 10) // Discord 최대 10개
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

/**
 * 이슈 수에 따른 색상 반환
 */
function getColorByIssueCount(count) {
    if (count === 0) return 0x22C55E; // 초록 (이슈 없음)
    if (count <= 5) return 0x3B82F6; // 파랑 (경미)
    if (count <= 15) return 0xF59E0B; // 노랑 (주의)
    return 0xEF4444; // 빨강 (심각)
}

/**
 * 심각도 분포 포맷
 */
function formatSeverity(summary) {
    const parts = [];
    if (summary.critical > 0) parts.push(`🔴 CRITICAL: ${summary.critical}`);
    if (summary.high > 0) parts.push(`🟠 HIGH: ${summary.high}`);
    if (summary.medium > 0) parts.push(`🟡 MEDIUM: ${summary.medium}`);
    if (summary.low > 0) parts.push(`🟢 LOW: ${summary.low}`);
    return parts.join('\n') || '이슈 없음 ✅';
}
