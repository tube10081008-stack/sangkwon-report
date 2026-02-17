import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// ===== 색상 팔레트 (등고선 스타일) =====
const GRADIENT_STOPS = {
    heat: { 0: '#00ff00', 0.35: '#adff2f', 0.5: '#ffff00', 0.65: '#ffa500', 0.8: '#ff4500', 1: '#cc0000' },
    cool: { 0: '#e0f7fa', 0.3: '#80deea', 0.5: '#26c6da', 0.7: '#00acc1', 0.85: '#ffca28', 1: '#ff8f00' },
    warm: { 0: '#fce4ec', 0.3: '#f48fb1', 0.5: '#ec407a', 0.7: '#d81b60', 0.85: '#ff8f00', 1: '#ffca28' },
};

function buildPalette(stops) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 1;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 256, 0);
    for (const [s, color] of Object.entries(stops)) g.addColorStop(Number(s), color);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 1);
    return ctx.getImageData(0, 0, 256, 1).data;
}

function buildSingleColorPalette(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const palette = new Uint8Array(256 * 4);
    for (let i = 0; i < 256; i++) {
        palette[i * 4] = r;
        palette[i * 4 + 1] = g;
        palette[i * 4 + 2] = b;
        palette[i * 4 + 3] = Math.min(200, Math.round(i * 0.85));
    }
    return palette;
}

