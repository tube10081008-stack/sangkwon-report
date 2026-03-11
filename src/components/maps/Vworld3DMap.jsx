import { useEffect, useRef, useState } from 'react';

export default function Vworld3DMap({ center }) {
    const mapRef = useRef(null);
    const [scriptLoaded, setScriptLoaded] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        // 이미 스크립트가 로드되었는지 확인
        if (window.vw && window.vw.Map) {
            setScriptLoaded(true);
            return;
        }

        const scriptUrl = `https://map.vworld.kr/js/webglMapInit.js.do?version=2.0&apiKey=${import.meta.env.VITE_VWORLD_API_KEY}`;
        
        // 기존 스크립트가 로딩 중인지 확인
        let script = document.querySelector(`script[src^="https://map.vworld.kr/js/webglMapInit.js.do"]`);
        
        if (!script) {
            script = document.createElement('script');
            script.src = scriptUrl;
            script.async = true;
            document.head.appendChild(script);
        }

        const handleLoad = () => setScriptLoaded(true);
        const handleError = () => setError("Vworld 3D 지도를 불러오는데 실패했습니다.");

        script.addEventListener('load', handleLoad);
        script.addEventListener('error', handleError);

        return () => {
            script.removeEventListener('load', handleLoad);
            script.removeEventListener('error', handleError);
        };
    }, []);

    useEffect(() => {
        if (!scriptLoaded || !mapRef.current || !center) return;

        try {
            // Vworld 3D Map 초기화
            // vw.Map 객체가 로드될 때까지 약간의 지연이 필요할 수 있음
            const initMap = () => {
                if (window.vw && window.vw.Map) {
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
                    
                    // 건물 모델링 활성화
                    map.setOption({
                        building: true,
                        terrain: true
                    });
                } else {
                    setTimeout(initMap, 500);
                }
            };
            
            initMap();
        } catch (err) {
            console.error("Vworld Map Init Error:", err);
            setError("3D 지도 초기화 중 오류가 발생했습니다.");
        }
        
    }, [scriptLoaded, center]);

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
            
            {/* 3D 컨트롤러 오버레이 안내 */}
            <div style={{ position: 'absolute', bottom: '10px', left: '10px', background: 'rgba(255,255,255,0.9)', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', zIndex: 100, pointerEvents: 'none' }}>
                🖱️ 우클릭 + 드래그하여 화면을 회전해보세요
            </div>
        </div>
    );
}
