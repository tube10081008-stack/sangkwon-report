/**
 * 🔄 Loop Controller (오케스트레이터)
 * 
 * 전체 에이전트 루프를 제어합니다.
 * Inspector → Advisor → AutoFixer → Discord 순으로 실행하며,
 * 루프 히스토리를 관리합니다.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { inspectDistrict } from './agentInspector.js';
import { generateImprovementPlan } from './agentAdvisor.js';
// AutoFixer 삭제됨 — V2에서는 에이전트가 코드/데이터를 자동 수정하지 않음
import { sendLoopResult } from './discordNotifier.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');

// 테스트 케이스 로드
const testCasesPath = path.join(__dirname, 'testCases.json');
let testCases = null;

function loadTestCases() {
    if (!testCases) {
        testCases = JSON.parse(fs.readFileSync(testCasesPath, 'utf-8'));
    }
    return testCases;
}

/**
 * 오늘의 검증 대상 구 결정 (25일 주기 순환)
 */
export function getTodayDistrict() {
    const cases = loadTestCases();
    const districts = Object.keys(cases.districts);
    const dayOfYear = getDayOfYear();
    const index = dayOfYear % districts.length;
    return districts[index];
}

/**
 * 루프 1사이클 실행 (특정 구)
 */
export async function runLoop(districtName = null) {
    const cases = loadTestCases();
    const district = districtName || getTodayDistrict();
    const addresses = cases.districts[district]?.addresses;

    if (!addresses) {
        throw new Error(`구 "${district}"을(를) 찾을 수 없습니다. 사용 가능: ${Object.keys(cases.districts).join(', ')}`);
    }

    const loopNumber = getNextLoopNumber();
    const startTime = Date.now();

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🔄 서비스 QA #${loopNumber} 시작`);
    console.log(`📍 대상: ${district} (${addresses.length}개 주소)`);
    console.log(`⏰ 시작: ${new Date().toISOString()}`);
    console.log(`${'═'.repeat(60)}\n`);

    const loopResult = {
        loopNumber,
        district,
        timestamp: new Date().toISOString(),
        status: 'running',
        steps: []
    };

    try {
        // Step 1: QA 검증
        console.log('\n📌 Step 1/3: 서비스 QA 검증 시작...');
        loopResult.steps.push({ step: 1, name: 'QA Inspector', status: 'running', startedAt: new Date().toISOString() });

        const inspectionReport = await inspectDistrict(district, addresses, cases.testCategories);
        loopResult.inspectionReport = inspectionReport;
        loopResult.steps[0].status = 'completed';
        loopResult.steps[0].completedAt = new Date().toISOString();
        loopResult.steps[0].issuesFound = inspectionReport.totalIssuesFound;

        console.log(`\n   ✅ QA 완료: ${inspectionReport.totalIssuesFound}건 이슈 발견`);

        // Step 2: QA 요약 리포트 생성
        console.log('\n📌 Step 2/3: QA 요약 리포트 생성...');
        loopResult.steps.push({ step: 2, name: 'Reporter', status: 'running', startedAt: new Date().toISOString() });

        const improvementPlan = await generateImprovementPlan(inspectionReport);
        loopResult.improvementPlan = improvementPlan;
        loopResult.autoFixResult = { applied: [], failed: [], summary: 'V2: 자동 수정 비활성화' };
        loopResult.steps[1].status = 'completed';
        loopResult.steps[1].completedAt = new Date().toISOString();
        loopResult.steps[1].manualReview = improvementPlan.manualReview.length;

        console.log(`\n   ✅ 리포트 완료: ${improvementPlan.manualReview.length}건 점검 필요`);

        // Step 3: Discord 알림
        console.log('\n📌 Step 3/3: Discord 알림 전송...');
        loopResult.steps.push({ step: 3, name: 'Discord', status: 'running', startedAt: new Date().toISOString() });

        const discordResult = await sendLoopResult(loopResult);
        loopResult.steps[2].status = 'completed';
        loopResult.steps[2].completedAt = new Date().toISOString();
        loopResult.steps[2].sent = discordResult.sent;

        loopResult.status = 'completed';

    } catch (error) {
        console.error('\n❌ 루프 실행 오류:', error.message);
        loopResult.status = 'failed';
        loopResult.error = error.message;
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    loopResult.elapsedSeconds = parseFloat(elapsed);

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🏁 QA #${loopNumber} 완료: ${elapsed}초 소요`);
    console.log(`   상태: ${loopResult.status}`);
    console.log(`${'═'.repeat(60)}\n`);

    // 루프 히스토리 저장
    saveLoopHistory(loopResult);

    return loopResult;
}

/**
 * 루프 히스토리 저장
 */
function saveLoopHistory(loopResult) {
    const historyDir = path.join(PROJECT_ROOT, 'loop-history');
    if (!fs.existsSync(historyDir)) {
        fs.mkdirSync(historyDir, { recursive: true });
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const historyFile = path.join(historyDir, `loop_${dateStr}_${loopResult.district}.json`);

    // 대용량 데이터 제거 (stores 배열 등)
    const simplified = { ...loopResult };
    if (simplified.inspectionReport?.results) {
        simplified.inspectionReport.results = simplified.inspectionReport.results.map(r => ({
            address: r.address,
            totalIssues: r.totalIssues,
            issuesBySeverity: r.issuesBySeverity,
            issues: r.issues,
            analysisSnapshot: r.analysisSnapshot
        }));
    }

    fs.writeFileSync(historyFile, JSON.stringify(simplified, null, 2), 'utf-8');
    console.log(`   📄 루프 히스토리 저장: ${historyFile}`);
}

/**
 * 루프 히스토리 조회
 */
export function getLoopHistory(limit = 30) {
    const historyDir = path.join(PROJECT_ROOT, 'loop-history');
    if (!fs.existsSync(historyDir)) {
        return [];
    }

    const files = fs.readdirSync(historyDir)
        .filter(f => f.startsWith('loop_') && f.endsWith('.json'))
        .sort()
        .reverse()
        .slice(0, limit);

    return files.map(f => {
        try {
            const content = JSON.parse(fs.readFileSync(path.join(historyDir, f), 'utf-8'));
            return {
                filename: f,
                loopNumber: content.loopNumber,
                district: content.district,
                timestamp: content.timestamp,
                status: content.status,
                totalIssues: content.inspectionReport?.totalIssuesFound || 0,
                autoFixed: content.autoFixResult?.applied?.length || 0,
                manualReview: content.improvementPlan?.manualReview?.length || 0,
                elapsedSeconds: content.elapsedSeconds
            };
        } catch (e) {
            return { filename: f, error: e.message };
        }
    });
}

/**
 * 특정 루프 상세 조회
 */
export function getLoopDetail(filename) {
    const historyDir = path.join(PROJECT_ROOT, 'loop-history');
    const filePath = path.join(historyDir, filename);

    if (!fs.existsSync(filePath)) {
        return null;
    }

    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

/**
 * 현재 루프 상태 (실행 중인 루프가 있는지)
 */
let currentLoop = null;

export function getCurrentLoopStatus() {
    return currentLoop;
}

export function setCurrentLoop(loop) {
    currentLoop = loop;
}

/**
 * 사용 가능한 구 목록 반환
 */
export function getAvailableDistricts() {
    const cases = loadTestCases();
    return Object.entries(cases.districts).map(([name, data]) => ({
        name,
        addressCount: data.addresses.length,
        addresses: data.addresses
    }));
}

/**
 * 전체 통계 요약
 */
export function getOverallStats() {
    const history = getLoopHistory(100);

    const totalLoops = history.length;
    const totalIssues = history.reduce((sum, h) => sum + (h.totalIssues || 0), 0);
    const totalAutoFixed = history.reduce((sum, h) => sum + (h.autoFixed || 0), 0);
    const totalManualReview = history.reduce((sum, h) => sum + (h.manualReview || 0), 0);
    const districtsVerified = [...new Set(history.map(h => h.district))].length;
    const successRate = totalLoops > 0
        ? ((history.filter(h => h.status === 'completed').length / totalLoops) * 100).toFixed(1)
        : 0;

    return {
        totalLoops,
        totalIssues,
        totalAutoFixed,
        totalManualReview,
        districtsVerified,
        successRate: `${successRate}%`,
        lastRun: history[0]?.timestamp || '없음',
        todayDistrict: getTodayDistrict()
    };
}

// ========== Utility ==========

function getDayOfYear() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now - start;
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
}

function getNextLoopNumber() {
    const history = getLoopHistory(1);
    if (history.length > 0 && history[0].loopNumber) {
        return history[0].loopNumber + 1;
    }
    return 1;
}
