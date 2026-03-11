import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// 국토교통부 용도지역 컬러 가이드 (정확한 컬러 코드는 아니며 직관적 인지를 위한 근사치)
const LAND_USE_LEGEND = [
    { name: '상업지역', color: '#ffb6c1' }, // 분홍
    { name: '일반주거', color: '#fffacd' }, // 노랑
    { name: '전용주거', color: '#ffebcd' }, // 살구
    { name: '준주거', color: '#ffa07a' },   // 진살구
    { name: '공업지역', color: '#d3d3d3' }, // 회색
    { name: '녹지지역', color: '#90ee90' }  // 초록
];

export default function VworldLandUseMap({ center, radius = 500 }) {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);

    useEffect(() => {
        if (!mapRef.current || !center) return;
        if (mapInstanceRef.current) mapInstanceRef.current.remove();

        // 1. Leaflet 베이스맵 초기화
        const map = L.map(mapRef.current, { center, zoom: 16, zoomControl: true });

        // 기존 Vworld 2D 기본 지도 타일 레이어 (선택 사항)
        // L.tileLayer('https://xdworld.vworld.kr/2d/Base/service/{z}/{x}/{y}.png', {
        //     attribution: '&copy; Vworld', maxZoom: 19
        // }).addTo(map);

        // OpenStreetMap 레이어 (가독성을 위해 배경으로 사용)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(map);

        // 2. Vworld WMS 용도지역지구도 레이어 추가 (연속지적도 + 용도지역)
        const vworldKey = import.meta.env.VITE_VWORLD_API_KEY;
        
        // WMS API 호출 URL 포맷 (vworld_wms)
        const wmsLayer = L.tileLayer.wms('https://api.vworld.kr/req/wms?', {
            service: 'WMS',
            request: 'GetMap',
            version: '1.3.0',
            layers: 'lt_c_uq111', // 용도지역도 레이어 ID
            crs: L.CRS.EPSG3857,
            format: 'image/png',
            transparent: true,
            key: vworldKey,
            domain: window.location.origin, // CORS 오류 방지를 위해 domain 필수
            opacity: 0.6 // 지적이 보이도록 반투명 처리
        });

        wmsLayer.addTo(map);

        // 3. 분석 대상 반경 원 그리기
        L.circle(center, {
            radius, 
            color: '#6366f1', 
            fillColor: 'transparent', 
            weight: 3, 
            dashArray: '5, 5'
        }).addTo(map);

        // 중심 마커 (보라색 핀)
        const centerIcon = L.divIcon({
            html: `
                <div style="width:16px;height:16px;border-radius:50%;background:#8b5cf6;border:3px solid white;box-shadow:0 0 10px rgba(139, 92, 246, 0.6);">
                    <div style="position:absolute;top:100%;left:50%;transform:translateX(-50%);width:2px;height:14px;background:#8b5cf6;"></div>
                </div>
            `,
            iconSize: [16, 30], iconAnchor: [8, 30], className: ''
        });
        L.marker(center, { icon: centerIcon }).addTo(map);

        mapInstanceRef.current = map;

        // 크기 변경 시 대응
        const observer = new ResizeObserver(() => map.invalidateSize());
        observer.observe(mapRef.current);

        return () => {
            observer.disconnect();
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, [center, radius]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ position: 'relative', width: '100%', height: '400px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
                
                {/* 우측 상단 범례 */}
                <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(255,255,255,0.95)', padding: '10px', borderRadius: '8px', zIndex: 1000, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>주요 용도지역 (참고용)</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {LAND_USE_LEGEND.map(item => (
                            <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <div style={{ width: '12px', height: '12px', background: item.color, border: '1px solid #cbd5e1' }} />
                                <span style={{ fontSize: '11px', color: '#334155' }}>{item.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', textAlign: 'center' }}>
                * 본 토지이용계획도는 브이월드 공공데이터를 기반으로 하며, 실제 법적 효력을 갖지 않습니다.
            </p>
        </div>
    );
}
