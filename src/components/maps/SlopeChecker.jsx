import { useState, useEffect } from 'react';

export default function SlopeChecker({ center, radius = 500 }) {
    const [loading, setLoading] = useState(true);
    const [elevationData, setElevationData] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!center || center.length !== 2) return;

        const checkElevation = async () => {
            try {
                setLoading(true);
                const [lat, lon] = center;
                
                // 반경 만큼 떨어진 4개 지점 계산 (대략 1도 = 111km)
                const offset = radius / 111000;
                
                const points = [
                    { lat, lon, label: '중심' },
                    { lat: lat + offset, lon, label: '북쪽' },
                    { lat: lat - offset, lon, label: '남쪽' },
                    { lat, lon: lon + offset, label: '동쪽' },
                    { lat, lon: lon - offset, label: '서쪽' }
                ];

                const lats = points.map(p => p.lat).join(',');
                const lons = points.map(p => p.lon).join(',');

                // Open-Meteo Elevation API 호출 (무료, API 키 불필요)
                const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lons}`);
                const data = await res.json();

                if (data && data.elevation) {
                    const elevations = data.elevation;
                    const maxEle = Math.max(...elevations);
                    const minEle = Math.min(...elevations);
                    const diff = maxEle - minEle;
                    
                    // 대략적인 경사도 비율 산출 (%)
                    // elevation diff / (radius * 2) * 100
                    const slopePercent = (diff / radius) * 100;

                    let slopeType = '평지';
                    let slopeColor = '#10b981'; // 초록
                    let slopeDesc = '도보 접근성이 매우 우수합니다.';
                    
                    if (slopePercent > 5) {
                        slopeType = '완경사';
                        slopeColor = '#f59e0b'; // 노랑
                        slopeDesc = '약간의 언덕이 존재하나 접근에 큰 무리가 없습니다.';
                    }
                    if (slopePercent > 10) {
                        slopeType = '급경사';
                        slopeColor = '#ef4444'; // 빨강
                        slopeDesc = '상당한 고저차가 있어 도보 및 차량 유입에 불리할 수 있습니다.';
                    }

                    setElevationData({
                        centerEle: elevations[0],
                        maxEle,
                        minEle,
                        diff: diff.toFixed(1),
                        slopePercent: slopePercent.toFixed(1),
                        slopeType,
                        slopeColor,
                        slopeDesc
                    });
                } else {
                    setError('고도 데이터를 가져올 수 없습니다.');
                }
            } catch (err) {
                console.error("Elevation API Error:", err);
                setError('경사도 분석 중 오류가 발생했습니다.');
            } finally {
                setLoading(false);
            }
        };

        checkElevation();

    }, [center, radius]);

    if (loading) {
        return (
            <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ width: '20px', height: '20px', border: '2px solid #e2e8f0', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <span style={{ marginLeft: '10px', fontSize: '13px', color: '#64748b' }}>경사도 분석 중...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '13px', color: '#ef4444' }}>{error}</span>
            </div>
        );
    }

    if (!elevationData) return null;

    return (
        <div style={{ padding: '20px', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                    <h4 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px 0' }}>지형 경사도 판독 (Slope Checker)</h4>
                    <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>중심 반경 {radius}m 내의 고저차 증감을 분석합니다.</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: elevationData.slopeColor }}>{elevationData.slopeType}</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>경사율: {elevationData.slopePercent}%</div>
                </div>
            </div>

            <div style={{ width: '100%', height: '12px', background: '#f1f5f9', borderRadius: '6px', overflow: 'hidden', marginBottom: '12px', position: 'relative' }}>
                <div style={{ 
                    position: 'absolute', top: 0, left: 0, height: '100%', 
                    width: `${Math.min(elevationData.slopePercent * 5, 100)}%`, 
                    background: `linear-gradient(90deg, #10b981, ${elevationData.slopeColor})`,
                    transition: 'width 1s ease-in-out'
                }} />
            </div>

            <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#475569', background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                <div style={{ flex: 1 }}>
                    <div style={{ color: '#94a3b8', fontSize: '11px', marginBottom: '4px' }}>최저 고도 (해발)</div>
                    <div style={{ fontWeight: 600 }}>{elevationData.minEle}m</div>
                </div>
                <div style={{ flex: 1, borderLeft: '1px solid #e2e8f0', paddingLeft: '16px' }}>
                    <div style={{ color: '#94a3b8', fontSize: '11px', marginBottom: '4px' }}>최고 고도 (해발)</div>
                    <div style={{ fontWeight: 600 }}>{elevationData.maxEle}m</div>
                </div>
                <div style={{ flex: 1, borderLeft: '1px solid #e2e8f0', paddingLeft: '16px' }}>
                    <div style={{ color: '#94a3b8', fontSize: '11px', marginBottom: '4px' }}>최대 고저차</div>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{elevationData.diff}m</div>
                </div>
            </div>
            
            <p style={{ marginTop: '12px', marginBottom: 0, fontSize: '13px', color: '#334155', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                💡 {elevationData.slopeDesc}
            </p>
        </div>
    );
}
