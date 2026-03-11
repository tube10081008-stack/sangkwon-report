import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// 노후도 계산: 현재 연도 기준으로 연식 산출
const calculateAgeCategory = (useaprDay) => {
    if (!useaprDay || useaprDay.length < 4) return 'unknown';
    const year = parseInt(useaprDay.substring(0, 4), 10);
    if (isNaN(year)) return 'unknown';
    
    const currentYear = new Date().getFullYear();
    const age = currentYear - year;

    if (age <= 5) return '0-5';
    if (age <= 15) return '6-15';
    if (age <= 30) return '16-30';
    return '31+';
};

// 범례 색상
const AGE_COLORS = {
    '0-5': '#10b981',    // 초록 (신축)
    '6-15': '#3b82f6',   // 파랑 (준신축)
    '16-30': '#f59e0b',  // 노랑/주황 (구축)
    '31+': '#ef4444',    // 빨강 (노후)
    'unknown': '#94a3b8' // 회색 (정보없음)
};

export default function VworldBuildingAgeMap({ center, radius = 500 }) {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!mapRef.current || !center) return;
        if (mapInstanceRef.current) mapInstanceRef.current.remove();

        // 베이스맵 초기화
        const map = L.map(mapRef.current, { center, zoom: 16, zoomControl: true });
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
            maxZoom: 20
        }).addTo(map);

        // 중심 마커 및 반경 원
        L.circle(center, { radius, color: '#6366f1', fillColor: 'transparent', weight: 3, dashArray: '5, 5' }).addTo(map);
        const centerIcon = L.divIcon({
            html: `<div style="width:16px;height:16px;border-radius:50%;background:#8b5cf6;border:3px solid white;box-shadow:0 0 10px rgba(139,92,246,0.6);"></div>`,
            iconSize: [16, 16], className: ''
        });
        L.marker(center, { icon: centerIcon }).addTo(map);

        mapInstanceRef.current = map;

        // Vworld WFS 데이터 가져오기 (건축물연령도/정보)
        const fetchBuildings = async () => {
            try {
                setLoading(true);
                const apiKey = import.meta.env.VITE_VWORLD_API_KEY;
                
                // 500m 반경을 대략적인 BBox 좌표로 변환 (1도 = 약 111km)
                const offset = (radius / 111000);
                const minX = center[1] - offset;
                const minY = center[0] - offset;
                const maxX = center[1] + offset;
                const maxY = center[0] + offset;

                const url = `https://api.vworld.kr/req/data?service=data&request=GetFeature&data=lt_c_bldginfo&key=${apiKey}&domain=${window.location.hostname || 'localhost'}&geomFilter=BOX(${minX},${minY},${maxX},${maxY})&size=1000`;

                const res = await fetch(url);
                const data = await res.json();

                if (data?.response?.status === 'OK' && data.response.result?.featureCollection) {
                    const geoJsonData = data.response.result.featureCollection;
                    
                    // GeoJSON 레이어 추가
                    L.geoJSON(geoJsonData, {
                        style: (feature) => {
                            const ageCat = calculateAgeCategory(feature.properties.useapr_day);
                            return {
                                fillColor: AGE_COLORS[ageCat],
                                color: '#334155', // 테두리 색상
                                weight: 1,
                                fillOpacity: 0.7
                            };
                        },
                        onEachFeature: (feature, layer) => {
                            // 건물 X-Ray 팝업 연동 
                            const props = feature.properties;
                            const ageCat = calculateAgeCategory(props.useapr_day);
                            const name = props.bld_nm || '건물명 없음';
                            const useDay = props.useapr_day ? `${props.useapr_day.substring(0,4)}년 ${props.useapr_day.substring(4,6)}월` : '정보 없음';
                            const area = props.totalarea ? `${props.totalarea}㎡` : '확인 불가';
                            
                            const popupHtml = `
                                <div style="font-family:sans-serif;font-size:13px;color:#334155;min-width:180px;">
                                    <div style="font-weight:700;font-size:15px;color:#0f172a;margin-bottom:8px;border-bottom:1px solid #e2e8f0;padding-bottom:6px;">
                                        🏢 ${name}
                                    </div>
                                    <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                                        <span style="color:#64748b">사용승인:</span> 
                                        <span style="font-weight:600">${useDay}</span>
                                    </div>
                                    <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                                        <span style="color:#64748b">연면적:</span> 
                                        <span style="font-weight:600">${area}</span>
                                    </div>
                                    <div style="display:flex;justify-content:space-between;margin-top:8px;background:${AGE_COLORS[ageCat]}20;padding:4px 8px;border-radius:4px;">
                                        <span style="color:#64748b;font-size:12px;">현황:</span> 
                                        <span style="color:${AGE_COLORS[ageCat]};font-weight:700;font-size:12px;">
                                            ${ageCat === '0-5' ? '신축 (5년 이내)' : ageCat === '6-15' ? '준신축 (15년 이내)' : ageCat === '16-30' ? '구축 (30년 이내)' : ageCat === '31+' ? '노후 (30년 이상)' : '연식 미상'}
                                        </span>
                                    </div>
                                </div>
                            `;
                            layer.bindPopup(popupHtml);
                        }
                    }).addTo(map);
                } else {
                    console.warn('Vworld 건물 데이터 조회 오류:', data);
                }
            } catch (err) {
                console.error("Vworld Building Age Fetch Error:", err);
                setError("건축물 노후도 데이터를 불러오는데 실패했습니다.");
            } finally {
                setLoading(false);
            }
        };

        fetchBuildings();

        // Resize 관측
        const observer = new ResizeObserver(() => map.invalidateSize());
        observer.observe(mapRef.current);

        return () => { observer.disconnect(); if (mapInstanceRef.current) mapInstanceRef.current.remove(); };
    }, [center, radius]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ position: 'relative', width: '100%', height: '400px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                {loading && (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(248, 250, 252, 0.8)', zIndex: 1000 }}>
                        <div style={{ width: '30px', height: '30px', border: '3px solid #e2e8f0', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    </div>
                )}
                <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
                
                {/* 우측 상단 범례 */}
                <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(255,255,255,0.95)', padding: '10px', borderRadius: '8px', zIndex: 900, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>건물 노후도 (신축/구축)</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '12px', height: '12px', background: AGE_COLORS['0-5'] }} /><span style={{ fontSize: '11px', color: '#334155' }}>신축 (5년 이내)</span></div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '12px', height: '12px', background: AGE_COLORS['6-15'] }} /><span style={{ fontSize: '11px', color: '#334155' }}>준신축 (15년 이내)</span></div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '12px', height: '12px', background: AGE_COLORS['16-30'] }} /><span style={{ fontSize: '11px', color: '#334155' }}>구축 (30년 이하)</span></div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '12px', height: '12px', background: AGE_COLORS['31+'] }} /><span style={{ fontSize: '11px', color: '#334155' }}>노후 (30년 초과)</span></div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '12px', height: '12px', background: AGE_COLORS['unknown'] }} /><span style={{ fontSize: '11px', color: '#334155' }}>미상/기타</span></div>
                    </div>
                </div>
            </div>
            {error && <p style={{ fontSize: '12px', color: '#ef4444', textAlign: 'center' }}>{error}</p>}
            <p style={{ fontSize: '12px', color: '#64748b', textAlign: 'center' }}>
                * 지도의 건물을 클릭하면 **건물 X-Ray** (명칭, 대지면적, 층수 등 세부정보)가 팝업됩니다.
            </p>
        </div>
    );
}