// ===== 부드러운 원형 커널 템플릿 =====
function createKernel(radius, blur) {
    const size = radius + blur;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size * 2;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(size, size, 0, size, size, size);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(0.3, 'rgba(0,0,0,0.7)');
    grad.addColorStop(0.6, 'rgba(0,0,0,0.3)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size * 2, size * 2);
    return { canvas, size };
}

// ===== 스무스 히트맵 레이어 생성 =====
function createSmoothHeatLayer(map, points, colorScheme = 'heat') {
    const kernelRadius = 16;
    const kernelBlur = 14;
    const { canvas: kernel, size: kSize } = createKernel(kernelRadius, kernelBlur);
    const palette = buildPalette(GRADIENT_STOPS[colorScheme] || GRADIENT_STOPS.heat);

    const heatCanvas = document.createElement('canvas');
    heatCanvas.style.position = 'absolute';
    heatCanvas.style.pointerEvents = 'none';
    heatCanvas.style.zIndex = '400';

    const pane = map.getPanes().overlayPane;
    pane.appendChild(heatCanvas);

    function draw() {
        const mapSize = map.getSize();
        heatCanvas.width = mapSize.x;
        heatCanvas.height = mapSize.y;
        const topLeft = map.containerPointToLayerPoint([0, 0]);
        L.DomUtil.setPosition(heatCanvas, topLeft);

        const ctx = heatCanvas.getContext('2d');
        ctx.clearRect(0, 0, heatCanvas.width, heatCanvas.height);

        // 그리드 기반 집계 (성능 최적화)
        const gridStep = kSize * 1.2;
        const grid = {};
        points.forEach(p => {
            const cp = map.latLngToContainerPoint([p.lat, p.lng]);
            const gx = Math.floor(cp.x / gridStep);
            const gy = Math.floor(cp.y / gridStep);
            const key = `${gx}_${gy}`;
            if (!grid[key]) grid[key] = { sx: 0, sy: 0, n: 0, ti: 0 };
            grid[key].sx += cp.x;
            grid[key].sy += cp.y;
            grid[key].n++;
            grid[key].ti += (p.intensity || 1);
        });

        const cells = Object.values(grid);
        if (cells.length === 0) return;
        const maxI = Math.max(...cells.map(c => c.ti));
        if (maxI === 0) return;

        // 가우시안 블롭 그리기
        cells.forEach(cell => {
            const cx = cell.sx / cell.n;
            const cy = cell.sy / cell.n;
            if (cx < -kSize * 2 || cy < -kSize * 2 ||
                cx > heatCanvas.width + kSize * 2 || cy > heatCanvas.height + kSize * 2) return;

            ctx.globalAlpha = Math.min(1, (cell.ti / maxI) * 0.7 + 0.05);
            ctx.drawImage(kernel, cx - kSize, cy - kSize);
        });

        // 알파 → 색상 컬러라이징
        const imageData = ctx.getImageData(0, 0, heatCanvas.width, heatCanvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const a = data[i + 3];
            if (a === 0) continue;
            const j = a * 4;
            data[i] = palette[j];
            data[i + 1] = palette[j + 1];
            data[i + 2] = palette[j + 2];
            data[i + 3] = Math.min(210, Math.round(a * 1.3 + 20));
        }
        ctx.putImageData(imageData, 0, 0);
    }

    draw();
    map.on('moveend zoomend', draw);

    return {
        remove: () => {
            map.off('moveend zoomend', draw);
            if (heatCanvas.parentNode) heatCanvas.remove();
        }
    };
}

// ===== 업종별 다색 히트맵 레이어 =====
function createCategoryHeatLayers(map, categories) {
    const kernelRadius = 14;
    const kernelBlur = 12;
    const { canvas: kernel, size: kSize } = createKernel(kernelRadius, kernelBlur);
    const canvases = [];

    categories.forEach(cat => {
        const palette = buildSingleColorPalette(cat.color);
        const heatCanvas = document.createElement('canvas');
        heatCanvas.style.position = 'absolute';
        heatCanvas.style.pointerEvents = 'none';
        heatCanvas.style.zIndex = '400';
        heatCanvas.style.mixBlendMode = 'screen';

        const pane = map.getPanes().overlayPane;
        pane.appendChild(heatCanvas);

        function draw() {
            const mapSize = map.getSize();
            heatCanvas.width = mapSize.x;
            heatCanvas.height = mapSize.y;
            const topLeft = map.containerPointToLayerPoint([0, 0]);
            L.DomUtil.setPosition(heatCanvas, topLeft);

            const ctx = heatCanvas.getContext('2d');
            ctx.clearRect(0, 0, heatCanvas.width, heatCanvas.height);

            const gridStep = kSize * 1.4;
            const grid = {};
            cat.points.forEach(p => {
                const cp = map.latLngToContainerPoint([p.lat, p.lng]);
                const gx = Math.floor(cp.x / gridStep);
                const gy = Math.floor(cp.y / gridStep);
                const key = `${gx}_${gy}`;
                if (!grid[key]) grid[key] = { sx: 0, sy: 0, n: 0 };
                grid[key].sx += cp.x;
                grid[key].sy += cp.y;
                grid[key].n++;
            });

            const cells = Object.values(grid);
            if (cells.length === 0) return;
            const maxN = Math.max(...cells.map(c => c.n));

            cells.forEach(cell => {
                const cx = cell.sx / cell.n;
                const cy = cell.sy / cell.n;
                if (cx < -kSize * 2 || cy < -kSize * 2 ||
                    cx > heatCanvas.width + kSize * 2 || cy > heatCanvas.height + kSize * 2) return;

                ctx.globalAlpha = Math.min(1, (cell.n / maxN) * 0.65 + 0.08);
                ctx.drawImage(kernel, cx - kSize, cy - kSize);
            });

            const imageData = ctx.getImageData(0, 0, heatCanvas.width, heatCanvas.height);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                const a = data[i + 3];
                if (a === 0) continue;
                const j = a * 4;
                data[i] = palette[j];
                data[i + 1] = palette[j + 1];
                data[i + 2] = palette[j + 2];
                data[i + 3] = Math.min(180, Math.round(a * 1.1 + 15));
            }
            ctx.putImageData(imageData, 0, 0);
        }

        draw();
        map.on('moveend zoomend', draw);
        canvases.push({ canvas: heatCanvas, draw, cleanup: () => map.off('moveend zoomend', draw) });
    });

    return {
        remove: () => {
            canvases.forEach(c => {
                c.cleanup();
                if (c.canvas.parentNode) c.canvas.remove();
            });
        }
    };
}

