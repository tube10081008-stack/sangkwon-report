import { useState, useRef } from 'react';

export default function Vworld3DMap({ center }) {
    const [searchAddr, setSearchAddr] = useState('');
    const [searching, setSearching] = useState(false);
    const iframeRef = useRef(null);

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

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchAddr.trim()) return;
        
        setSearching(true);
        try {
            const res = await fetch(`/api/geocode?address=${encodeURIComponent(searchAddr)}`);
            const data = await res.json();
            
            if (data.success && data.location) {
                // iframe 내부로 이동 좌표 데이터 전송
                if (iframeRef.current && iframeRef.current.contentWindow) {
                    iframeRef.current.contentWindow.postMessage({
                        type: 'MOVE_CAMERA',
                        lon: data.location.longitude,
                        lat: data.location.latitude
                    }, '*');
                }
            } else {
                alert('입력하신 주소를 찾을 수 없습니다.');
            }
        } catch (err) {
            console.error(err);
            alert('주소 검색 중 오류가 발생했습니다.');
        }
        setSearching(false);
    };

    return (
        <div style={{ position: 'relative', width: '100%', height: '600px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
            {/* 검색창 UI 오버레이 */}
            <div style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 1000 }}>
                <form 
                    onSubmit={handleSearch} 
                    style={{ 
                        display: 'flex', 
                        gap: '6px', 
                        background: 'rgba(255, 255, 255, 0.95)', 
                        padding: '6px', 
                        borderRadius: '8px', 
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        backdropFilter: 'blur(4px)'
                    }}
                >
                    <input 
                        type="text" 
                        value={searchAddr} 
                        onChange={(e) => setSearchAddr(e.target.value)}
                        placeholder="이동할 주소 입력 (예: 판교역)"
                        style={{ 
                            padding: '8px 12px', 
                            border: '1px solid #cbd5e1', 
                            borderRadius: '6px', 
                            fontSize: '13px', 
                            width: '200px', 
                            outline: 'none'
                        }}
                    />
                    <button 
                        type="submit" 
                        disabled={searching} 
                        style={{ 
                            padding: '8px 16px', 
                            background: '#3b82f6', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '6px', 
                            cursor: searching ? 'not-allowed' : 'pointer', 
                            fontSize: '13px', 
                            fontWeight: '600',
                            transition: 'background 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}
                    >
                        {searching ? (
                            <>
                                <span className="spinner" style={{ width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></span>
                                이동중...
                            </>
                        ) : '이동 🚀'}
                    </button>
                </form>
            </div>

            <iframe 
                ref={iframeRef}
                src={iframeSrc} 
                title="Vworld 3D Map"
                style={{ width: '100%', height: '100%', border: 'none', background: '#f8fafc' }}
                allow="geolocation"
            />
            {/* 3D 컨트롤러 오버레이 안내 */}
            <div style={{ position: 'absolute', bottom: '10px', left: '10px', background: 'rgba(255,255,255,0.9)', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', zIndex: 100, pointerEvents: 'none' }}>
                🖱️ 우클릭 + 드래그하여 화면을 회전해보세요
            </div>
            
            <style>{`
                @keyframes spin { 100% { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
