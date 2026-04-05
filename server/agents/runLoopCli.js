/**
 * 🔄 에이전트 루프 CLI 스크립트
 * 
 * 사용법:
 *   node server/agents/runLoopCli.js                  → 오늘의 구 자동 실행
 *   node server/agents/runLoopCli.js 강남구            → 특정 구 실행
 *   node server/agents/runLoopCli.js --list            → 구 목록 출력
 *   node server/agents/runLoopCli.js --today           → 오늘의 구 확인
 *   node server/agents/runLoopCli.js --stats           → 전체 통계
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../..', '.env') });

import { runLoop, getTodayDistrict, getAvailableDistricts, getOverallStats, getLoopHistory } from './loopController.js';

const args = process.argv.slice(2);

async function main() {
    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
🔄 에이전트 루프 CLI

사용법:
  node server/agents/runLoopCli.js                  오늘의 구 자동 실행
  node server/agents/runLoopCli.js [구이름]          특정 구 실행
  node server/agents/runLoopCli.js --list            구 목록 보기
  node server/agents/runLoopCli.js --today           오늘의 검증 대상
  node server/agents/runLoopCli.js --stats           전체 통계
  node server/agents/runLoopCli.js --history         최근 히스토리
        `);
        return;
    }

    if (args.includes('--list')) {
        const districts = getAvailableDistricts();
        console.log(`\n🗺️  서울 25개 구 (${districts.length}개)\n`);
        districts.forEach(d => {
            console.log(`  📍 ${d.name} — ${d.addressCount}개 주소`);
        });
        return;
    }

    if (args.includes('--today')) {
        const today = getTodayDistrict();
        console.log(`\n📅 오늘의 검증 대상: ${today}\n`);
        return;
    }

    if (args.includes('--stats')) {
        const stats = getOverallStats();
        console.log(`\n📊 전체 통계\n`);
        console.log(`  🔄 총 루프: ${stats.totalLoops}회`);
        console.log(`  🔍 총 이슈: ${stats.totalIssues}건`);
        console.log(`  🛠️ 자동수정: ${stats.totalAutoFixed}건`);
        console.log(`  👨‍💻 수동검토: ${stats.totalManualReview}건`);
        console.log(`  🗺️ 검증구: ${stats.districtsVerified}/25`);
        console.log(`  ✅ 성공률: ${stats.successRate}`);
        console.log(`  📅 마지막: ${stats.lastRun}`);
        console.log(`  📍 오늘: ${stats.todayDistrict}\n`);
        return;
    }

    if (args.includes('--history')) {
        const history = getLoopHistory(10);
        console.log(`\n📋 최근 루프 히스토리 (${history.length}건)\n`);
        history.forEach(h => {
            const icon = h.status === 'completed' ? '✅' : '❌';
            console.log(`  ${icon} #${h.loopNumber || '?'} ${h.district} — 이슈${h.totalIssues || 0} 수정${h.autoFixed || 0} (${h.elapsedSeconds || '?'}s)`);
        });
        return;
    }

    // 루프 실행
    const district = args[0] || null;
    console.log(`\n🚀 에이전트 루프 시작: ${district || getTodayDistrict()} (오늘의 구)\n`);

    try {
        const result = await runLoop(district);
        console.log(`\n🏁 결과 요약:`);
        console.log(`   구: ${result.district}`);
        console.log(`   상태: ${result.status}`);
        console.log(`   이슈: ${result.inspectionReport?.totalIssuesFound || 0}건`);
        console.log(`   자동수정: ${result.autoFixResult?.applied?.length || 0}건`);
        console.log(`   소요시간: ${result.elapsedSeconds}초`);
    } catch (e) {
        console.error('❌ 루프 실패:', e.message);
        process.exit(1);
    }
}

main();
