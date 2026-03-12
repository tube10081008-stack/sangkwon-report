import { Bar } from 'react-chartjs-2';

export default function TransitScore({ data }) {
    if (!data) return null;

    const { score, grade, gradeLabel, gradeColor, subways, busStops, nearestSubway, nearestBus, totalSubways, totalBusStops } = data;

    return (
        <div style={{ padding: '24px', background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
            {/* 헤더 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                    <h4 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px 0' }}>🚇 교통 접근성 스코어</h4>
                    <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>지하철역 및 버스정류장 기반 분석</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ 
                        width: '70px', height: '70px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: `4px solid ${gradeColor}`, background: `${gradeColor}15`
                    }}>
                        <div>
                            <div style={{ fontSize: '22px', fontWeight: 800, color: gradeColor }}>{grade}</div>
                            <div style={{ fontSize: '10px', fontWeight: 600, color: gradeColor }}>{score}점</div>
                        </div>
                    </div>
                    <div style={{ fontSize: '11px', color: gradeColor, fontWeight: 600, marginTop: '4px' }}>{gradeLabel}</div>
                </div>
            </div>

            {/* 게이지 바 */}
            <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                    <span>접근성 부족</span><span>최상급 접근성</span>
                </div>
                <div style={{ width: '100%', height: '10px', background: '#f1f5f9', borderRadius: '5px', overflow: 'hidden' }}>
                    <div style={{ width: `${score}%`, height: '100%', background: `linear-gradient(90deg, #ef4444, #f59e0b, #10b981)`, borderRadius: '5px', transition: 'width 1s ease' }} />
                </div>
            </div>

            {/* 요약 카드 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div style={{ padding: '14px', background: '#f0fdf4', borderRadius: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', marginBottom: '4px' }}>🚇</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#10b981' }}>{totalSubways}개</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>지하철역</div>
                    {nearestSubway && <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 600, marginTop: '4px' }}>최근접: {nearestSubway.distance}m ({nearestSubway.walkMinutes}분)</div>}
                </div>
                <div style={{ padding: '14px', background: '#eff6ff', borderRadius: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', marginBottom: '4px' }}>🚌</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#3b82f6' }}>{totalBusStops}개</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>버스정류장</div>
                    {nearestBus && <div style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 600, marginTop: '4px' }}>최근접: {nearestBus.distance}m ({nearestBus.walkMinutes}분)</div>}
                </div>
            </div>

            {/* 지하철역 목록 */}
            {subways && subways.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                    <h5 style={{ fontSize: '14px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>🚇 인근 지하철역</h5>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {subways.map((s, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#f8fafc', borderRadius: '8px', fontSize: '13px' }}>
                                <span style={{ fontWeight: 500, color: '#334155' }}>{s.name}</span>
                                <span style={{ color: '#64748b', fontSize: '12px' }}>
                                    {s.distance}m · 도보 <strong style={{ color: s.walkMinutes <= 5 ? '#10b981' : s.walkMinutes <= 10 ? '#f59e0b' : '#ef4444' }}>{s.walkMinutes}분</strong>
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 버스정류장 목록 */}
            {busStops && busStops.length > 0 && (
                <div>
                    <h5 style={{ fontSize: '14px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>🚌 인근 버스정류장</h5>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {busStops.map((b, i) => (
                            <div key={i} style={{ padding: '6px 10px', background: '#eff6ff', borderRadius: '6px', fontSize: '12px', color: '#3b82f6', fontWeight: 500 }}>
                                {b.name} ({b.distance}m)
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
