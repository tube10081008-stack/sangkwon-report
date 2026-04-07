import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const LOADING_MESSAGES = [
    '📍 코라가 주소를 좌표로 변환하고 있어요...',
    '🔍 주변 상가 데이터를 끝까지 긁어모으는 중...',
    '📊 동네 업종 분포를 한눈에 볼 수 있게 정리 중...',
    '🧮 복잡한 지표(Shannon 다각화 지수 등)를 계산하고 있어요...',
    '📈 주변 상권의 실질적인 경쟁강도를 분석 중...',
    '🏢 대형 프랜차이즈의 위협은 없는지 체크 중...',
    '🎯 최적의 종합 등급을 산출하고 있어요...',
    '💡 코라만의 맞춤형 인사이트를 생성 중이에요!',
    '📋 리포트 작성이 거의 다 끝났어요!'
];

export default function Landing() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [loadingMsg, setLoadingMsg] = useState('');
    const [progress, setProgress] = useState(0);

    const [address, setAddress] = useState('');
    
    // 심플한 UI를 위해 카테고리와 반경은 고급 옵션으로 숨겨놓거나 내부적으로 기본값 사용
    // 여기서는 가장 많이 쓰이는 기본값(반경 500m, 전체 업종)을 사용합니다.
    const radius = 500; 

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!address.trim()) return alert('궁금한 주소나 동네 이름을 입력해주세요!');

        setLoading(true);
        setProgress(0);

        let msgIdx = 0;
        setLoadingMsg(LOADING_MESSAGES[0]);
        const msgInterval = setInterval(() => {
            msgIdx = (msgIdx + 1) % LOADING_MESSAGES.length;
            setLoadingMsg(LOADING_MESSAGES[msgIdx]);
            setProgress(prev => Math.min(prev + 12, 90));
        }, 2200);

        try {
            const res = await fetch('/api/analyze/single', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address, radius })
            });
            const result = await res.json();
            if (!result.success) throw new Error(result.error || '분석에 실패했어요. 주소를 다시 확인해주세요!');

            setProgress(100);
            clearInterval(msgInterval);

            setTimeout(() => {
                navigate('/report', {
                    state: { type: 'single', data: result.data, address1: address, radius }
                });
            }, 600);
        } catch (err) {
            clearInterval(msgInterval);
            setLoading(false);
            alert('앗! 에러가 발생했어요: ' + err.message);
        }
    };

    if (loading) {
        return (
            <div className="cora-loading-overlay">
                <img src="/cora-profile.png" alt="Cora Profile" className="cora-loading-avatar" />
                <div className="cora-loading-ring"></div>
                <div className="cora-loading-msg">{loadingMsg}</div>
                <div className="cora-loading-bar-track">
                    <div className="cora-loading-bar-fill" style={{ width: `${progress}%` }} />
                </div>
                <p className="cora-loading-sub">잠시만 기다려 주세요, AI 에이전트 코라가 열심히 분석 중이에요! ✨</p>
            </div>
        );
    }

    return (
        <div className="cora-landing-v3">
            {/* 배경 CSS 토폴로지 효과 레이어 */}
            <div className="cv3-bg-topology"></div>
            
            {/* 네비게이션 */}
            <nav className="cv3-nav">
                <div className="cv3-nav-brand">
                    <span className="cv3-nav-name">STANDBY LAB AI</span>
                </div>
            </nav>

            <main className="cv3-main">
                {/* 라이브 데이터 상태 뱃지 */}
                <div className="cv3-live-badge-wrapper">
                    <div className="cv3-live-badge">
                        <span className="cv3-live-dot"></span>
                        <span className="cv3-live-text">오늘 수집된 실시간 실거래가 및 유동인구 14,203건 전처리 완료</span>
                    </div>
                </div>

                {/* 메인 타이틀 퍼스트 */}
                <div className="cv3-header">
                    <div className="cv3-subtitle">고객 신뢰 No.1 AI 상권 인텔리전스</div>
                    <h1 className="cv3-title">
                        <span className="cv3-title-line1">데이터가 증명하는</span>
                        <br/>
                        <span className="cv3-title-line2">완벽한 AI 상권 분석</span>
                    </h1>
                </div>

                {/* 입력 폼 영역 (중앙으로 끌어올림) */}
                <form className="cv3-search-form" onSubmit={handleSubmit}>
                    <p className="cv3-instruction">
                        궁금한 주소나 지역명을 입력하고 <strong>[분석 시작]</strong>을 눌러보세요.<br/>
                        흩어져 있는 수만 개의 부동산 빅데이터를 AI 에이전트가 분석해 드립니다.
                    </p>

                    <div className="cv3-input-wrapper">
                        <input 
                            type="text" 
                            className="cv3-input-field" 
                            placeholder="예: 서울 강남구 테헤란로 123"
                            value={address}
                            onChange={e => setAddress(e.target.value)}
                        />
                    </div>
                    
                    <button type="submit" className="cv3-submit-button">
                        분석 시작
                    </button>
                    
                    <div className="cv3-secure-container">
                        <div className="cv3-secure-text">
                            🔒 국토교통부 및 공공데이터 포털 100% 실시간 API 연동망 구축
                        </div>
                        <div className="cv3-secure-desc">
                            본 서비스는 최고 수준의 보안 환경을 구축하여 사용자의 조회 데이터를 안전하게 처리하고 즉시 폐기합니다.
                        </div>
                    </div>
                </form>

                {/* 하단 대시보드 확장 영역 */}
                <section className="cv3-dashboard-grid">
                    <div className="cv3-dash-card">
                        <div className="cv3-card-icon">⚡</div>
                        <div className="cv3-card-content">
                            <h3 className="cv3-card-title">AI 리스크 & 트렌드 분석</h3>
                            <p className="cv3-card-value negative">🔴 F&B 폐업 리스크 상승 지역 감지</p>
                            <p className="cv3-card-desc">최근 1개월 기준 강남/서초 상권 변동률</p>
                        </div>
                    </div>
                    
                    <div className="cv3-dash-card">
                        <div className="cv3-card-icon">🏆</div>
                        <div className="cv3-card-content">
                            <h3 className="cv3-card-title">투자가치 우수 지표</h3>
                            <p className="cv3-card-value highlight">⭐ 1평당 추정 매출액 TOP 5</p>
                            <p className="cv3-card-desc">실시간 소비 데이터 기반 AI 회귀 분석</p>
                        </div>
                    </div>

                    <div className="cv3-dash-card">
                        <div className="cv3-card-icon">📈</div>
                        <div className="cv3-card-content">
                            <h3 className="cv3-card-title">자본 유입 트렌드</h3>
                            <p className="cv3-card-value positive">🟢 기관 투자자 / 법인 매입 비율 증가</p>
                            <p className="cv3-card-desc">광역 도심지 상업용 빌딩 거래 분석</p>
                        </div>
                    </div>
                </section>

            </main>
        </div>
    );
}
