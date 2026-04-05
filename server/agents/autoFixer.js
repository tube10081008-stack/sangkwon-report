/**
 * 🛠️ Auto Fixer
 * 
 * 단순 코드 변경 (배열에 항목 추가, 매핑 추가 등)을 자동으로 적용합니다.
 * 파일을 직접 수정하며, 변경 로그를 남깁니다.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');

/**
 * 개선 계획의 자동 수정 가능한 패치들을 적용
 */
export async function applyAutoFixes(improvementPlan) {
    const { autoFixable, district } = improvementPlan;
    const appliedFixes = [];
    const failedFixes = [];

    if (!autoFixable || autoFixable.length === 0) {
        console.log('   ✅ 자동 수정할 항목이 없습니다.');
        return { applied: [], failed: [], summary: '자동 수정 항목 없음' };
    }

    console.log(`\n🛠️ === Auto Fixer: ${autoFixable.length}건 자동 수정 시작 ===\n`);

    for (const improvement of autoFixable) {
        if (!improvement.patches) continue;

        // 1. KNOWN_FRANCHISES 배열에 항목 추가
        if (improvement.patches.franchiseAdditions && improvement.patches.franchiseAdditions.length > 0) {
            try {
                const result = await addToFranchiseList(improvement.patches.franchiseAdditions);
                appliedFixes.push(result);
                console.log(`   ✅ 프랜차이즈 ${result.addedCount}개 추가 완료`);
            } catch (e) {
                failedFixes.push({ type: 'FRANCHISE_ADD', error: e.message });
                console.error(`   ❌ 프랜차이즈 추가 실패:`, e.message);
            }
        }

        // 2. CATEGORY_DISPLAY_MAP에 매핑 추가
        if (improvement.patches.categoryMappings && Object.keys(improvement.patches.categoryMappings).length > 0) {
            try {
                const result = await addToCategoryMapping(improvement.patches.categoryMappings);
                appliedFixes.push(result);
                console.log(`   ✅ 카테고리 매핑 ${result.addedCount}개 추가 완료`);
            } catch (e) {
                failedFixes.push({ type: 'CATEGORY_MAP_ADD', error: e.message });
                console.error(`   ❌ 카테고리 매핑 추가 실패:`, e.message);
            }
        }
    }

    const summary = `자동 수정 완료: ${appliedFixes.length}건 성공, ${failedFixes.length}건 실패`;
    console.log(`\n   📝 ${summary}`);

    return {
        district,
        timestamp: new Date().toISOString(),
        applied: appliedFixes,
        failed: failedFixes,
        summary
    };
}

/**
 * KNOWN_FRANCHISES 배열에 새 브랜드 추가
 */
