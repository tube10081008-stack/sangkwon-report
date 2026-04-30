/**
 * 서울시 열린데이터광장 상권분석서비스 통합 모듈
 * 12종 API를 한번에 조회하여 서울 특화 상권 분석 데이터 제공
 * 
 * 데이터 출처:
 * - 유동인구: 서울시 + KT 통신
 * - 직장인구: SKT 통신
 * - 상주인구: 서울시 주민등록
 * - 추정매출: 신한카드
 * - 소득소비: KB카드 + 국민건강보험공단
 * - 아파트: 서울시
 * - 점포정보: 서울시 + 카드사
 * - 집객시설: 각급기관
 */

const SEOUL_BASE = 'http://openapi.seoul.go.kr:8088';

// API 서비스명 매핑
const SERVICES = {
    region:          'TbgisTrdarRelm',          // 영역-상권 (상권코드 매핑)
    floatingPop:     'VwsmTrdarFlpopQq',        // 유동인구-상권
    workingPop:      'VwsmTrdarWrkPopltnQq',    // 직장인구-상권
    residentPop:     'VwsmTrdarPopltnQq',       // 상주인구-상권
    sales:           'VwsmTrdarSelngQq',         // 추정매출-상권
    incomeSpending:  'VwsmTrdhlNcmCnsmpQq',    // 소득소비-상권배후지 (실제 월평균소득 데이터)
    apartment:       'VwsmTrdarAptQq',          // 아파트-상권
    store:           'VwsmTrdarStorQq',          // 점포-상권
    changeIndex:     'VwsmTrdarChgIndQq',       // 상권변화지표-상권
    facility:        'VwsmTrdarFcltyQq',        // 집객시설-상권
    bgdFloatingPop:  'VwsmTrdarFlpopQqBgd',     // 유동인구-상권배후지
    bgdResidentPop:  'VwsmTrdarPopltnQqBgd',    // 상주인구-상권배후지
};

/**
 * 서울시 API 단건 호출 헬퍼
 */
async function callSeoulAPI(apiKey, serviceName, start = 1, end = 5) {
    const url = `${SEOUL_BASE}/${apiKey}/json/${serviceName}/${start}/${end}/`;
    try {
        const res = await fetch(url, { timeout: 8000 });
        if (!res.ok) return null;
        const data = await res.json();
        return data?.[serviceName]?.row || null;
    } catch (e) {
        console.warn(`서울 API [${serviceName}] 호출 실패:`, e.message);
        return null;
    }
}

/**
 * 단일 페이지 fetch + 재시도 (최대 2회)
 */
async function fetchPageWithRetry(url, serviceName, maxRetries = 2) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const res = await fetch(url, { timeout: 20000 });
            if (!res.ok) { await new Promise(r => setTimeout(r, 300)); continue; }
            const data = await res.json();
            if (data[serviceName]?.row) return data[serviceName].row;
            return [];
        } catch (e) {
            if (attempt < maxRetries) await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        }
    }
    return [];
}

// URL 필터링 우선 시도 서비스 목록
// 서울시 열린데이터 API는 /{분기}/{상권코드} 패턴을 대부분 지원
// 실패 시(빈 결과) 전수 스캔으로 자동 폴백
const URL_FILTERABLE_SERVICES = new Set([
    'VwsmTrdarStorQq',       // 점포
    'VwsmTrdarSelngQq',      // 추정매출 (신한카드) ← P0 핵심
    'VwsmTrdarFlpopQq',      // 유동인구 (KT)
    'VwsmTrdarWrkPopltnQq',  // 직장인구 (SKT)
    'VwsmTrdarPopltnQq',     // 상주인구
    'VwsmTrdarChgIndQq',     // 상권변화지표
    'VwsmTrdarFcltyQq',      // 집객시설
    'VwsmTrdhlNcmCnsmpQq',   // 소득소비
    'VwsmTrdarAptQq',        // 아파트
]);

/**
 * 상권코드로 특정 API 조회 (하이브리드: URL필터 or 배치순차스캔)
 */
