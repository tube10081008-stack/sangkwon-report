/**
 * 💡 Agent 2: Advisor (개선 에이전트)
 * 
 * Inspector가 발견한 이슈를 분석하고, 구체적인 개선 방안과 코드 변경 제안을 생성합니다.
 */

import { askGemini } from '../services/geminiService.js';

/**
 * 이슈 리포트를 분석하여 개선 제안서 생성
 */
export async function generateImprovementPlan(inspectionReport) {
    const { district, results, totalIssuesFound } = inspectionReport;

    console.log(`\n💡 === Advisor: ${district} 개선안 도출 시작 (${totalIssuesFound}건 이슈) ===\n`);

    // 모든 이슈를 통합 수집
    const allIssues = [];
    results.forEach(r => {
        if (r.issues) {
            r.issues.forEach(issue => allIssues.push({ ...issue, sourceAddress: r.address }));
        }
    });

    if (allIssues.length === 0) {
        console.log('   ✅ 이슈가 없습니다. 개선안 불필요.');
        return {
            district,
            timestamp: new Date().toISOString(),
            totalIssues: 0,
            improvements: [],
            autoFixable: [],
            manualReview: [],
            summary: '모든 검증을 통과했습니다. 개선이 필요한 사항이 없습니다.'
        };
    }

    // 이슈를 유형별로 그룹핑
    const groupedIssues = {};
    allIssues.forEach(issue => {
        const type = issue.type || 'UNKNOWN';
        if (!groupedIssues[type]) groupedIssues[type] = [];
        groupedIssues[type].push(issue);
    });

    // 각 이슈 그룹에 대해 개선안 생성
    const improvements = [];
    const autoFixable = [];
    const manualReview = [];

    for (const [type, issues] of Object.entries(groupedIssues)) {
        try {
            const improvement = await generateImprovementForType(type, issues, district);
            improvements.push(improvement);

            if (improvement.autoFixable) {
                autoFixable.push(improvement);
            } else {
                manualReview.push(improvement);
            }
        } catch (e) {
            console.warn(`   ⚠️ ${type} 개선안 생성 실패:`, e.message);
        }
    }

    // 전체 요약 생성
    const summaryPrompt = `당신은 상권 분석 서비스 품질 관리 전문가입니다.
${district} 지역 검증 결과를 요약해주세요.

[발견된 이슈 요약]:
${improvements.map(imp => `- [${imp.severity}] ${imp.title}: ${imp.description}`).join('\n')}

[자동 수정 가능]: ${autoFixable.length}건
[수동 검토 필요]: ${manualReview.length}건

3-4문장으로 핵심만 요약하세요. 이모지를 사용하세요.`;

    let summary = '';
    try {
        summary = await askGemini(summaryPrompt, null, '품질 관리 요약 전문가. 간결하게 답변.');
    } catch (e) {
        summary = `${district} 검증 완료: ${totalIssuesFound}건 이슈 발견, ${autoFixable.length}건 자동 수정 가능`;
    }

    return {
        district,
        timestamp: new Date().toISOString(),
        totalIssues: allIssues.length,
        improvements,
        autoFixable,
        manualReview,
        summary
    };
}

/**
 * 이슈 유형별 개선안 생성
 */
