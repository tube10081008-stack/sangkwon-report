import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const LOADING_MESSAGES = [
    '📍 주소를 좌표로 변환하고 있습니다...',
    '🔍 반경 내 상가업소를 수집하고 있습니다...',
    '📊 업종별 분포를 분석하고 있습니다...',
    '🧮 Shannon Diversity Index를 계산 중입니다...',
    '📈 HHI 경쟁강도를 분석 중입니다...',
    '🏢 프랜차이즈 현황을 조사 중입니다...',
    '🎯 종합 등급을 산출 중입니다...',
    '💡 전문가 인사이트를 생성 중입니다...',
    '📋 리포트를 최종 정리 중입니다...'
];

export default function Landing() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('single');
    const [loading, setLoading] = useState(false);
    const [loadingMsg, setLoadingMsg] = useState('');
    const [progress, setProgress] = useState(0);

    // Form states
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

        // Loading messages animation
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

            if (!result.success) {
                throw new Error(result.error || '분석 실패');
            }

            setProgress(100);
            clearInterval(msgInterval);

            // Navigate to report page with data
            setTimeout(() => {
                navigate('/report', {
                    state: {
                        type: activeTab,
                        data: result.data,
                        address1,
                        address2,
                        targetCategory,
                        radius
                    }
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
            <div className="loading-overlay">
                <div className="loading-spinner" />
                <div className="loading-messages">{loadingMsg}</div>
                <div className="loading-progress">
                    <div className="loading-progress-bar" style={{ width: `${progress}%` }} />
                </div>
            </div>
        );
    }

    return (
        <div className="landing">
            <section className="hero">
                <div className="hero-content">
                    <div className="hero-badge">
                        🎯 공공데이터 기반 프리미엄 상권분석
                    </div>
                    <h1>
                        주소 하나로 완성하는<br />
                        <span className="gradient-text">데이터 상권분석 리포트</span>
                    </h1>
                    <p>
                        GIS 공공데이터와 전문 분석 알고리즘으로<br />
                        창업 성공의 답을 찾아드립니다
                    </p>
                </div>

                <form className="analysis-form" onSubmit={handleSubmit}>
                    <div className="form-card">
                        <div className="form-tabs">
                            <button type="button" className={`form-tab ${activeTab === 'single' ? 'active' : ''}`} onClick={() => setActiveTab('single')}>
                                📍 단일 분석
                            </button>
                            <button type="button" className={`form-tab ${activeTab === 'compare' ? 'active' : ''}`} onClick={() => setActiveTab('compare')}>
                                📊 비교 분석
                            </button>
                            <button type="button" className={`form-tab ${activeTab === 'strategy' ? 'active' : ''}`} onClick={() => setActiveTab('strategy')}>
                                🎯 필승전략
                            </button>
                        </div>

                        <div className="form-group">
                            <label className="form-label">
                                {activeTab === 'compare' ? '상권 A 주소' : '분석할 주소'}
                            </label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="예: 서울 강남구 테헤란로 123"
                                value={address1}
                                onChange={e => setAddress1(e.target.value)}
                            />
                        </div>

                        {activeTab === 'compare' && (
                            <div className="form-group">
                                <label className="form-label">상권 B 주소</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="예: 서울 마포구 양화로 45"
                                    value={address2}
                                    onChange={e => setAddress2(e.target.value)}
                                />
                            </div>
                        )}

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">희망 업종 {activeTab !== 'strategy' ? '(선택)' : ''}</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="예: 음식, 카페, 소매"
                                    value={targetCategory}
                                    onChange={e => setTargetCategory(e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">분석 반경</label>
                                <div className="radius-selector">
                                    {[300, 500, 1000].map(r => (
                                        <button
                                            key={r}
                                            type="button"
                                            className={`radius-btn ${radius === r ? 'active' : ''}`}
                                            onClick={() => setRadius(r)}
                                        >
                                            {r}m
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <button type="submit" className="submit-btn">
                            {activeTab === 'single' && '🔍 상권 분석 시작'}
                            {activeTab === 'compare' && '📊 비교 분석 시작'}
                            {activeTab === 'strategy' && '🎯 필승전략 분석 시작'}
                        </button>
                    </div>
                </form>
            </section>

            <section className="features">
                <h2 className="section-title">왜 이 리포트가 다른가요?</h2>
                <p className="section-subtitle">
                    단순 데이터 나열이 아닌, 학술적 분석 기법과 전문가 인사이트를 결합한 프리미엄 리포트
                </p>
                <div className="features-grid">
                    <div className="feature-card">
                        <div className="feature-icon">📊</div>
                        <h3>6대 핵심 지표 분석</h3>
                        <p>Shannon Diversity Index, HHI 경쟁강도 등 학술적 분석 기법으로 상권을 정밀 진단합니다.</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon">🗺️</div>
                        <h3>인터랙티브 GIS 지도</h3>
                        <p>업소 밀도 히트맵과 업종별 분포를 실시간 인터랙티브 지도로 시각화합니다.</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon">🎯</div>
                        <h3>맞춤형 필승전략</h3>
                        <p>SWOT 분석, 타겟 고객 프로파일링, 포지셔닝 전략까지 실전 가이드를 제공합니다.</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon">📋</div>
                        <h3>투명한 등급 산출</h3>
                        <p>6개 지표의 가중 평균으로 S~D 등급을 산출하며, 모든 근거를 공개합니다.</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon">🔄</div>
                        <h3>상권 비교 분석</h3>
                        <p>후보지 2곳을 레이더 차트로 직관적으로 비교하여 최적 입지를 추천합니다.</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon">📥</div>
                        <h3>PDF 다운로드</h3>
                        <p>전문적인 리포트를 PDF로 다운로드하여 투자자·파트너에게 공유할 수 있습니다.</p>
                    </div>
                </div>
            </section>
        </div>
    );
}