async function callSeoulAPIByTrdarCd(apiKey, serviceName, trdarCd) {
    try {
        // 1. 최신 분기 자동 탐색
        let targetQuarter = null;
        let totalCount = 0;
        
        const quartersToTry = ['20244', '20243', '20242', '20241', '20234', '20233', '20232', '20231'];
        for (const q of quartersToTry) {
            const initRes = await fetch(`${SEOUL_BASE}/${apiKey}/json/${serviceName}/1/1/${q}`, { timeout: 5000 }).catch(() => null);
            if (initRes && initRes.ok) {
                try {
                    const initData = await initRes.json();
                    if (initData[serviceName] && initData[serviceName].list_total_count > 0) {
                        totalCount = initData[serviceName].list_total_count;
                        targetQuarter = q;
                        break;
                    }
                } catch (e) {}
            }
        }

        console.log(`[SeoulAPI] ${serviceName} Quarter: ${targetQuarter}, Total: ${totalCount}`);
        if (!targetQuarter || totalCount === 0) return null;

        // 2-A. URL 필터링 우선 시도: 상권코드로 직접 필터링 (1회 호출)
        if (URL_FILTERABLE_SERVICES.has(serviceName)) {
            try {
                const url = `${SEOUL_BASE}/${apiKey}/json/${serviceName}/1/1000/${targetQuarter}/${trdarCd}`;
                const rows = await fetchPageWithRetry(url, serviceName);
                if (rows.length > 0) {
                    console.log(`[SeoulAPI] ${serviceName} (URL필터 성공) -> ${rows.length} rows`);
                    return rows;
                }
                console.warn(`[SeoulAPI] ${serviceName} URL필터 빈 결과 → 전수 스캔 폴백`);
            } catch (e) {
                console.warn(`[SeoulAPI] ${serviceName} URL필터 실패 → 전수 스캔 폴백:`, e.message);
            }
        }

        // 2-B. 전수 스캔 폴백: 배치 순차 처리 (동시 5페이지씩, 확대)
        const BATCH_SIZE = 5;
        const pages = Math.ceil(totalCount / 1000);
        let allRows = [];

        for (let batchStart = 0; batchStart < pages; batchStart += BATCH_SIZE) {
            const batch = [];
            for (let i = batchStart; i < Math.min(batchStart + BATCH_SIZE, pages); i++) {
                const url = `${SEOUL_BASE}/${apiKey}/json/${serviceName}/${i * 1000 + 1}/${(i + 1) * 1000}/${targetQuarter}`;
                batch.push(fetchPageWithRetry(url, serviceName));
            }
            const batchResults = await Promise.all(batch);
            batchResults.forEach(rows => { allRows = allRows.concat(rows); });

            // 이미 타겟 상권이 발견되면 조기 종료
            const found = allRows.filter(r => r.TRDAR_CD === String(trdarCd));
            if (found.length > 0) break;
        }

        console.log(`[SeoulAPI] ${serviceName} Scanned ${allRows.length}/${totalCount} rows`);
        if (allRows.length === 0) return null;

        const filteredRows = allRows.filter(r => r.TRDAR_CD === String(trdarCd));
        console.log(`[SeoulAPI] ${serviceName} TRDAR_CD ${trdarCd} -> ${filteredRows.length} matched`);
        
        return filteredRows.length > 0 ? filteredRows : null;
    } catch (e) {
        console.error(`[SeoulAPI] ERROR ${serviceName}:`, e.message);
        return null;
    }
}

/**
 * 좌표로 대표 상권 코드 찾기
 * 매칭 우선순위: 발달상권(D) > 전통시장(R) > 골목상권(A) (500m 이내)
 * → 입지 분석에는 해당 지역의 대표 상권 규모가 반영되어야 정확한 비교 가능
 */
