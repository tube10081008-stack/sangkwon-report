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
    incomeSpending:  'VwsmTrdarIxQq',           // 소득소비-상권
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
 * 상권코드로 특정 API 필터링 조회 (최근 분기 데이터 선별)
 */
async function callSeoulAPIByTrdarCd(apiKey, serviceName, trdarCd) {
    // 서울시 API는 1회 1000건 제한이 있으므로, 최신 1개 분기 전체(약 1,671개)를 커버하기 위해 두 번 병렬 호출
    const [page1, page2] = await Promise.all([
        callSeoulAPI(apiKey, serviceName, 1, 1000),
        callSeoulAPI(apiKey, serviceName, 1001, 2000)
    ]);
    const rows = [...(page1 || []), ...(page2 || [])];
    if (rows.length === 0) return null;
    
    // 해당 상권코드 필터링
    const filtered = rows.filter(r => r.TRDAR_CD === trdarCd);
    if (filtered.length === 0) return null;
    
    // 최신 분기 데이터 반환
    filtered.sort((a, b) => {
        const qa = `${a.STDR_YY_CD || ''}${a.STDR_QU_CD || ''}`;
        const qb = `${b.STDR_YY_CD || ''}${b.STDR_QU_CD || ''}`;
        return qb.localeCompare(qa);
    });
    return filtered[0];
}

/**
 * 좌표로 가장 가까운 상권 코드 찾기
 */
async function findNearestTrdarCd(apiKey, lat, lng) {
    // 영역-상권 API 전체 조회 (1~2000: 서울시 전체 1,671개 커버)
    const [page1, page2] = await Promise.all([
        callSeoulAPI(apiKey, SERVICES.region, 1, 1000),
        callSeoulAPI(apiKey, SERVICES.region, 1001, 2000)
    ]);
    const rows = [...(page1 || []), ...(page2 || [])];
    if (rows.length === 0) return null;

    // TM → WGS84 근사 변환 후 최근접 상권 찾기
    let nearest = null;
    let minDist = Infinity;

    rows.forEach(r => {
        // XCNTS_VALUE, YDNTS_VALUE는 TM좌표 → 위경도 근사 변환
        const tx = parseFloat(r.XCNTS_VALUE);
        const ty = parseFloat(r.YDNTS_VALUE);
        if (!tx || !ty) return;
        
        // TM(EPSG:5181) → WGS84 근사변환
        const rLng = (tx - 200000) / 100000 + 127;
        const rLat = (ty - 500000) / 110000 + 38;
        
        const dlat = (rLat - lat) * 111320;
        const dlng = (rLng - lng) * 111320 * Math.cos(lat * Math.PI / 180);
        const dist = Math.sqrt(dlat * dlat + dlng * dlng);

        if (dist < minDist) {
            minDist = dist;
            nearest = {
                trdarCd: r.TRDAR_CD,
                trdarNm: r.TRDAR_CD_NM,
                trdarSe: r.TRDAR_SE_CD_NM,
                admDong: r.ADSTRD_CD_NM,
                signgu: r.SIGNGU_CD_NM,
                distance: Math.round(dist),
                area: parseFloat(r.RELM_AR) || 0
            };
        }
    });

    return nearest;
}

/**
 * ===== 데이터 파서들 =====
 */

function parseFloatingPop(row) {
    if (!row) return null;
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
        byTime: {
            '00~06시': parseInt(row.TMZON_00_06_FLPOP_CO) || 0,
            '06~11시': parseInt(row.TMZON_06_11_FLPOP_CO) || 0,
            '11~14시': parseInt(row.TMZON_11_14_FLPOP_CO) || 0,
            '14~17시': parseInt(row.TMZON_14_17_FLPOP_CO) || 0,
            '17~21시': parseInt(row.TMZON_17_21_FLPOP_CO) || 0,
            '21~24시': parseInt(row.TMZON_21_24_FLPOP_CO) || 0,
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
        quarter: `${row.STDR_YY_CD}년 ${row.STDR_QU_CD}분기`,
        source: 'KT 통신데이터'
    };
}

function parseWorkingPop(row) {
    if (!row) return null;
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
        quarter: `${row.STDR_YY_CD}년 ${row.STDR_QU_CD}분기`,
        source: 'SKT 통신데이터'
    };
}

function parseResidentPop(row) {
    if (!row) return null;
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
        quarter: `${row.STDR_YY_CD}년 ${row.STDR_QU_CD}분기`,
        source: '서울시 주민등록'
    };
}

