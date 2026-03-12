import { useEffect, useRef } from 'react';

/**
 * 서울시 열린데이터 상권분석 대시보드
 * KT 유동인구 + SKT 직장인구 + 신한카드 매출 + KB카드 소비 + 서울시 거주인구 등
 */
export default function SeoulDataPanel({ seoulData }) {
    if (!seoulData) return null;

    const {
        trdarInfo, floatingPop, workingPop, residentPop,
        sales, incomeSpending, apartment, store,
        changeIndex, facility
    } = seoulData;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* 상권 정보 헤더 */}
            {trdarInfo && (
                <div style={{
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    borderRadius: '16px', padding: '20px', color: 'white',
                    display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap'
                }}>
                    <div style={{ fontSize: '40px' }}>📍</div>
                    <div>
                        <div style={{ fontSize: '22px', fontWeight: 800 }}>{trdarInfo.trdarNm}</div>
                        <div style={{ opacity: 0.9, fontSize: '14px', marginTop: '4px' }}>
                            {trdarInfo.signgu} {trdarInfo.admDong} · {trdarInfo.trdarSe} · 면적 {trdarInfo.area?.toLocaleString()}㎡
                        </div>
                    </div>
                    <div style={{ marginLeft: 'auto', textAlign: 'right', fontSize: '13px', opacity: 0.8 }}>
                        매칭 거리: {trdarInfo.distance}m<br />
                        🔑 서울 열린데이터 인증
                    </div>
                </div>
            )}

            {/* 3종 인구 카드 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                {floatingPop && <PopCard icon="🚶" title="유동인구" total={floatingPop.total} source={floatingPop.source} quarter={floatingPop.quarter} color="#ef4444" />}
                {workingPop && <PopCard icon="💼" title="직장인구" total={workingPop.total} source={workingPop.source} quarter={workingPop.quarter} color="#3b82f6" />}
                {residentPop && <PopCard icon="🏠" title="상주인구" total={residentPop.totalPop} source={residentPop.source} quarter={residentPop.quarter} color="#10b981"
                    sub={`${residentPop.totalHousehold?.toLocaleString()}세대`} />}
            </div>

            {/* 유동인구 상세 (시간대/요일/연령/성별) */}
            {floatingPop && (
                <div style={{ background: '#fff', borderRadius: '16px', padding: '20px', border: '1px solid #e2e8f0' }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: '16px' }}>🚶 유동인구 상세 <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 400 }}>출처: {floatingPop.source}</span></h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                        <BarChart title="시간대별 유동인구" data={floatingPop.byTime} color="#ef4444" />
                        <BarChart title="요일별 유동인구" data={floatingPop.byDay} color="#f59e0b" />
                        <BarChart title="연령대별 유동인구" data={floatingPop.age} color="#8b5cf6" />
                        <GenderDonut male={floatingPop.male} female={floatingPop.female} />
                    </div>
                </div>
            )}

            {/* 추정매출 (신한카드) */}
            {sales && (
                <div style={{ background: '#fff', borderRadius: '16px', padding: '20px', border: '1px solid #e2e8f0' }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: '16px' }}>💳 추정매출 분석 <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 400 }}>출처: {sales.source}</span></h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', marginBottom: '16px' }}>
                        <MiniCard label="월 총 매출" value={`${(sales.totalSales / 10000).toFixed(0)}만원`} icon="💰" />
                        <MiniCard label="월 총 건수" value={`${sales.totalCount?.toLocaleString()}건`} icon="🧾" />
                        <MiniCard label="평일 매출" value={`${(sales.weekday / 10000).toFixed(0)}만원`} icon="📅" />
                        <MiniCard label="주말 매출" value={`${(sales.weekend / 10000).toFixed(0)}만원`} icon="🎉" />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                        <BarChart title="시간대별 매출" data={sales.byTime} color="#10b981" isMoney />
                        <BarChart title="요일별 매출" data={sales.byDay} color="#3b82f6" isMoney />
                        <BarChart title="연령대별 매출" data={sales.byAge} color="#f59e0b" isMoney />
                    </div>
                </div>
            )}

            {/* 소득소비 (KB카드+건보) */}
            {incomeSpending && incomeSpending.monthlyIncome > 0 && (
                <div style={{ background: '#fff', borderRadius: '16px', padding: '20px', border: '1px solid #e2e8f0' }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: '16px' }}>📊 소득·소비 분석 <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 400 }}>출처: {incomeSpending.source}</span></h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', marginBottom: '16px' }}>
                        <MiniCard label="월평균 소득" value={`${(incomeSpending.monthlyIncome / 10000).toFixed(0)}만원`} icon="💵" />
                        <MiniCard label="총 소비지출" value={`${(incomeSpending.totalSpending / 10000).toFixed(0)}만원`} icon="🛒" />
                    </div>
                    <BarChart title="소비 항목별 지출" data={incomeSpending.spending} color="#6366f1" isMoney />
                </div>
            )}

            {/* 직장인구 + 상주인구 상세 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                {workingPop && (
                    <div style={{ background: '#fff', borderRadius: '16px', padding: '20px', border: '1px solid #e2e8f0' }}>
                        <h3 style={{ margin: '0 0 12px', fontSize: '15px' }}>💼 직장인구 연령분포 <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 400 }}>{workingPop.source}</span></h3>
                        <BarChart data={workingPop.age} color="#3b82f6" />
                        <GenderDonut male={workingPop.male} female={workingPop.female} />
                    </div>
                )}
                {residentPop && (
                    <div style={{ background: '#fff', borderRadius: '16px', padding: '20px', border: '1px solid #e2e8f0' }}>
                        <h3 style={{ margin: '0 0 12px', fontSize: '15px' }}>🏠 상주인구 세대구성 <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 400 }}>{residentPop.source}</span></h3>
                        <BarChart data={residentPop.household} color="#10b981" />
                        <BarChart title="연령대별 상주인구" data={residentPop.age} color="#f97316" />
                    </div>
                )}
            </div>

            {/* 아파트 + 점포 + 집객시설 + 상권변화지표 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                {apartment && apartment.complexCount > 0 && (
                    <div style={{ background: '#fff', borderRadius: '16px', padding: '20px', border: '1px solid #e2e8f0' }}>
                        <h3 style={{ margin: '0 0 12px', fontSize: '15px' }}>🏢 아파트 현황</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <MiniCard label="총 세대수" value={`${apartment.complexCount?.toLocaleString()}세대`} icon="🏘️" />
                            <MiniCard label="평균 시가" value={`${(apartment.avgPrice / 10000).toFixed(0)}만원`} icon="💎" />
                        </div>
                        <div style={{ marginTop: '12px' }}>
                            <BarChart title="면적대별 세대수" data={apartment.bySize} color="#8b5cf6" />
                        </div>
                    </div>
                )}

                {store && (
                    <div style={{ background: '#fff', borderRadius: '16px', padding: '20px', border: '1px solid #e2e8f0' }}>
                        <h3 style={{ margin: '0 0 12px', fontSize: '15px' }}>🏪 점포 동향</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <MiniCard label="총 점포수" value={`${store.totalStore}개`} icon="🏬" />
                            <MiniCard label="프랜차이즈" value={`${store.franchiseCount}개`} icon="🍔" />
                            <MiniCard label="개업률" value={`${store.openRate}%`} icon="🟢" />
                            <MiniCard label="폐업률" value={`${store.closeRate}%`} icon="🔴" />
                        </div>
                    </div>
                )}

                {facility && (
                    <div style={{ background: '#fff', borderRadius: '16px', padding: '20px', border: '1px solid #e2e8f0' }}>
                        <h3 style={{ margin: '0 0 12px', fontSize: '15px' }}>🏫 주요 집객시설</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '13px' }}>
                            {facility.bank > 0 && <FacBadge label="은행" count={facility.bank} icon="🏦" />}
                            {facility.hospital > 0 && <FacBadge label="종합병원" count={facility.hospital} icon="🏥" />}
                            {facility.pharmacy > 0 && <FacBadge label="약국" count={facility.pharmacy} icon="💊" />}
                            {facility.subwayStation > 0 && <FacBadge label="지하철역" count={facility.subwayStation} icon="🚇" />}
                            {facility.busStop > 0 && <FacBadge label="버스정류장" count={facility.busStop} icon="🚌" />}
                            {facility.elemSchool > 0 && <FacBadge label="초등학교" count={facility.elemSchool} icon="🏫" />}
                            {facility.midSchool > 0 && <FacBadge label="중학교" count={facility.midSchool} icon="📚" />}
                            {facility.highSchool > 0 && <FacBadge label="고등학교" count={facility.highSchool} icon="🎓" />}
                            {facility.university > 0 && <FacBadge label="대학교" count={facility.university} icon="🏛️" />}
                            {facility.kindergarten > 0 && <FacBadge label="유치원" count={facility.kindergarten} icon="👶" />}
                            {facility.theater > 0 && <FacBadge label="극장" count={facility.theater} icon="🎬" />}
                            {facility.department > 0 && <FacBadge label="백화점" count={facility.department} icon="🛍️" />}
                        </div>
                    </div>
                )}

                {changeIndex && changeIndex.changeIndicatorNm && (
                    <div style={{ background: '#fff', borderRadius: '16px', padding: '20px', border: '1px solid #e2e8f0' }}>
                        <h3 style={{ margin: '0 0 12px', fontSize: '15px' }}>📈 상권변화지표</h3>
                        <div style={{
                            textAlign: 'center', padding: '16px', borderRadius: '12px',
                            background: changeIndex.changeIndicatorNm.includes('활성') ? '#dcfce7' : changeIndex.changeIndicatorNm.includes('쇠퇴') ? '#fef2f2' : '#fefce8',
                            fontSize: '20px', fontWeight: 700,
                            color: changeIndex.changeIndicatorNm.includes('활성') ? '#16a34a' : changeIndex.changeIndicatorNm.includes('쇠퇴') ? '#dc2626' : '#ca8a04',
                        }}>
                            {changeIndex.changeIndicatorNm}
                        </div>
                        <div style={{ marginTop: '10px', fontSize: '13px', color: '#64748b', textAlign: 'center' }}>
                            평균 영업기간: {changeIndex.operationRate}개월 · {changeIndex.quarter}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ===== 하위 컴포넌트들 ===== */

function PopCard({ icon, title, total, source, quarter, color, sub }) {
    return (
        <div style={{
            background: '#fff', borderRadius: '14px', padding: '18px',
            border: '1px solid #e2e8f0', position: 'relative', overflow: 'hidden'
        }}>
            <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '4px',
                background: `linear-gradient(90deg, ${color}, ${color}88)`
            }} />
            <div style={{ fontSize: '28px', marginBottom: '4px' }}>{icon}</div>
            <div style={{ fontSize: '13px', color: '#64748b' }}>{title}</div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: '#1e293b' }}>
                {total?.toLocaleString()}<span style={{ fontSize: '14px', fontWeight: 400 }}>명</span>
            </div>
            {sub && <div style={{ fontSize: '14px', color, fontWeight: 600 }}>{sub}</div>}
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
                {source} · {quarter}
            </div>
        </div>
    );
}