async function generateImprovementForType(type, issues, district) {
    const issueDescriptions = issues.map(i => i.description).join('; ');
    const firstIssue = issues[0];
    const isAutoFixable = issues.some(i => i.autoFixable);

    // 자동 수정 가능한 이슈 (KNOWN_FRANCHISES 추가, CATEGORY_DISPLAY_MAP 추가 등)
    if (isAutoFixable) {
        return generateAutoFixImprovement(type, issues);
    }

    // 수동 검토 필요한 이슈 → Gemini에게 구체적 개선 방안 요청
    const prompt = `당신은 Node.js 백엔드 및 상권 분석 시스템 전문 개발자입니다.
아래 이슈에 대한 구체적인 코드 개선 방안을 제안해주세요.

[이슈 유형]: ${type}
[발생 횟수]: ${issues.length}건
[상세 내용]:
${issues.slice(0, 5).map(i => `- ${i.description}`).join('\n')}

[현재 시스템 구조]:
- server/services/storeData.js: 상가업소 데이터 조회 및 프랜차이즈 분석
- server/services/analyzer.js: 6대 지표 산출 및 등급 부여
- server/services/aiConsultant.js: 규칙 기반 AI 코멘트 생성
- server/services/geminiService.js: Gemini API 호출

반드시 아래 JSON 형식으로만 응답하세요:
{
  "title": "개선안 제목",
  "description": "개선안 상세 설명",
  "targetFiles": ["수정 대상 파일 경로"],
  "codeChanges": [
    {"file": "파일명", "changeType": "add/modify/delete", "description": "변경 내용 설명"}
  ],
  "priority": "HIGH/MEDIUM/LOW",
  "estimatedEffort": "시간 단위 추정치"
}`;

    try {
        const response = await askGemini(prompt, null,
            '시스템 개선 전문가. JSON만 반환하세요. 마크다운 코드블록 없이 순수 JSON만 반환.');

        const parsed = safeParseJSON(response);
        if (parsed) {
            return {
                type,
                severity: firstIssue.severity || 'MEDIUM',
                autoFixable: false,
                issueCount: issues.length,
                ...parsed
            };
        }
    } catch (e) {
        console.warn(`   ⚠️ Gemini 개선안 생성 실패 (${type}):`, e.message);
    }

    // Gemini 실패 시 기본 개선안
    return {
        type,
        severity: firstIssue.severity || 'MEDIUM',
        autoFixable: false,
        issueCount: issues.length,
        title: `${type} 관련 개선 필요`,
        description: issueDescriptions,
        targetFiles: [firstIssue.fixTarget?.file || '수동 확인 필요'],
        codeChanges: [],
        priority: firstIssue.severity === 'CRITICAL' ? 'HIGH' : 'MEDIUM',
        estimatedEffort: '확인 필요'
    };
}

/**
 * 자동 수정 가능한 이슈에 대한 구체적 패치 생성
 */
function generateAutoFixImprovement(type, issues) {
    // 모든 자동 수정 대상을 통합
    const allAdditions = {};
    const allMappings = {};

    issues.forEach(issue => {
        if (!issue.fixTarget) return;

        // KNOWN_FRANCHISES 배열 추가
        if (issue.fixTarget.array === 'KNOWN_FRANCHISES' && issue.fixTarget.additions) {
            issue.fixTarget.additions.forEach(item => {
                allAdditions[item] = true;
            });
        }

        // CATEGORY_DISPLAY_MAP 매핑 추가
        if (issue.fixTarget.object === 'CATEGORY_DISPLAY_MAP' && issue.fixTarget.additions) {
            Object.entries(issue.fixTarget.additions).forEach(([from, to]) => {
                allMappings[from] = to;
            });
        }
    });

    const additionsList = Object.keys(allAdditions);
    const mappingsList = Object.entries(allMappings);

    return {
        type,
        severity: issues[0].severity || 'MEDIUM',
        autoFixable: true,
        issueCount: issues.length,
        title: `${type} 자동 수정`,
        description: `데이터 추가/수정으로 해결 가능한 이슈 ${issues.length}건`,
        targetFiles: [...new Set(issues.map(i => i.fixTarget?.file).filter(Boolean))],
        patches: {
            franchiseAdditions: additionsList.length > 0 ? additionsList : undefined,
            categoryMappings: mappingsList.length > 0 ? Object.fromEntries(mappingsList) : undefined
        },
        priority: 'HIGH',
        estimatedEffort: '자동 (< 1분)'
    };
}

/**
 * JSON 안전 파싱 유틸리티 (Inspector와 동일)
 */
function safeParseJSON(text) {
    try {
        let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
        return JSON.parse(cleaned);
    } catch (e) {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                return JSON.parse(jsonMatch[0]);
            } catch (e2) {
                return null;
            }
        }
        return null;
    }
}