async function findNearestTrdarCd(apiKey, lat, lng) {
    const [page1, page2] = await Promise.all([
        callSeoulAPI(apiKey, SERVICES.region, 1, 1000),
        callSeoulAPI(apiKey, SERVICES.region, 1001, 1671)
    ]);
    const rows = [...(page1 || []), ...(page2 || [])];
    if (rows.length === 0) return null;

    // 상권 유형별 우선순위 (발달상권이 가장 대표성 높음)
    const TYPE_PRIORITY = { 'D': 1, 'R': 2, 'A': 3 };
    const MAX_RANGE = 500; // 500m 이내만 후보

    const candidates = [];

    rows.forEach(r => {
        const tx = parseFloat(r.XCNTS_VALUE);
        const ty = parseFloat(r.YDNTS_VALUE);
        if (!tx || !ty) return;
        
        const rLng = (tx - 200000) / 100000 + 127;
        const rLat = (ty - 500000) / 110000 + 38;
        
        const dlat = (rLat - lat) * 111320;
        const dlng = (rLng - lng) * 111320 * Math.cos(lat * Math.PI / 180);
        const dist = Math.sqrt(dlat * dlat + dlng * dlng);

        if (dist <= MAX_RANGE) {
            candidates.push({
                trdarCd: r.TRDAR_CD,
                trdarNm: r.TRDAR_CD_NM,
                trdarSe: r.TRDAR_SE_CD_NM,
                trdarSeCode: r.TRDAR_SE_CD,
                admDong: r.ADSTRD_CD_NM,
                signgu: r.SIGNGU_CD_NM,
                distance: Math.round(dist),
                area: parseFloat(r.RELM_AR) || 0,
                priority: TYPE_PRIORITY[r.TRDAR_SE_CD] || 99,
            });
        }
    });

    if (candidates.length === 0) {
        // 500m 내 없으면 전체에서 최단거리
        let nearest = null;
        let minDist = Infinity;
        rows.forEach(r => {
            const tx = parseFloat(r.XCNTS_VALUE);
            const ty = parseFloat(r.YDNTS_VALUE);
            if (!tx || !ty) return;
            const rLng = (tx - 200000) / 100000 + 127;
            const rLat = (ty - 500000) / 110000 + 38;
            const dlat = (rLat - lat) * 111320;
            const dlng = (rLng - lng) * 111320 * Math.cos(lat * Math.PI / 180);
            const dist = Math.sqrt(dlat * dlat + dlng * dlng);
            if (dist < minDist) {
                minDist = dist;
                nearest = { trdarCd: r.TRDAR_CD, trdarNm: r.TRDAR_CD_NM, trdarSe: r.TRDAR_SE_CD_NM, admDong: r.ADSTRD_CD_NM, signgu: r.SIGNGU_CD_NM, distance: Math.round(dist), area: parseFloat(r.RELM_AR) || 0 };
            }
        });
        return nearest;
    }

    // 우선순위 정렬: 1) 상권유형(발달>전통>골목) 2) 거리
    candidates.sort((a, b) => a.priority - b.priority || a.distance - b.distance);
    const best = candidates[0];
    
    console.log(`   후보 상권 ${candidates.length}개 중 선택: ${best.trdarNm} (${best.trdarSe}, ${best.distance}m)`);
    if (candidates.length > 1) {
        console.log(`   기각된 후보: ${candidates.slice(1, 4).map(c => `${c.trdarNm}(${c.trdarSe},${c.distance}m)`).join(', ')}`);
    }

    return best;
}

/**
 * ===== 데이터 파서들 =====
 */

// 분기 코드 헬퍼: STDR_YYQU_CD("20243") 또는 STDR_YY_CD+STDR_QU_CD 양쪽 모두 대응
function extractQuarter(row) {
    if (row.STDR_YY_CD && row.STDR_QU_CD) {
        return `${row.STDR_YY_CD}년 ${row.STDR_QU_CD}분기`;
    }
    if (row.STDR_YYQU_CD) {
        const code = String(row.STDR_YYQU_CD);
        return `${code.substring(0, 4)}년 ${code.substring(4)}분기`;
    }
    return '분기정보없음';
}

