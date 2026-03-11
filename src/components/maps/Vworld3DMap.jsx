
export default function Vworld3DMap({ center }) {
    if (!center || center.length !== 2) {
        return (
            <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
                    좌표 정보가 유효하지 않습니다.
                </div>
            </div>
        );
    }

    const apiKey = import.meta.env.VITE_VWORLD_API_KEY;
    const iframeSrc = `/vworld3d.html?lon=${center[0]}&lat=${center[1]}&apikey=${apiKey}`;

    return (
        <div style={{ position: 'relative', width: '100%', height: '400px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
            <iframe 
                src={iframeSrc} 
                title="Vworld 3D Map"
                style={{ width: '100%', height: '100%', border: 'none' }}
                allow="geolocation"
            />
            {/* 3D 컨트롤러 오버레이 안내 */}
            <div style={{ position: 'absolute', bottom: '10px', left: '10px', background: 'rgba(255,255,255,0.9)', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', zIndex: 100, pointerEvents: 'none' }}>
                🖱️ 우클릭 + 드래그하여 화면을 회전해보세요
            </div>
        </div>
    );
}
