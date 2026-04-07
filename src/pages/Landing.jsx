import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const LOADING_MESSAGES = [
    '📍 코라가 주소를 좌표로 변환하고 있어요...',
    '🔍 반경 내 상가업소를 수집 중이에요...',
    '📊 업종별 분포를 분석하고 있어요...',
    '🧮 Shannon Diversity Index를 계산 중...',
    '📈 HHI 경쟁강도를 분석 중...',
    '🏢 프랜차이즈 현황을 조사 중이에요...',
    '🎯 종합 등급을 산출하고 있어요...',
    '💡 전문가 인사이트를 생성 중이에요...',
    '📋 리포트를 마무리하고 있어요!'
];

export default function Landing() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('single');
    const [loading, setLoading] = useState(false);
    const [loadingMsg, setLoadingMsg] = useState('');
    const [progress, setProgress] = useState(0);

    const [address1, setAddress1] = useState('');
    const [address2, setAddress2] = useState('');
    const [targetCategory, setTargetCategory] = useState('');
    const [radius, setRadius] = useState(500);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!address1.trim()) return alert('주소를 입력해주세요.');
        if (activeTab === 'compare' && !address2.trim()) return alert('비교할 두 번째 주소를 입력해주세요.');
        if (activeTab === 'strategy' && !targetCategory.trim()) return alert('희망 업종을 입력해주세요.');

        setLoading(true);
        setProgress(0);

        let msgIdx = 0;
        setLoadingMsg(LOADING_MESSAGES[0]);
        const msgInterval = setInterval(() => {
            msgIdx = (msgIdx + 1) % LOADING_MESSAGES.length;
            setLoadingMsg(LOADING_MESSAGES[msgIdx]);
            setProgress(prev => Math.min(prev + 12, 90));
        }, 2500);

        try {
            let endpoint, body;
            switch (activeTab) {
                case 'single':
                    endpoint = '/api/analyze/single';
                    body = { address: address1, radius, targetCategory: targetCategory || undefined };
                    break;
                case 'compare':
                    endpoint = '/api/analyze/compare';
                    body = { address1, address2, radius, targetCategory: targetCategory || undefined };
                    break;
                case 'strategy':
                    endpoint = '/api/analyze/strategy';
                    body = { address: address1, radius, targetCategory };
                    break;
            }

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const result = await res.json();
            if (!result.success) throw new Error(result.error || '분석 실패');

            setProgress(100);
            clearInterval(msgInterval);

            setTimeout(() => {
                navigate('/report', {
                    state: { type: activeTab, data: result.data, address1, address2, targetCategory, radius }
                });
            }, 500);
        } catch (err) {
            clearInterval(msgInterval);
            setLoading(false);
            alert('분석 오류: ' + err.message);
        }
    };

    if (loading) {
        return (
            <div className="cora-loading-overlay">
                <img src="/cora-avatar.png" alt="Cora" className="cora-loading-avatar" />
                <div className="cora-loading-ring"></div>
                <div className="cora-loading-msg">{loadingMsg}</div>
                <div className="cora-loading-bar-track">
                    <div className="cora-loading-bar-fill" style={{ width: `${progress}%` }} />
                </div>
                <p className="cora-loading-sub">잠시만 기다려 주세요, 곧 분석이 완료돼요! ✨</p>
            </div>
        );
    }

    return (
        <div className="cora-landing">
            {/* 네비게이션 */}
            <nav className="cora-nav">
                <div className="cora-nav-brand">
                    <img src="/cora-avatar.png" alt="Cora" className="cora-nav-avatar" />
                    <span className="cora-nav-name">Cora</span>
                    <span className="cora-nav-badge">AI</span>
                </div>
                <div className="cora-nav-links">
                    <Link to="/chat" className="cora-nav-link cora-nav-chat-link">💬 코라에게 물어보기</Link>
                    <Link to="/agent-hub" className="cora-nav-link">🤖 에이전트 허브</Link>
                </div>
            </nav>

            {/* 히어로 섹션 */}
            <section className="cora-hero">
                <div className="cora-hero-glow"></div>
                <div className="cora-hero-content">
                    <div className="cora-hero-intro">
                        <div className="cora-hero-avatar-wrap">
                            <img src="/cora-avatar.png" alt="Cora" className="cora-hero-avatar" />
                            <div className="cora-hero-status"></div>
                        </div>
                        <div className="cora-hero-greeting">
                            <p className="cora-hero-hello">안녕하세요, 저는 <strong>코라</strong>예요 👋</p>
                            <h1 className="cora-hero-title">
                                어떤 상권이<br/>
                                <span className="cora-gradient-text">궁금하세요?</span>
                            </h1>
                            <p className="cora-hero-desc">
                                주소만 알려주시면 AI가 업종 분포, 경쟁 강도, 프랜차이즈 비율까지
                                <br/>모든 걸 분석해서 알려드릴게요.
                            </p>
                        </div>
                    </div>

                    {/* 분석 폼 */}
                    <form className="cora-form" onSubmit={handleSubmit}>
                        <div className="cora-form-card">
                            <div className="cora-form-tabs">
                                {[
                                    { key: 'single', icon: '📍', label: '단일 분석' },
                                    { key: 'compare', icon: '⚖️', label: '비교 분석' },
                                    { key: 'strategy', icon: '🎯', label: '필승전략' }
                                ].map(tab => (
                                    <button key={tab.key} type="button"
                                        className={`cora-tab ${activeTab === tab.key ? 'active' : ''}`}
                                        onClick={() => setActiveTab(tab.key)}>
                                        <span className="cora-tab-icon">{tab.icon}</span>
                                        <span>{tab.label}</span>
                                    </button>
                                ))}
                            </div>

                            <div className="cora-form-body">
                                <div className="cora-input-group">
                                    <label className="cora-label">{activeTab === 'compare' ? '상권 A' : '분석 주소'}</label>
                                    <div className="cora-input-wrap">
                                        <span className="cora-input-icon">🔍</span>
                                        <input type="text" className="cora-field"
                                            placeholder="예: 강남역, 서울 마포구 양화로 45"
                                            value={address1} onChange={e => setAddress1(e.target.value)} />
                                    </div>
                                </div>

                                {activeTab === 'compare' && (
                                    <div className="cora-input-group">
                                        <label className="cora-label">상권 B</label>
                                        <div className="cora-input-wrap">
                                            <span className="cora-input-icon">📍</span>
                                            <input type="text" className="cora-field"
                                                placeholder="예: 홍대입구, 서울 성동구 성수이로"
                                                value={address2} onChange={e => setAddress2(e.target.value)} />
                                        </div>
                                    </div>
                                )}

                                <div className="cora-form-row">
                                    <div className="cora-input-group cora-flex1">
                                        <label className="cora-label">관심 업종 {activeTab !== 'strategy' && <span className="cora-optional">선택</span>}</label>
                                        <div className="cora-input-wrap">
                                            <span className="cora-input-icon">🏪</span>
                                            <input type="text" className="cora-field"
                                                placeholder="예: 카페, 음식점"
                                                value={targetCategory} onChange={e => setTargetCategory(e.target.value)} />
                                        </div>
                                    </div>
                                    <div className="cora-input-group">
                                        <label className="cora-label">반경</label>
                                        <div className="cora-radius-pills">
                                            {[500, 1000, 1500, 3000].map(r => (
                                                <button key={r} type="button"
                                                    className={`cora-pill ${radius === r ? 'active' : ''}`}
                                                    onClick={() => setRadius(r)}>
                                                    {r >= 1000 ? `${r / 1000}km` : `${r}m`}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <button type="submit" className="cora-submit">
                                    <img src="/cora-avatar.png" alt="" className="cora-submit-avatar" />
                                    <span>
                                        {activeTab === 'single' && '코라에게 분석 요청하기'}
                                        {activeTab === 'compare' && '코라에게 비교 요청하기'}
                                        {activeTab === 'strategy' && '코라에게 전략 요청하기'}
                                    </span>
                                    <span className="cora-submit-arrow">→</span>
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </section>

            {/* 코라의 능력 */}
            <section className="cora-features">
                <div className="cora-features-header">
                    <span className="cora-features-badge">✨ Powered by AI</span>
                    <h2 className="cora-features-title">코라가 할 수 있는 것들</h2>
                    <p className="cora-features-desc">공공데이터 + 학술 분석 기법 + AI 인사이트를 결합한 프리미엄 분석</p>
                </div>
                <div className="cora-features-grid">
                    {[
                        { icon: '📊', title: '6대 핵심 지표', desc: 'Shannon 다양성, HHI 경쟁강도 등 학술적 분석으로 상권을 정밀 진단' },
                        { icon: '🗺️', title: '3D 스카이뷰 맵', desc: 'Vworld 3D 엔진으로 타겟 건물과 주변 상권을 입체적으로 시각화' },
                        { icon: '🎯', title: '맞춤 필승전략', desc: 'SWOT 분석, 타겟 고객 프로파일링, 차별화 포지셔닝 가이드 제공' },
                        { icon: '⚖️', title: '상권 비교 분석', desc: '두 후보지를 레이더 차트로 비교하여 최적 입지를 추천' },
                        { icon: '🏢', title: '프랜차이즈 분석', desc: '200개+ 프랜차이즈 DB로 브랜드 밀집도와 독립 상점 생존율 분석' },
                        { icon: '💬', title: 'AI 실시간 대화', desc: '코라에게 자유롭게 질문하고 실시간 상권 인사이트를 받아보세요' },
                    ].map((f, i) => (
                        <div key={i} className="cora-feature-card" style={{ animationDelay: `${i * 0.08}s` }}>
                            <div className="cora-feature-icon">{f.icon}</div>
                            <h3>{f.title}</h3>
                            <p>{f.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* 푸터 */}
            <footer className="cora-footer">
                <img src="/cora-avatar.png" alt="Cora" className="cora-footer-avatar" />
                <p>© 2026 Cora AI — 공공데이터 기반 상권분석 에이전트</p>
                <div className="cora-footer-links">
                    <Link to="/chat">💬 코라와 대화하기</Link>
                    <Link to="/agent-hub">🤖 에이전트 허브</Link>
                </div>
            </footer>
        </div>
    );
}
