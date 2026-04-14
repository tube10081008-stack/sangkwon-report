import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function OpiePage() {
    const navigate = useNavigate();
    
    // Form state
    const [district, setDistrict] = useState('강남구');
    const [agencyName, setAgencyName] = useState('');
    const [brokerName, setBrokerName] = useState('');
    const [phone, setPhone] = useState('');
    
    // UI state
    const [loading, setLoading] = useState(false);
    const [loadingMsg, setLoadingMsg] = useState('');
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState(null);
    const [resultMarkdown, setResultMarkdown] = useState('');
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(resultMarkdown).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const handleGenerate = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        setProgress(5);
        setResultMarkdown('');
        setLoadingMsg('수석 디렉터 오피(Opie)가 타겟 지역 데이터를 수집합니다...');

        try {
            const steps = [
                '📍 관할구 상가 동향 데이터 병합 중...',
                '🔥 지역 핫스팟 및 쿨다운 섹터 분석 중...',
                '📊 신규 진입 프랜차이즈 트렌드 스크래핑 중...',
                '✍️ AI 기반 마케팅 카피 및 중개사 명함 융합 중...'
            ];
            
            let stepIndex = 0;
            const msgInterval = setInterval(() => {
                stepIndex = (stepIndex + 1) % steps.length;
                setLoadingMsg(steps[stepIndex]);
                setProgress(prev => Math.min(prev + 20, 95));
            }, 2500);

            const res = await fetch(`${API_BASE}/api/opie/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ district, agencyName, brokerName, phone })
            });

            clearInterval(msgInterval);
            setProgress(100);

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || '리포트 생성 중 오류가 발생했습니다.');
            }

            const data = await res.json();
            
            setTimeout(() => {
                setLoading(false);
                setResultMarkdown(data.markdown);
            }, 500);

        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    };

    // 로딩 화면 (Landing.jsx의 B2B 프리미엄 로딩 구조 차용 - 퍼플 테마)
    if (loading) {
        return (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#0a0f18', zIndex: 9999, display: 'flex', color: '#fff', overflow: 'hidden' }}>
                <div className="b2b-hub-bg" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}></div>
                
                {/* Left Pane */}
                <div style={{ flex: 1, position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ position: 'relative', width: '120px', height: '120px', marginBottom: '40px' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, border: '4px solid rgba(168,85,247,0.1)', borderRadius: '50%' }}></div>
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, border: '4px solid transparent', borderTopColor: '#a855f7', borderRadius: '50%', animation: 'spin 1.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite' }}></div>
                        <div style={{ position: 'absolute', top: '15px', left: '15px', right: '15px', bottom: '15px', border: '2px dotted rgba(216,180,254,0.3)', borderRadius: '50%', animation: 'spin 3s linear infinite reverse' }}>
                            <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
                        </div>
                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#c084fc' }}>
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </div>
                    </div>

                    <h2 style={{ fontSize: '28px', fontWeight: 800, margin: '0 0 16px 0', letterSpacing: '-0.02em', textAlign: 'center', background: 'linear-gradient(135deg, #fff 0%, #d8b4fe 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        MARKETING ENGINE ACROSS
                    </h2>
                    
                    <div style={{ fontSize: '18px', color: '#c084fc', fontWeight: 600, marginBottom: '40px', textAlign: 'center', letterSpacing: '0.05em' }}>
                        {loadingMsg}
                    </div>

                    <div style={{ width: '100%', maxWidth: '400px', background: 'rgba(255,255,255,0.05)', height: '8px', borderRadius: '4px', overflow: 'hidden', position: 'relative', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${progress}%`, background: 'linear-gradient(90deg, #c084fc, #6366f1)', transition: 'width 0.4s ease-out', boxShadow: '0 0 10px rgba(168,85,247,0.5)' }}>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: '400px', marginTop: '12px', color: '#64748b', fontSize: '14px', fontFamily: 'monospace' }}>
                        <span style={{ color: '#94a3b8' }}>SYSTEM MODULE: OPIE</span>
                        <span style={{ color: '#c084fc' }}>{progress}%</span>
                    </div>

                    <div style={{ marginTop: '30px', color: '#94a3b8', fontSize: '13px' }}>
                        소집 및 가공 프로세스가 동작 중입니다. 창을 닫지 마십시오.
                    </div>
                </div>

                {/* Right Pane (Skeleton UI) */}
                <div className="b2b-skeleton-pane" style={{ flex: 1, position: 'relative', zIndex: 1, padding: '60px', display: 'flex', flexDirection: 'column', gap: '20px', background: 'radial-gradient(circle at center, rgba(15,23,42,0.8) 0%, rgba(10,15,24,0.95) 100%)' }}>
                    <div style={{ fontSize: '12px', color: '#64748b', letterSpacing: '2px', marginBottom: '10px' }}>GENERATING CONTENT PREVIEW</div>
                    
                    <div className="skeleton-box" style={{ width: '70%', height: '32px', borderRadius: '6px' }}></div>
                    <div className="skeleton-box" style={{ width: '40%', height: '16px', borderRadius: '4px', marginBottom: '20px' }}></div>
                    
                    <div className="skeleton-box" style={{ width: '100%', height: '200px', borderRadius: '12px', marginBottom: '20px' }}></div>
                    
                    <div className="skeleton-box" style={{ width: '100%', height: '12px', borderRadius: '4px' }}></div>
                    <div className="skeleton-box" style={{ width: '85%', height: '12px', borderRadius: '4px' }}></div>
                    <div className="skeleton-box" style={{ width: '90%', height: '12px', borderRadius: '4px' }}></div>
                    <div className="skeleton-box" style={{ width: '60%', height: '12px', borderRadius: '4px', marginTop: '20px' }}></div>

                    <style>
                        {`
                        .skeleton-box {
                            position: relative;
                            background: #1e293b;
                            overflow: hidden;
                        }
                        .skeleton-box::after {
                            content: '';
                            position: absolute;
                            top: 0; left: 0; right: 0; bottom: 0;
                            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
                            transform: translateX(-100%);
                            animation: shimmer-sweep 1.5s infinite;
                        }
                        @keyframes shimmer-sweep {
                            100% { transform: translateX(100%); }
                        }
                        @media (max-width: 768px) {
                            .b2b-skeleton-pane { display: none !important; }
                        }
                        `}
                    </style>
                </div>
            </div>
        );
    }

    return (
        <div className="b2b-hub-container">
            <div className="b2b-hub-bg"></div>
            
            <header style={{ padding: '24px 40px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '24px', cursor: 'pointer' }}>←</button>
                    <div>
                        <h1 style={{ color: '#fff', fontSize: '20px', margin: 0, fontWeight: 700 }}>오피(Opie) - 브랜딩 리포트 의뢰</h1>
                        <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0 0' }}>수석 콘텐츠 디렉터가 귀하의 마케팅 에셋을 작성합니다.</p>
                    </div>
                </div>
            </header>

            <main style={{ padding: '40px', position: 'relative', zIndex: 1, display: 'flex', gap: '40px', maxWidth: '1200px', margin: '0 auto', flexWrap: 'wrap' }}>
                
                {/* 입력 폼 영역 */}
                <div style={{ flex: '1 1 400px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: '16px', padding: '30px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
                    <h2 style={{ fontSize: '18px', color: '#c084fc', marginBottom: '24px', borderBottom: '1px solid rgba(168,85,247,0.2)', paddingBottom: '12px' }}>
                        📋 의뢰서 작성
                    </h2>
                    
                    <form onSubmit={handleGenerate} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', color: '#94A3B8', marginBottom: '8px' }}>타겟 지역구 (*)</label>
                            <select value={district} onChange={(e) => setDistrict(e.target.value)} 
                                style={{ width: '100%', padding: '12px 16px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', outline: 'none' }}>
                                <option value="강남구">강남구 (Gangnam-gu)</option>
                                <option value="서초구">서초구 (Seocho-gu)</option>
                                <option value="송파구">송파구 (Songpa-gu)</option>
                                <option value="성동구">성동구 (Seongdong-gu)</option>
                                <option value="마포구">마포구 (Mapo-gu)</option>
                                <option value="용산구">용산구 (Yongsan-gu)</option>
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', color: '#94A3B8', marginBottom: '8px' }}>소속 중개사무소 명칭 (*)</label>
                            <input type="text" value={agencyName} onChange={(e) => setAgencyName(e.target.value)} placeholder="예: 스탠바이 부동산 중개사무소" required
                                style={{ width: '100%', padding: '12px 16px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', outline: 'none' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', color: '#94A3B8', marginBottom: '8px' }}>담당자 성함 (*)</label>
                            <input type="text" value={brokerName} onChange={(e) => setBrokerName(e.target.value)} placeholder="예: 김상권 공인중개사" required
                                style={{ width: '100%', padding: '12px 16px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', outline: 'none' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', color: '#94A3B8', marginBottom: '8px' }}>상담 연락처 (*)</label>
                            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="예: 010-1234-5678" required
                                style={{ width: '100%', padding: '12px 16px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', outline: 'none' }} />
                        </div>

                        {error && <div style={{ color: '#fca5a5', fontSize: '13px', padding: '12px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)' }}>❌ {error}</div>}
                        
                        <button type="submit" disabled={!agencyName.trim() || !brokerName.trim() || !phone.trim()} 
                            style={{ marginTop: '12px', width: '100%', padding: '16px', background: 'rgba(168,85,247,0.15)', color: '#d8b4fe', border: '1px solid rgba(168,85,247,0.4)', borderRadius: '8px', fontSize: '15px', fontWeight: 800, cursor: (!agencyName.trim() || !brokerName.trim() || !phone.trim()) ? 'not-allowed' : 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 15px rgba(168,85,247,0.2)' }}>
                            포스팅 원고 생성 명령
                        </button>
                    </form>
                </div>

                {/* 생성 결과 영역 */}
                <div style={{ flex: '1 1 500px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ padding: '16px 24px', background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '14px', color: '#cbd5e1', fontWeight: 600 }}>✨ 오피 초안 (Draft)</span>
                        <button 
                            onClick={handleCopy}
                            disabled={!resultMarkdown}
                            style={{ background: copied ? '#22c55e' : 'transparent', color: copied ? '#fff' : '#c084fc', border: `1px solid ${copied ? '#22c55e' : '#c084fc'}`, padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: resultMarkdown ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}
                        >
                            {copied ? '복사 완료!' : '텍스트 전체 복사'}
                        </button>
                    </div>

                    <div style={{ padding: '30px', overflowY: 'auto', maxHeight: '600px', color: '#e2e8f0', lineHeight: 1.8, fontSize: '15px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                        {resultMarkdown ? (
                            <div className="마크다운-컨텐츠" style={{ whiteSpace: 'pre-line' }}>
                                <ReactMarkdown>
                                    {resultMarkdown}
                                </ReactMarkdown>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b', textAlign: 'center' }}>
                                <div style={{ fontSize: '40px', marginBottom: '16px', opacity: 0.5 }}>📝</div>
                                <p>아직 작성된 원고가 없습니다.<br/>좌측 폼을 채워 의뢰해주세요.</p>
                            </div>
                        )}
                    </div>
                </div>

            </main>
        </div>
    );
}