function MiniCard({ label, value, icon }) {
    return (
        <div style={{
            background: '#f8fafc', borderRadius: '10px', padding: '12px',
            textAlign: 'center', border: '1px solid #f1f5f9'
        }}>
            <div style={{ fontSize: '20px' }}>{icon}</div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{label}</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>{value}</div>
        </div>
    );
}

function FacBadge({ label, count, icon }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f8fafc', borderRadius: '8px', padding: '6px 10px' }}>
            <span>{icon}</span>
            <span style={{ flex: 1, color: '#475569' }}>{label}</span>
            <span style={{ fontWeight: 700, color: '#1e293b' }}>{count}</span>
        </div>
    );
}

function BarChart({ title, data, color = '#6366f1', isMoney }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        if (!data || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const entries = Object.entries(data);

        const W = canvas.clientWidth;
        const H = 160;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, W, H);

        const max = Math.max(...entries.map(e => e[1]), 1);
        const barW = Math.max(8, (W - 40) / entries.length - 6);
        const gap = (W - 40) / entries.length;

        entries.forEach(([label, val], i) => {
            const x = 20 + i * gap + gap / 2 - barW / 2;
            const barH = (val / max) * (H - 40);
            const y = H - 20 - barH;

            // 바
            ctx.fillStyle = color + '33';
            ctx.beginPath();
            ctx.roundRect(x, y, barW, barH, 3);
            ctx.fill();
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.roundRect(x, y, barW, Math.min(barH, 6), 3);
            ctx.fill();

            // 라벨
            ctx.fillStyle = '#64748b';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            const shortLabel = label.replace('시', '').replace('대', '').replace('이상', '+');
            ctx.fillText(shortLabel, x + barW / 2, H - 4);

            // 값
            if (val > 0) {
                ctx.fillStyle = '#1e293b';
                ctx.font = 'bold 9px sans-serif';
                const dispVal = isMoney ? `${(val / 10000).toFixed(0)}만` : val >= 10000 ? `${(val / 10000).toFixed(1)}만` : val.toLocaleString();
                ctx.fillText(dispVal, x + barW / 2, y - 4);
            }
        });
    }, [data, color, isMoney]);

    return (
        <div>
            {title && <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>{title}</div>}
            <canvas ref={canvasRef} style={{ width: '100%', height: '160px' }} />
        </div>
    );
}

function GenderDonut({ male, female }) {
    const canvasRef = useRef(null);
    const total = (male || 0) + (female || 0);

    useEffect(() => {
        if (!total || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;

        const S = 100;
        canvas.width = S * dpr;
        canvas.height = S * dpr;
        ctx.scale(dpr, dpr);

        const maleRatio = male / total;
        const cx = S / 2, cy = S / 2, r = 36;

        // 남성
        ctx.beginPath();
        ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + maleRatio * Math.PI * 2);
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.stroke();

        // 여성
        ctx.beginPath();
        ctx.arc(cx, cy, r, -Math.PI / 2 + maleRatio * Math.PI * 2, -Math.PI / 2 + Math.PI * 2);
        ctx.strokeStyle = '#ec4899';
        ctx.stroke();

        // 중앙 텍스트
        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`♂${(maleRatio * 100).toFixed(0)}%`, cx, cy - 2);
        ctx.fillStyle = '#ec4899';
        ctx.fillText(`♀${((1 - maleRatio) * 100).toFixed(0)}%`, cx, cy + 12);
    }, [male, female, total]);

    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 0' }}>
            <canvas ref={canvasRef} style={{ width: '100px', height: '100px' }} />
        </div>
    );
}