async function addToFranchiseList(newBrands) {
    const filePath = path.join(PROJECT_ROOT, 'server/services/storeData.js');
    let content = fs.readFileSync(filePath, 'utf-8');

    // 현재 KNOWN_FRANCHISES 배열 찾기
    const arrayMatch = content.match(/const KNOWN_FRANCHISES\s*=\s*\[([\s\S]*?)\];/);
    if (!arrayMatch) {
        throw new Error('KNOWN_FRANCHISES 배열을 찾을 수 없습니다.');
    }

    // 현재 등록된 브랜드 추출
    const currentBrands = arrayMatch[1].match(/'([^']+)'/g)?.map(s => s.replace(/'/g, '')) || [];

    // 브랜드명 정제: 'CU (편의점)' → 'CU', '교촌치킨/BBQ' → '교촌치킨', 'BBQ'
    const cleanedBrands = [];
    newBrands.forEach(b => {
        // 괄호 안 내용 제거
        let cleaned = b.replace(/\s*\([^)]*\)/g, '').trim();
        // 슬래시로 분리된 경우 각각 추가
        if (cleaned.includes('/')) {
            cleaned.split('/').forEach(part => {
                const p = part.trim();
                if (p) cleanedBrands.push(p);
            });
        } else if (cleaned) {
            cleanedBrands.push(cleaned);
        }
    });

    // 중복 제거하여 새로운 브랜드만 필터링
    const trulyNew = [...new Set(cleanedBrands)].filter(b => !currentBrands.includes(b));

    if (trulyNew.length === 0) {
        return { type: 'FRANCHISE_ADD', addedCount: 0, message: '추가할 새 브랜드 없음 (이미 모두 등록됨)' };
    }

    // 배열 마지막에 추가
    const newEntries = trulyNew.map(b => `    '${b}'`).join(',\n');
    const lastBrandMatch = arrayMatch[1].lastIndexOf("'");
    const insertPos = content.indexOf(arrayMatch[0]) + arrayMatch[0].indexOf(']');

    // 기존 배열 닫는 ] 앞에 새 항목 삽입
    const oldArray = arrayMatch[0];
    const oldContent = arrayMatch[1].trimEnd();
    const newArray = `const KNOWN_FRANCHISES = [${oldContent},\n    // === Auto-added by Agent Loop (${new Date().toISOString().split('T')[0]}) ===\n${newEntries}\n];`;

    content = content.replace(oldArray, newArray);
    fs.writeFileSync(filePath, content, 'utf-8');

    return {
        type: 'FRANCHISE_ADD',
        addedCount: trulyNew.length,
        addedBrands: trulyNew,
        file: 'server/services/storeData.js',
        message: `KNOWN_FRANCHISES에 ${trulyNew.length}개 브랜드 추가: ${trulyNew.join(', ')}`
    };
}

/**
 * CATEGORY_DISPLAY_MAP에 새 매핑 추가
 */
async function addToCategoryMapping(newMappings) {
    const filePath = path.join(PROJECT_ROOT, 'server/services/storeData.js');
    let content = fs.readFileSync(filePath, 'utf-8');

    // 현재 CATEGORY_DISPLAY_MAP 찾기
    const mapMatch = content.match(/const CATEGORY_DISPLAY_MAP\s*=\s*\{([\s\S]*?)\};/);
    if (!mapMatch) {
        throw new Error('CATEGORY_DISPLAY_MAP 객체를 찾을 수 없습니다.');
    }

    // 현재 등록된 매핑 추출
    const currentMappings = {};
    const entryMatches = mapMatch[1].matchAll(/'([^']+)'\s*:\s*'([^']+)'/g);
    for (const m of entryMatches) {
        currentMappings[m[1]] = m[2];
    }

    // 중복 제거
    const trulyNew = {};
    Object.entries(newMappings).forEach(([from, to]) => {
        if (!currentMappings[from]) {
            trulyNew[from] = to;
        }
    });

    const newCount = Object.keys(trulyNew).length;
    if (newCount === 0) {
        return { type: 'CATEGORY_MAP_ADD', addedCount: 0, message: '추가할 새 매핑 없음' };
    }

    // 기존 객체에 새 매핑 추가
    const newEntries = Object.entries(trulyNew)
        .map(([from, to]) => `    '${from}': '${to}'`)
        .join(',\n');

    const oldMap = mapMatch[0];
    const oldContent = mapMatch[1].trimEnd();
    const newMap = `const CATEGORY_DISPLAY_MAP = {${oldContent},\n    // === Auto-added by Agent Loop (${new Date().toISOString().split('T')[0]}) ===\n${newEntries}\n};`;

    content = content.replace(oldMap, newMap);
    fs.writeFileSync(filePath, content, 'utf-8');

    return {
        type: 'CATEGORY_MAP_ADD',
        addedCount: newCount,
        addedMappings: trulyNew,
        file: 'server/services/storeData.js',
        message: `CATEGORY_DISPLAY_MAP에 ${newCount}개 매핑 추가`
    };
}

/**
 * 변경 로그 저장
 */
export function saveChangeLog(district, fixes) {
    const logDir = path.join(PROJECT_ROOT, 'loop-history');
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const logFile = path.join(logDir, `changes_${dateStr}_${district}.json`);

    fs.writeFileSync(logFile, JSON.stringify(fixes, null, 2), 'utf-8');
    console.log(`   📄 변경 로그 저장: ${logFile}`);
    return logFile;
}