// ===== 탭 구성 =====
const TABS = [
    { key: 'all', icon: '🏪' },
    { key: 'top3', icon: '🍽️' },
    { key: 'spending', icon: '💳' },
    { key: 'nightlife', icon: '🌙' },
];

// ===== 메인 컴포넌트 =====
export default function HeatMap({ center, points, radius = 500, multiHeatmaps }) {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const layerRef = useRef(null);
    const [activeTab, setActiveTab] = useState('all');

    // 지도 초기화
    useEffect(() => {
        if (mapInstanceRef.current) mapInstanceRef.current.remove();
        if (!mapRef.current || !center) return;

        const map = L.map(mapRef.current, { center, zoom: 15, zoomControl: true, scrollWheelZoom: true });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19
        }).addTo(map);

        L.circle(center, {
            radius, color: '#6366f1', fillColor: '#6366f1', fillOpacity: 0.04, weight: 2, dashArray: '8, 8'
        }).addTo(map);

        const centerIcon = L.divIcon({
            html: '<div style="width:14px;height:14px;border-radius:50%;background:#6366f1;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>',
            iconSize: [14, 14], iconAnchor: [7, 7], className: ''
        });
        L.marker(center, { icon: centerIcon }).addTo(map)
            .bindTooltip('분석 중심점', { direction: 'top', offset: [0, -10] });

        mapInstanceRef.current = map;

        const observer = new ResizeObserver(() => map.invalidateSize());
        observer.observe(mapRef.current);

        return () => {
            observer.disconnect();
            if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
        };
    }, [center, radius]);

    // 탭 전환 시 히트맵 레이어 교체
    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return;
        if (layerRef.current) { layerRef.current.remove(); layerRef.current = null; }

        const data = multiHeatmaps || {};
        let layer;

        switch (activeTab) {
            case 'all':
                if (data.all?.points?.length > 0) {
                    layer = createSmoothHeatLayer(map, data.all.points, 'heat');
                } else if (points?.length > 0) {
                    layer = createSmoothHeatLayer(map, points, 'heat');
                }
                break;
            case 'top3':
                if (data.top3?.categories?.length > 0) {
                    layer = createCategoryHeatLayers(map, data.top3.categories);
                }
                break;
            case 'nightlife':
                if (data.nightlife?.points?.length > 0) {
                    layer = createSmoothHeatLayer(map, data.nightlife.points, 'cool');
                }
                break;
            case 'spending':
                if (data.spending?.points?.length > 0) {
                    layer = createSmoothHeatLayer(map, data.spending.points, 'warm');
                }
                break;
        }

        layerRef.current = layer || null;
    }, [activeTab, multiHeatmaps, points]);

    const activeHeatmap = multiHeatmaps?.[activeTab];

    return (
        <div className="heatmap-wrapper">
            <div className="heatmap-tabs">
                {TABS.map(tab => {
                    const hm = multiHeatmaps?.[tab.key];
                    const label = hm?.label || tab.key;
                    return (
                        <button
                            key={tab.key}
                            className={`heatmap-tab ${activeTab === tab.key ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.key)}
                        >
                            {tab.icon} {label.replace(/^[^\s]+\s/, '')}
                        </button>
                    );
                })}
            </div>
            {activeHeatmap?.description && (
                <p className="heatmap-desc">{activeHeatmap.description}</p>
            )}
            {activeTab === 'top3' && multiHeatmaps?.top3?.categories && (
                <div className="heatmap-legend">
                    {multiHeatmaps.top3.categories.map((cat, i) => (
                        <span key={i} className="legend-item">
                            <span className="legend-dot" style={{ background: cat.color }} />
                            {cat.category} ({cat.count.toLocaleString()}개)
                        </span>
                    ))}
                </div>
            )}
            <div ref={mapRef} className="map-container" style={{ height: '420px' }} />
        </div>
    );
}