function parseFloatingPop(rows) {
    if (!rows || rows.length === 0) return null;
    const row = rows[0];
    return {
        total: parseInt(row.TOT_FLPOP_CO) || 0,
        male: parseInt(row.ML_FLPOP_CO) || 0,
        female: parseInt(row.FML_FLPOP_CO) || 0,
        age: {
            '10대': parseInt(row.AGRDE_10_FLPOP_CO) || 0,
            '20대': parseInt(row.AGRDE_20_FLPOP_CO) || 0,
            '30대': parseInt(row.AGRDE_30_FLPOP_CO) || 0,
            '40대': parseInt(row.AGRDE_40_FLPOP_CO) || 0,
            '50대': parseInt(row.AGRDE_50_FLPOP_CO) || 0,
            '60대+': parseInt(row.AGRDE_60_ABOVE_FLPOP_CO) || 0,
        },
        time: {
            '오전': (parseInt(row.TMZON_06_11_FLPOP_CO) || 0) + (parseInt(row.TMZON_11_14_FLPOP_CO) || 0),
            '오후': (parseInt(row.TMZON_14_17_FLPOP_CO) || 0) + (parseInt(row.TMZON_17_21_FLPOP_CO) || 0),
            '야간': (parseInt(row.TMZON_21_24_FLPOP_CO) || 0) + (parseInt(row.TMZON_00_06_FLPOP_CO) || 0),
        },
        byDay: {
            '월': parseInt(row.MON_FLPOP_CO) || 0,
            '화': parseInt(row.TUES_FLPOP_CO) || 0,
            '수': parseInt(row.WED_FLPOP_CO) || 0,
            '목': parseInt(row.THUR_FLPOP_CO) || 0,
            '금': parseInt(row.FRI_FLPOP_CO) || 0,
            '토': parseInt(row.SAT_FLPOP_CO) || 0,
            '일': parseInt(row.SUN_FLPOP_CO) || 0,
        },
        quarter: extractQuarter(row),
        source: 'KT 통신데이터'
    };
}

function parseWorkingPop(rows) {
    if (!rows || rows.length === 0) return null;
    const row = rows[0];
    return {
        total: parseInt(row.TOT_WRC_POPLTN_CO) || 0,
        male: parseInt(row.ML_WRC_POPLTN_CO) || 0,
        female: parseInt(row.FML_WRC_POPLTN_CO) || 0,
        age: {
            '10대': parseInt(row.AGRDE_10_WRC_POPLTN_CO) || 0,
            '20대': parseInt(row.AGRDE_20_WRC_POPLTN_CO) || 0,
            '30대': parseInt(row.AGRDE_30_WRC_POPLTN_CO) || 0,
            '40대': parseInt(row.AGRDE_40_WRC_POPLTN_CO) || 0,
            '50대': parseInt(row.AGRDE_50_WRC_POPLTN_CO) || 0,
            '60대+': parseInt(row.AGRDE_60_ABOVE_WRC_POPLTN_CO) || 0,
        },
        quarter: extractQuarter(row),
        source: 'SKT 통신데이터'
    };
}

function parseResidentPop(rows) {
    if (!rows || rows.length === 0) return null;
    const row = rows[0];
    return {
        totalPop: parseInt(row.TOT_POPLTN_CO) || 0,
        totalHousehold: parseInt(row.TOT_HSHLD_CO) || 0,
        male: parseInt(row.ML_POPLTN_CO) || 0,
        female: parseInt(row.FML_POPLTN_CO) || 0,
        age: {
            '10대': parseInt(row.AGRDE_10_POPLTN_CO) || 0,
            '20대': parseInt(row.AGRDE_20_POPLTN_CO) || 0,
            '30대': parseInt(row.AGRDE_30_POPLTN_CO) || 0,
            '40대': parseInt(row.AGRDE_40_POPLTN_CO) || 0,
            '50대': parseInt(row.AGRDE_50_POPLTN_CO) || 0,
            '60대+': parseInt(row.AGRDE_60_ABOVE_POPLTN_CO) || 0,
        },
        household: {
            '1인': parseInt(row.HNPN_CO_1_HSHLD_CO) || 0,
            '2인': parseInt(row.HNPN_CO_2_HSHLD_CO) || 0,
            '3인': parseInt(row.HNPN_CO_3_HSHLD_CO) || 0,
            '4인': parseInt(row.HNPN_CO_4_HSHLD_CO) || 0,
            '5인+': parseInt(row.HNPN_CO_5_ABOVE_HSHLD_CO) || 0,
        },
        quarter: extractQuarter(row),
        source: '서울시 주민등록'
    };
}

