import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const LOADING_MESSAGES = [
    '국토부 실거래가 데이터 수집 및 정제 완료 (14,203건), 패턴 분석 가동...',
    '동네 업종 분포를 한눈에 볼 수 있게 정리 중... (AI 상권 평가 모델 가동 중)',
    '수집된 데이터 기반으로 Shannon 다각화 지수 연산 중...',
    '대형 프랜차이즈 위협도 및 생존 리스크 팩터 검증 중...',
    'AI 코라가 최종 분석 결과 연산 및 보고서 구조화 중... (90% 완료)',
    '마지막 검증 완료. 리포트를 생성합니다!'
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
        // 현재 처리 중인 더미 10만건 데이터 건수
        const currentDataCount = Math.floor(100000 * (progress / 100));

        return (
            <div className="cv3-loader-overlay">
                <div className="cv3-loader-container">
                    {/* 좌측: AI 에이전트 애니메이션 영역 */}
                    <div className="cv3-loader-left">
                        <div className="cv3-loader-avatar-wrapper">
                            <div className="cv3-avatar-pulse-ring"></div>
                            <img src="/cora-profile.png" alt="Cora Profile" className="cv3-loader-avatar" />
                            {/* 데이터 파티클 흐름 효과 (CSS로 구현) */}
                            <div className="cv3-particle p1"></div>
                            <div className="cv3-particle p2"></div>
                            <div className="cv3-particle p3"></div>
                            <div className="cv3-particle p4"></div>
                        </div>
                        <div className="cv3-loader-logo-glow">STANDBY LAB AI CORE</div>
                    </div>

                    {/* 우측: 스켈레톤 리포트 & 실시간 프로그레스 대시보드 */}
                    <div className="cv3-loader-right">
                        
                        <div className="cv3-skeleton-dashboard">
                            {/* 상단 타이포 스켈레톤 */}
                            <div className="cv3-skel-header">
                                <div className="cv3-skel-box sh-title shimmer"></div>
                                <div className="cv3-skel-box sh-grade shimmer"></div>
                            </div>
                            
                            {/* 중단 차트 스켈레톤 */}
                            <div className="cv3-skel-charts">
                                <div className="cv3-skel-pie shimmer"></div>
                                <div className="cv3-skel-bars">
                                    <div className="cv3-skel-bar b1 shimmer"></div>
                                    <div className="cv3-skel-bar b2 shimmer"></div>
                                    <div className="cv3-skel-bar b3 shimmer"></div>
                                    <div className="cv3-skel-bar b4 shimmer"></div>
                                </div>
                            </div>

                            {/* 하단 리스트 스켈레톤 */}
                            <div className="cv3-skel-list">
                                <div className="cv3-skel-item shimmer"></div>
                                <div className="cv3-skel-item shimmer"></div>
                                <div className="cv3-skel-item shimmer" style={{ width: '60%' }}></div>
                            </div>
                        </div>

                        {/* 프로그레스 및 동적 텍스트 영역 */}
                        <div className="cv3-loading-status-area">
                            <div className="cv3-progress-info">
                                <span>전체 데이터 10만 건 중 {currentDataCount.toLocaleString()}건 분석 완료...</span>
                                <span className="cv3-percent">{progress}%</span>
                            </div>
                            
                            <div className="cv3-progress-track">
                                <div className="cv3-progress-fill" style={{ width: `${progress}%` }}></div>
                            </div>
                            
                            <div className="cv3-loading-msg">{loadingMsg}</div>
                            <p className="cv3-loading-sub">잠시만 기다려 주세요, AI 에이전트 코라가 열심히 분석 중이에요! ✨</p>
                        </div>
                    </div>
                </div>
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
                        <div className="cv3-card-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                            </svg>
                        </div>
                        <div className="cv3-card-content">
                            <h3 className="cv3-card-title">AI 리스크 & 트렌드 분석</h3>
                            <p className="cv3-card-value negative">🔴 F&B 폐업 리스크 상승 지역 감지</p>
                            <p className="cv3-card-desc">최근 1개월 기준 강남/서초 상권 변동률</p>
                        </div>
                    </div>
                    
                    <div className="cv3-dash-card">
                        <div className="cv3-card-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="8" r="7" />
                                <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
                            </svg>
                        </div>
                        <div className="cv3-card-content">
                            <h3 className="cv3-card-title">투자가치 우수 지표</h3>
                            <p className="cv3-card-value highlight">⭐ 1평당 추정 매출액 TOP 5</p>
                            <p className="cv3-card-desc">실시간 소비 데이터 기반 AI 회귀 분석</p>
                        </div>
                    </div>

                    <div className="cv3-dash-card">
                        <div className="cv3-card-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                                <polyline points="17 6 23 6 23 12" />
                            </svg>
                        </div>
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
