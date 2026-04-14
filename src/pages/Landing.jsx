import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function Landing() {
    const navigate = useNavigate();
    const [systemTime, setSystemTime] = useState('');
    
    // Eddie Analysis Modal State
    const [showEddieModal, setShowEddieModal] = useState(false);
    const [address, setAddress] = useState('');
    const [radius, setRadius] = useState(500);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [loadingMsg, setLoadingMsg] = useState('');
    const [error, setError] = useState(null);
    
    // 심플한 시계 구현 (터미널 느낌)
    useEffect(() => {
        const timer = setInterval(() => {
            const now = new Date();
            setSystemTime(now.toLocaleTimeString('en-US', { hour12: false }) + ' KST');
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // 에이전트 라우팅 핸들러
    // 에이전트 라우팅 핸들러
    const handleLaunchAgent = (agentId) => {
        if (agentId === 'eddie') setShowEddieModal(true);
        else if (agentId === 'mari') navigate('/compare');
        else if (agentId === 'cora') navigate('/chat');
        else if (agentId === 'opie') navigate('/opie');
    };

    const handleEddieSubmit = async (e) => {
        e.preventDefault();
        if (!address.trim()) return;
        
        setError(null);
        setLoading(true);
        setProgress(5);
        setLoadingMsg('수석 분석관 에디(Eddie)가 입지 데이터를 수집합니다...');

        try {
            const steps = [
                '📍 주소 좌표 변환 및 상권 반경 설정 중...',
                '🏪 반경 내 상가 데이터 수집 중 (국토부 API)...',
                '📊 12종 실측 데이터 매핑 중...',
                '🤖 AI 수익성 판단 및 레포트 생성 중...'
            ];
            
            let stepIndex = 0;
            const msgInterval = setInterval(() => {
                stepIndex = (stepIndex + 1) % steps.length;
                setLoadingMsg(steps[stepIndex]);
                setProgress(prev => Math.min(prev + 15, 90));
            }, 3000);

            const res = await fetch(`${API_BASE}/api/analyze/single`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address, radius })
            });

            clearInterval(msgInterval);
            setProgress(100);

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || '분석 중 오류가 발생했습니다.');
            }

            const resData = await res.json();
            
            setTimeout(() => {
                navigate('/report', {
                    state: {
                        type: 'single',
                        data: { ...resData.data, generatedAt: new Date().toISOString() },
                        address1: address,
                        radius: radius
                    }
                });
            }, 500);
            
        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#0a0f18', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', overflow: 'hidden' }}>
                <div className="b2b-hub-bg" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}></div>
                
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '600px', padding: '40px' }}>
                    <div style={{ position: 'relative', width: '120px', height: '120px', marginBottom: '40px' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, border: '4px solid rgba(6,182,212,0.1)', borderRadius: '50%' }}></div>
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, border: '4px solid transparent', borderTopColor: '#06b6d4', borderRadius: '50%', animation: 'spin 1.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite' }}></div>
                        <div style={{ position: 'absolute', top: '10px', left: '10px', right: '10px', bottom: '10px', border: '2px solid rgba(251,191,36,0.1)', borderRadius: '50%' }}></div>
                        <div style={{ position: 'absolute', top: '10px', left: '10px', right: '10px', bottom: '10px', border: '2px solid transparent', borderBottomColor: '#fbbf24', borderRadius: '50%', animation: 'spin 2s linear infinite reverse' }}>
                            <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
                        </div>
                        <img src="/cora-avatar.png" alt="Cora" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '70px', height: '70px', borderRadius: '50%', objectFit: 'cover', boxShadow: '0 0 20px rgba(6,182,212,0.3)' }} onError={(e) => { e.target.style.display = 'none'; }} />
                    </div>

                    <h2 style={{ fontSize: '28px', fontWeight: 800, margin: '0 0 16px 0', letterSpacing: '-0.02em', textAlign: 'center', background: 'linear-gradient(135deg, #fff 0%, #94a3b8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        EXECUTIVE DATA LINK
                    </h2>
                    
                    <div style={{ fontSize: '18px', color: '#06b6d4', fontWeight: 600, marginBottom: '40px', textAlign: 'center', letterSpacing: '0.05em' }}>
                        {loadingMsg}
                    </div>

                    <div style={{ width: '100%', background: 'rgba(255,255,255,0.05)', height: '8px', borderRadius: '4px', overflow: 'hidden', position: 'relative', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${progress}%`, background: 'linear-gradient(90deg, #06b6d4, #3b82f6)', transition: 'width 0.4s ease-out', boxShadow: '0 0 10px rgba(6,182,212,0.5)' }}>
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)', filter: 'blur(2px)', animation: 'shimmer 2s infinite linear' }}></div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: '12px', color: '#64748b', fontSize: '14px', fontFamily: 'monospace' }}>
                        <span>SYSTEM MODULE: EDDIE</span>
                        <span style={{ color: '#06b6d4' }}>{progress}%</span>
                    </div>

                    <div style={{ marginTop: '30px', padding: '16px 24px', background: 'rgba(6,182,212,0.05)', border: '1px solid rgba(6,182,212,0.2)', borderRadius: '8px', color: '#94a3b8', fontSize: '14px', lineHeight: 1.6, textAlign: 'center', maxWidth: '80%' }}>
                        "코라(Cora)가 지휘 허브에서 수석 분석관 에디(Eddie)의 실측 상권 데이터 분석 파이프라인을 연결하고 있습니다. VWORLD 및 공공데이터 통신 채널 보안 유지 중입니다."
                    </div>

                    <style>
                        {`
                        @keyframes shimmer {
                            0% { transform: translateX(-100%); }
                            100% { transform: translateX(200%); }
                        }
                        `}
                    </style>
                </div>
            </div>
        );
    }

    return (
        <div className="b2b-hub-container">
            {/* 배경 및 노이즈 효과 */}
            <div className="b2b-hub-bg"></div>
            
            <header className="b2b-hub-header">
                <div className="b2b-header-brand">
                    <span className="b2b-brand-logo">STANDBY LAB</span>
                    <span className="b2b-brand-vertical-line"></span>
                    <span className="b2b-brand-subtitle">EXECUTIVE COMMAND CENTER</span>
                </div>
                <div className="b2b-header-status">
                    <div className="b2b-status-indicator">
                        <div className="b2b-status-dot pulse"></div>
                        <span className="b2b-status-text">100% SECURE CONNECTION</span>
                    </div>
                    <div className="b2b-time-display">{systemTime}</div>
                </div>
            </header>

            <main className="b2b-hub-main">
                <section className="b2b-hero-section">
                    <h1 className="b2b-hero-title">
                        VIP 고객을 위한 완벽한 상권 및 자산 비평,<br />
                        <span className="text-gold">엘리트 AI 리서치 팀</span>을 호출하세요.
                    </h1>
                    <p className="b2b-hero-desc">
                        14,000개 이상의 극비 상권 데이터와 실시간 입지 분석 로직 가동 중.<br />
                        수석 분석관이 당신의 의사결정을 지원합니다.
                    </p>
                </section>

                <section className="b2b-agents-grid">
                    {/* 에디 (Eddie) - 입지 분석관 */}
                    <div className="b2b-agent-card" onClick={() => handleLaunchAgent('eddie')}>
                        <div className="b2b-agent-header">
                            <span className="b2b-agent-badge">CHIEF ANALYST</span>
                            <div className="b2b-agent-status online"></div>
                        </div>
                        <div className="b2b-agent-body">
                            <div className="b2b-agent-avatar eddie-avatar">
                                {/* SVG Avatar Placeholder for Eddie */}
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                                    <path d="M3 9h18 M9 21V9"></path>
                                </svg>
                            </div>
                            <div>
                                <h3 className="b2b-agent-name">에디 (Eddie)</h3>
                                <p className="b2b-agent-role">수석 입지/상권 분석관</p>
                            </div>
                        </div>
                        <div className="b2b-agent-desc">
                            "주력 상권의 권역 데이터와 투자가치를 15초 내에 해체하여 브리핑 리포트를 작성합니다."
                        </div>
                        <div className="b2b-agent-footer">
                            <span className="b2b-agent-core">데이터망: 국토부 / 공공데이터 연동 🟢</span>
                            <button className="b2b-btn-launch">단일 입지 브리핑 의뢰 →</button>
                        </div>
                    </div>

                    {/* 마리 (Mari) - 자산 비평관 */}
                    <div className="b2b-agent-card highlight-card" onClick={() => handleLaunchAgent('mari')}>
                        <div className="b2b-agent-header">
                            <span className="b2b-agent-badge gold-badge">CHIEF EVALUATOR</span>
                            <div className="b2b-agent-status online"></div>
                        </div>
                        <div className="b2b-agent-body">
                            <div className="b2b-agent-avatar mari-avatar">
                                {/* SVG Avatar Placeholder for Mari */}
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M12 3v18"></path>
                                    <path d="M3 10V6a2 2 0 012-2h14a2 2 0 012 2v4"></path>
                                    <path d="M3 14v4a2 2 0 002 2h14a2 2 0 002-2v-4"></path>
                                </svg>
                            </div>
                            <div>
                                <h3 className="b2b-agent-name">마리 (Mari)</h3>
                                <p className="b2b-agent-role">수석 자산 비교 비평관</p>
                            </div>
                        </div>
                        <div className="b2b-agent-desc">
                            "A와 B 두 매물의 24가지 실증 지표를 저울질하여 우위를 점하는 투자 대상을 확정합니다."
                        </div>
                        <div className="b2b-agent-footer">
                            <span className="b2b-agent-core">데이터망: KB소비 지수 연동 🟢</span>
                            <button className="b2b-btn-launch gold-btn">핀포인트 비교/비평 의뢰 →</button>
                        </div>
                    </div>

                    {/* 코라 (Cora) - 통합 운영 실장 */}
                    <div className="b2b-agent-card" onClick={() => handleLaunchAgent('cora')}>
                        <div className="b2b-agent-header">
                            <span className="b2b-agent-badge">EXECUTIVE ASSISTANT</span>
                            <div className="b2b-agent-status online"></div>
                        </div>
                        <div className="b2b-agent-body">
                            <div className="b2b-agent-avatar cora-avatar">
                                {/* SVG Avatar Placeholder for Cora */}
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M12 2a5 5 0 00-5 5v2a5 5 0 0010 0V7a5 5 0 00-5-5z"></path>
                                    <path d="M19 10v2a7 7 0 01-14 0v-2"></path>
                                    <line x1="12" y1="19" x2="12" y2="22"></line>
                                </svg>
                            </div>
                            <div>
                                <h3 className="b2b-agent-name">코라 (Cora)</h3>
                                <p className="b2b-agent-role">통합 운영 실장 / 어시스턴트</p>
                            </div>
                        </div>
                        <div className="b2b-agent-desc">
                            "전반적인 시스템 운영 안내와 특이 동향 알림을 담당합니다. 도움이 필요하면 호출하세요."
                        </div>
                        <div className="b2b-agent-footer">
                            <span className="b2b-agent-core">상태: O/S 최적화 대기 중 🟢</span>
                            <button className="b2b-btn-launch">채팅 상담 오픈 →</button>
                        </div>
                    </div>

                    {/* 오피 (Opie) - 브랜딩/마케팅 디렉터 */}
                    <div className="b2b-agent-card purple-card" onClick={() => handleLaunchAgent('opie')}>
                        <div className="b2b-agent-header">
                            <span className="b2b-agent-badge purple-badge">CHIEF MARKETER</span>
                            <div className="b2b-agent-status online"></div>
                        </div>
                        <div className="b2b-agent-body">
                            <div className="b2b-agent-avatar opie-avatar" style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7' }}>
                                {/* SVG Avatar Placeholder for Opie (Pen/Doc icon) */}
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                            </div>
                            <div>
                                <h3 className="b2b-agent-name">오피 (Opie)</h3>
                                <p className="b2b-agent-role">수석 브랜드 콘텐츠 디렉터</p>
                            </div>
                        </div>
                        <div className="b2b-agent-desc">
                            "월간 지역 상권 동향을 요약하여, 중개인 퍼스널 브랜딩 배포용 리포트를 15초 내에 자동 생산합니다."
                        </div>
                        <div className="b2b-agent-footer">
                            <span className="b2b-agent-core">데이터망: 지역구 일일 수집망 🟢</span>
                            <button className="b2b-btn-launch purple-btn">브랜딩 리포트 의뢰 →</button>
                        </div>
                    </div>
                </section>
                
                <footer className="b2b-footer">
                    <div className="b2b-system-specs">
                        <span>SYSTEM CAPACITY: 104M DB / SEC</span>
                        <span>LATENCY: 12MS</span>
                        <span>ENCRYPTION: AES-256</span>
                    </div>
                </footer>
            </main>

            {/* Eddie Modal */}
            {showEddieModal && (
                <div className="b2b-modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(10,15,24,0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="b2b-modal-content" style={{ background: '#1e293b', padding: '40px', borderRadius: '16px', border: '1px solid #06b6d4', width: '90%', maxWidth: '500px', boxShadow: '0 20px 40px rgba(0,0,0,0.5), 0 0 20px rgba(6,182,212,0.1)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '20px', color: '#fff', margin: 0 }}>📍 에디(Eddie) 입지 브리핑 의뢰</h2>
                            {!loading && <button onClick={() => setShowEddieModal(false)} style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '28px', cursor: 'pointer', lineHeight: 1 }}>×</button>}
                        </div>

                            <form onSubmit={handleEddieSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', color: '#94A3B8', marginBottom: '8px' }}>타겟 매물 도로명 주소 (*)</label>
                                    <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="예: 서울 강남구 테헤란로 152" required
                                        style={{ width: '100%', padding: '12px 16px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', outline: 'none' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', color: '#94A3B8', marginBottom: '8px' }}>탐색 상권 반경</label>
                                    <select value={radius} onChange={(e) => setRadius(Number(e.target.value))} 
                                        style={{ width: '100%', padding: '12px 16px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', outline: 'none' }}>
                                        <option value={300}>반경 300m (보도형 인접상권)</option>
                                        <option value={500}>반경 500m (도보권 일반상권)</option>
                                        <option value={1000}>반경 1km (차량/광역 상권)</option>
                                    </select>
                                </div>
                                {error && <div style={{ color: '#fca5a5', fontSize: '13px', padding: '12px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)' }}>❌ {error}</div>}
                                <button type="submit" disabled={!address.trim()} 
                                    style={{ marginTop: '12px', width: '100%', padding: '14px', background: '#06b6d4', color: '#1e293b', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s' }}>
                                    브리핑 시작 (Analyze Target)
                                </button>
                            </form>
                        </div>
                </div>
            )}
        </div>
    );
}
