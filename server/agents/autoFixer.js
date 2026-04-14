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

async function addToFranchiseList(newBrands) {
    const filePath = path.join(PROJECT_ROOT, 'server/data/franchises.json');
    let currentBrands = [];
    if (fs.existsSync(filePath)) {
        currentBrands = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }

    const cleanedBrands = [];
    newBrands.forEach(b => {
        let cleaned = b.replace(/\s*\([^)]*\)/g, '').trim();
        if (cleaned.includes('/')) {
            cleaned.split('/').forEach(part => {
                const p = part.trim();
                if (p) cleanedBrands.push(p);
            });
        } else if (cleaned) {
            cleanedBrands.push(cleaned);
        }
    });

    const trulyNew = [...new Set(cleanedBrands)].filter(b => !currentBrands.includes(b));

    if (trulyNew.length === 0) {
        return { type: 'FRANCHISE_ADD', addedCount: 0, message: '추가할 새 브랜드 없음 (이미 모두 등록됨)' };
    }

    const updatedBrands = [...currentBrands, ...trulyNew];
    fs.writeFileSync(filePath, JSON.stringify(updatedBrands, null, 2), 'utf-8');

    return {
        type: 'FRANCHISE_ADD',
        addedCount: trulyNew.length,
        addedBrands: trulyNew,
        file: 'server/data/franchises.json',
        message: `franchises.json에 ${trulyNew.length}개 브랜드 추가: ${trulyNew.join(', ')}`
    };
}

async function addToCategoryMapping(newMappings) {
    const filePath = path.join(PROJECT_ROOT, 'server/data/categories.json');
    let currentMappings = {};
    if (fs.existsSync(filePath)) {
        currentMappings = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }

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

    const updatedMappings = { ...currentMappings, ...trulyNew };
    fs.writeFileSync(filePath, JSON.stringify(updatedMappings, null, 2), 'utf-8');

    return {
        type: 'CATEGORY_MAP_ADD',
        addedCount: newCount,
        addedMappings: trulyNew,
        file: 'server/data/categories.json',
        message: `categories.json에 ${newCount}개 매핑 추가`
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