function parseSales(row) {
    if (!row) return null;
    return {
        totalSales: parseInt(row.THSMON_SELNG_AMT) || 0,
        totalCount: parseInt(row.THSMON_SELNG_CO) || 0,
        byDay: {
            '월': parseInt(row.MON_SELNG_AMT) || 0,
            '화': parseInt(row.TUES_SELNG_AMT) || 0,
            '수': parseInt(row.WED_SELNG_AMT) || 0,
            '목': parseInt(row.THUR_SELNG_AMT) || 0,
            '금': parseInt(row.FRI_SELNG_AMT) || 0,
            '토': parseInt(row.SAT_SELNG_AMT) || 0,
            '일': parseInt(row.SUN_SELNG_AMT) || 0,
        },
        byTime: {
            '00~06시': parseInt(row.TMZON_00_06_SELNG_AMT) || 0,
            '06~11시': parseInt(row.TMZON_06_11_SELNG_AMT) || 0,
            '11~14시': parseInt(row.TMZON_11_14_SELNG_AMT) || 0,
            '14~17시': parseInt(row.TMZON_14_17_SELNG_AMT) || 0,
            '17~21시': parseInt(row.TMZON_17_21_SELNG_AMT) || 0,
            '21~24시': parseInt(row.TMZON_21_24_SELNG_AMT) || 0,
        },
        byGender: {
            male: parseInt(row.ML_SELNG_AMT) || 0,
            female: parseInt(row.FML_SELNG_AMT) || 0,
        },
        byAge: {
            '10대': parseInt(row.AGRDE_10_SELNG_AMT) || 0,
            '20대': parseInt(row.AGRDE_20_SELNG_AMT) || 0,
            '30대': parseInt(row.AGRDE_30_SELNG_AMT) || 0,
            '40대': parseInt(row.AGRDE_40_SELNG_AMT) || 0,
            '50대': parseInt(row.AGRDE_50_SELNG_AMT) || 0,
            '60대+': parseInt(row.AGRDE_60_ABOVE_SELNG_AMT) || 0,
        },
        weekday: parseInt(row.MDWK_SELNG_AMT) || 0,
        weekend: parseInt(row.WKEND_SELNG_AMT) || 0,
        quarter: `${row.STDR_YY_CD}년 ${row.STDR_QU_CD}분기`,
        source: '신한카드'
    };
}

function parseIncomeSpending(row) {
    if (!row) return null;
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
        quarter: `${row.STDR_YY_CD}년 ${row.STDR_QU_CD}분기`,
        source: 'KB카드 + 건보공단'
    };
}

function parseApartment(row) {
    if (!row) return null;
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
        quarter: `${row.STDR_YY_CD}년 ${row.STDR_QU_CD}분기`,
        source: '서울시'
    };
}

function parseStore(row) {
    if (!row) return null;
    return {
        totalStore: parseInt(row.STOR_CO) || 0,
        similarStore: parseInt(row.SIMILR_INDUTY_STOR_CO) || 0,
        openRate: parseFloat(row.OPBIZ_RT) || 0,
        closeRate: parseFloat(row.CLSBIZ_RT) || 0,
        franchiseCount: parseInt(row.FRC_STOR_CO) || 0,
        quarter: `${row.STDR_YY_CD}년 ${row.STDR_QU_CD}분기`,
        source: '서울시 + 카드사'
    };
}

function parseChangeIndex(row) {
    if (!row) return null;
    return {
        changeIndicator: row.TRDAR_CHNGE_IX || '',
        changeIndicatorNm: row.TRDAR_CHNGE_IX_NM || '',
        operationRate: parseFloat(row.OPR_SALE_MT_AVRG) || 0,
        closeMonth: parseFloat(row.CLS_SALE_MT_AVRG) || 0,
        quarter: `${row.STDR_YY_CD}년 ${row.STDR_QU_CD}분기`,
        source: '서울시'
    };
}

function parseFacility(row) {
    if (!row) return null;
    return {
        govOffice: parseInt(row.VIATR_FCLTY_CO) || 0,
        bank: parseInt(row.BANK_CO) || 0,
        hospital: parseInt(row.GNRL_HSPTL_CO) || 0,
        pharmacy: parseInt(row.PHARMCY_CO) || 0,
        kindergarten: parseInt(row.KNDRGR_CO) || 0,
        elemSchool: parseInt(row.ELEMY_SCHL_CO) || 0,
        midSchool: parseInt(row.MSKUL_CO) || 0,
        highSchool: parseInt(row.HGSCHL_CO) || 0,
        university: parseInt(row.UNVRST_CO) || 0,
        department: parseInt(row.DPRTM_STRS_CO) || 0,
        theater: parseInt(row.THEAT_CO) || 0,
        accommodation: parseInt(row.STAYNG_FCLTY_CO) || 0,
        airport: parseInt(row.ARPRT_CO) || 0,
        railStation: parseInt(row.RLROAD_STATN_CO) || 0,
        busTerminal: parseInt(row.BUS_TRMINL_CO) || 0,
        subwayStation: parseInt(row.SUBWAY_STATN_CO) || 0,
        busStop: parseInt(row.BUS_STTN_CO) || 0,
        quarter: `${row.STDR_YY_CD}년 ${row.STDR_QU_CD}분기`,
        source: '각급기관'
    };
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