function parseSales(rows) {
    if (!rows || rows.length === 0) return null;
    const result = {
        totalSales: 0,
        totalCount: 0,
        byDay: { '월': 0, '화': 0, '수': 0, '목': 0, '금': 0, '토': 0, '일': 0 },
        byTime: { '00~06시': 0, '06~11시': 0, '11~14시': 0, '14~17시': 0, '17~21시': 0, '21~24시': 0 },
        byGender: { male: 0, female: 0 },
        byAge: { '10대': 0, '20대': 0, '30대': 0, '40대': 0, '50대': 0, '60대+': 0 },
        weekday: 0, weekend: 0,
        quarter: extractQuarter(rows[0]),
        source: '신한카드'
    };
    rows.forEach(row => {
        result.totalSales += parseInt(row.THSMON_SELNG_AMT) || 0;
        result.totalCount += parseInt(row.THSMON_SELNG_CO) || 0;
        result.byDay['월'] += parseInt(row.MON_SELNG_AMT) || 0;
        result.byDay['화'] += parseInt(row.TUES_SELNG_AMT) || 0;
        result.byDay['수'] += parseInt(row.WED_SELNG_AMT) || 0;
        result.byDay['목'] += parseInt(row.THUR_SELNG_AMT) || 0;
        result.byDay['금'] += parseInt(row.FRI_SELNG_AMT) || 0;
        result.byDay['토'] += parseInt(row.SAT_SELNG_AMT) || 0;
        result.byDay['일'] += parseInt(row.SUN_SELNG_AMT) || 0;
        result.byTime['00~06시'] += parseInt(row.TMZON_00_06_SELNG_AMT) || 0;
        result.byTime['06~11시'] += parseInt(row.TMZON_06_11_SELNG_AMT) || 0;
        result.byTime['11~14시'] += parseInt(row.TMZON_11_14_SELNG_AMT) || 0;
        result.byTime['14~17시'] += parseInt(row.TMZON_14_17_SELNG_AMT) || 0;
        result.byTime['17~21시'] += parseInt(row.TMZON_17_21_SELNG_AMT) || 0;
        result.byTime['21~24시'] += parseInt(row.TMZON_21_24_SELNG_AMT) || 0;
        result.byGender.male += parseInt(row.ML_SELNG_AMT) || 0;
        result.byGender.female += parseInt(row.FML_SELNG_AMT) || 0;
        result.byAge['10대'] += parseInt(row.AGRDE_10_SELNG_AMT) || 0;
        result.byAge['20대'] += parseInt(row.AGRDE_20_SELNG_AMT) || 0;
        result.byAge['30대'] += parseInt(row.AGRDE_30_SELNG_AMT) || 0;
        result.byAge['40대'] += parseInt(row.AGRDE_40_SELNG_AMT) || 0;
        result.byAge['50대'] += parseInt(row.AGRDE_50_SELNG_AMT) || 0;
        result.byAge['60대+'] += parseInt(row.AGRDE_60_ABOVE_SELNG_AMT) || 0;
        result.weekday += parseInt(row.MDWK_SELNG_AMT) || 0;
        result.weekend += parseInt(row.WKEND_SELNG_AMT) || 0;
    });
    return result;
}

function parseIncomeSpending(rows) {
    if (!rows || rows.length === 0) return null;
    const row = rows[0];
    return {
        monthlyIncome: parseInt(row.MT_AVRG_INCOME_AMT) || 0,
        totalSpending: parseInt(row.EXPNDTR_TOTAMT) || 0,
        spending: {
            '식료품': parseInt(row.FDSTFFS_EXPNDTR_TOTAMT) || 0,
            '의류': parseInt(row.CLTHS_FTWR_EXPNDTR_TOTAMT) || 0,
            '생활용품': parseInt(row.LVSPL_EXPNDTR_TOTAMT) || 0,
            '의료': parseInt(row.MCP_EXPNDTR_TOTAMT) || 0,
            '교통': parseInt(row.TRNSPORT_EXPNDTR_TOTAMT) || 0,
            '여가': parseInt(row.LSR_EXPNDTR_TOTAMT) || 0,
            '문화': parseInt(row.CLTUR_EXPNDTR_TOTAMT) || 0,
            '교육': parseInt(row.EDC_EXPNDTR_TOTAMT) || 0,
            '유흥': parseInt(row.PLESR_EXPNDTR_TOTAMT) || 0,
        },
        quarter: extractQuarter(row),
        source: 'KB카드 + 건보공단'
    };
}

