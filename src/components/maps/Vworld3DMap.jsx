import { useEffect, useRef, useState } from 'react';

export default function Vworld3DMap({ center }) {
    const mapRef = useRef(null);
    const [scriptLoaded, setScriptLoaded] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!mapRef.current || !center) return;

        let retryCount = 0;
        const maxRetries = 20; // 10초 대기 (500ms * 20)

        const initMap = () => {
            // 전역 vw 객체가 로드될 때까지 재시도
            if (window.vw && window.vw.Map) {
                try {
                    const mapOptions = {
                        controlsAutoArrange: true,
                        homePosition: new window.vw.CameraPosition(
                            new window.vw.CoordZ(center[1], center[0], 400),
                            new window.vw.Direction(0, -45, 0)
                        ),
                        initPosition: new window.vw.CameraPosition(
                            new window.vw.CoordZ(center[1], center[0], 400),
                            new window.vw.Direction(0, -45, 0)
                        )
                    };
                    
                    const map = new window.vw.Map("vmap3d", mapOptions);
                    
                    map.setOption({
                        building: true,
                        terrain: true
                    });
                    
                    setScriptLoaded(true);
                } catch (err) {
                    console.error("Vworld Map Init Error:", err);
                    setError("3D 지도 초기화 중 오류가 발생했습니다.");
                }
            } else {
                retryCount++;
                if (retryCount < maxRetries) {
                    setTimeout(initMap, 500);
                } else {
                    setError("Vworld 3D 엔진 로딩에 실패했습니다. (API 설정 확인 필요)");
                }
            }
        };
        
        initMap();
        
    }, [center]);

    if (error) {
        return (
            <div className="map-error-container" style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>🗺️</div>
                    <div style={{ color: '#64748b', fontSize: '14px' }}>{error}</div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ position: 'relative', width: '100%', height: '400px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
             {!scriptLoaded && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', zIndex: 10 }}>
                    <div className="loading-spinner" style={{ width: '30px', height: '30px', border: '3px solid #e2e8f0', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                </div>
            )}
            <div id="vmap3d" ref={mapRef} style={{ width: '100%', height: '100%' }} />
            
            <div style={{ position: 'absolute', bottom: '10px', left: '10px', background: 'rgba(255,255,255,0.9)', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', zIndex: 100, pointerEvents: 'none' }}>
                🖱️ 우클릭 + 드래그하여 화면을 회전해보세요
            </div>
        </div>
    );
}