function parseApartment(rows) {
    if (!rows || rows.length === 0) return null;
    const row = rows[0];
    return {
        complexCount: parseInt(row.APT_HSHOLD_CO) || 0,
        avgPrice: parseInt(row.AVRG_AE) || 0,
        avgArea: parseFloat(row.AVRG_MKTC) || 0,
        bySize: {
            '~66㎡': parseInt(row.AE_66_BLWSQ_HSHOLD_CO) || 0,
            '66~99㎡': parseInt(row.AE_66_99SQ_HSHOLD_CO) || 0,
            '99~132㎡': parseInt(row.AE_99_132SQ_HSHOLD_CO) || 0,
            '132~165㎡': parseInt(row.AE_132_165SQ_HSHOLD_CO) || 0,
            '165㎡~': parseInt(row.AE_165_ABVSQ_HSHOLD_CO) || 0,
        },
        quarter: extractQuarter(row),
        source: '서울시'
    };
}

function parseStore(rows) {
    if (!rows || rows.length === 0) return null;
    const result = {
        totalStore: 0,
        similarStore: 0,
        openRate: 0,
        closeRate: 0,
        franchiseCount: 0,
        quarter: extractQuarter(rows[0]),
        source: '서울시 + 카드사'
    };
    
    let totalOpenRate = 0;
    let totalCloseRate = 0;
    let rateCount = 0;
    
    rows.forEach(row => {
        result.totalStore += parseInt(row.STOR_CO) || 0;
        result.similarStore += parseInt(row.SIMILR_INDUTY_STOR_CO) || 0;
        result.franchiseCount += parseInt(row.FRC_STOR_CO) || 0;
        if (parseFloat(row.OPBIZ_RT) || parseFloat(row.CLSBIZ_RT)) {
            totalOpenRate += parseFloat(row.OPBIZ_RT) || 0;
            totalCloseRate += parseFloat(row.CLSBIZ_RT) || 0;
            rateCount++;
        }
    });
    
    if (rateCount > 0) {
        result.openRate = parseFloat((totalOpenRate / rateCount).toFixed(1));
        result.closeRate = parseFloat((totalCloseRate / rateCount).toFixed(1));
    }
    return result;
}

function parseChangeIndex(rows) {
    if (!rows || rows.length === 0) return null;
    const row = rows[0];
    return {
        changeIndicator: row.TRDAR_CHNGE_IX || '',
        changeIndicatorNm: row.TRDAR_CHNGE_IX_NM || '',
        operationRate: parseFloat(row.OPR_SALE_MT_AVRG) || 0,
        closeMonth: parseFloat(row.CLS_SALE_MT_AVRG) || 0,
        quarter: extractQuarter(row),
        source: '서울시'
    };
}

function parseFacility(rows) {
    if (!rows || rows.length === 0) return null;
    const result = {
        govOffice: 0,
        bank: 0,
        hospital: 0,
        pharmacy: 0,
        kindergarten: 0,
        elemSchool: 0,
        midSchool: 0,
        highSchool: 0,
        university: 0,
        department: 0,
        theater: 0,
        accommodation: 0,
        airport: 0,
        railStation: 0,
        busTerminal: 0,
        subwayStation: 0,
        busStop: 0,
        quarter: extractQuarter(rows[0]),
        source: '각급기관'
    };

    rows.forEach(row => {
        result.govOffice += parseInt(row.VIATR_FCLTY_CO) || 0;
        result.bank += parseInt(row.BANK_CO) || 0;
        result.hospital += parseInt(row.GNRL_HSPTL_CO) || 0;
        result.pharmacy += parseInt(row.PHARMCY_CO) || 0;
        result.kindergarten += parseInt(row.KNDRGR_CO) || 0;
        result.elemSchool += parseInt(row.ELEMY_SCHL_CO) || 0;
        result.midSchool += parseInt(row.MSKUL_CO) || 0;
        result.highSchool += parseInt(row.HGSCHL_CO) || 0;
        result.university += parseInt(row.UNVRST_CO) || 0;
        result.department += parseInt(row.DPRTM_STRS_CO) || 0;
        result.theater += parseInt(row.THEAT_CO) || 0;
        result.accommodation += parseInt(row.STAYNG_FCLTY_CO) || 0;
        result.airport += parseInt(row.ARPRT_CO) || 0;
        result.railStation += parseInt(row.RLROAD_STATN_CO) || 0;
        result.busTerminal += parseInt(row.BUS_TRMINL_CO) || 0;
        result.subwayStation += parseInt(row.SUBWAY_STATN_CO) || 0;
        result.busStop += parseInt(row.BUS_STTN_CO) || 0;
    });
    return result;
}

/**
 * ===== 메인: 서울시 상권 데이터 통합 조회 =====
 */
export async function getSeoulDistrictData(lat, lng) {
    const apiKeys = [
        process.env.SEOUL_API_KEY_1,
        process.env.SEOUL_API_KEY_2,
        process.env.SEOUL_API_KEY_3,
    ].filter(Boolean);

    if (apiKeys.length === 0) {
        console.warn('SEOUL_API_KEY가 설정되지 않았습니다.');
        return null;
    }

    // 키 분배 (API별로 다른 키 사용 → 호출 제한 분산)
    const k1 = apiKeys[0];
    const k2 = apiKeys[1] || k1;
    const k3 = apiKeys[2] || k1;

    console.log('📊 서울시 상권분석 데이터 조회 시작...');

    // 1단계: 좌표 → 상권 코드 매핑
    const trdarInfo = await findNearestTrdarCd(k1, lat, lng);
    if (!trdarInfo) {
        console.warn('가까운 상권을 찾을 수 없습니다.');
        return null;
    }

    const { trdarCd } = trdarInfo;
    console.log(`   매칭 상권: ${trdarInfo.trdarNm} (${trdarInfo.trdarSe}), 거리: ${trdarInfo.distance}m`);

    // 2단계: 12종 API 병렬 조회 (키 분산)
    const [
        floatingPop, workingPop, residentPop,
        sales, incomeSpending, apartment,
        store, changeIndex, facility,
        bgdFloatingPop, bgdResidentPop,
    ] = await Promise.all([
        callSeoulAPIByTrdarCd(k1, SERVICES.floatingPop, trdarCd),
        callSeoulAPIByTrdarCd(k1, SERVICES.workingPop, trdarCd),
        callSeoulAPIByTrdarCd(k2, SERVICES.residentPop, trdarCd),
        callSeoulAPIByTrdarCd(k2, SERVICES.sales, trdarCd),
        callSeoulAPIByTrdarCd(k2, SERVICES.incomeSpending, trdarCd),
        callSeoulAPIByTrdarCd(k3, SERVICES.apartment, trdarCd),
        callSeoulAPIByTrdarCd(k3, SERVICES.store, trdarCd),
        callSeoulAPIByTrdarCd(k3, SERVICES.changeIndex, trdarCd),
        callSeoulAPIByTrdarCd(k1, SERVICES.facility, trdarCd),
        callSeoulAPIByTrdarCd(k2, SERVICES.bgdFloatingPop, trdarCd),
        callSeoulAPIByTrdarCd(k3, SERVICES.bgdResidentPop, trdarCd),
    ]);

    console.log('   서울시 API 조회 완료!');

    return {
        trdarInfo,
        floatingPop: parseFloatingPop(floatingPop),
        workingPop: parseWorkingPop(workingPop),
        residentPop: parseResidentPop(residentPop),
        sales: parseSales(sales),
        incomeSpending: parseIncomeSpending(incomeSpending),
        apartment: parseApartment(apartment),
        store: parseStore(store),
        changeIndex: parseChangeIndex(changeIndex),
        facility: parseFacility(facility),
        bgdFloatingPop: parseFloatingPop(bgdFloatingPop),
        bgdResidentPop: parseResidentPop(bgdResidentPop),
    };
}
