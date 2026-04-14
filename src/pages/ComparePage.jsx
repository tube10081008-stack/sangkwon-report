import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || '';

function formatNumber(n) {
    if (!n) return '0';
    if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`;
    if (n >= 10000) return `${Math.round(n / 10000).toLocaleString()}만`;
    return n.toLocaleString();
}

function MetricCard({ metric }) {
    const isText = metric.type === 'text';
    const noData = metric.noData;

    if (isText) {
        return (
            <div className="compare-metric-card">
                <div className="compare-metric-header">
                    <span className="compare-metric-icon">{metric.icon}</span>
                    <span className="compare-metric-label">{metric.label}</span>
                </div>
                <div className="compare-metric-source">{metric.source}</div>
                <div className="compare-text-row"><span className="a-label">A</span><span className="compare-text-val">{metric.textA}</span></div>
                <div className="compare-text-row"><span className="b-label">B</span><span className="compare-text-val">{metric.textB}</span></div>
            </div>
        );
    }

    const maxVal = Math.max(metric.a || 1, metric.b || 1);
    const aPct = noData ? 0 : Math.round(((metric.a || 0) / maxVal) * 100);
    const bPct = noData ? 0 : Math.round(((metric.b || 0) / maxVal) * 100);
    const aDisplay = metric.format === 'currency' ? formatNumber(metric.a) : `${(metric.a ?? 0).toLocaleString?.() ?? metric.a}`;
    const bDisplay = metric.format === 'currency' ? formatNumber(metric.b) : `${(metric.b ?? 0).toLocaleString?.() ?? metric.b}`;

    return (
        <div className={`compare-metric-card ${noData ? 'metric-no-data' : ''}`}>
            <div className="compare-metric-header">
                <span className="compare-metric-icon">{metric.icon}</span>
                <span className="compare-metric-label">{metric.label}</span>
                {metric.estimated && <span className="compare-est-badge">추정</span>}
                {metric.winner && !noData && (
                    <span className={`compare-winner-badge ${metric.winner === 'A' ? 'winner-a' : 'winner-b'}`}>
                        {metric.winner} 우세
                    </span>
                )}
                {!metric.winner && !noData && metric.note && (
                    <span className="compare-note-badge">⚖️ 상대적</span>
                )}
                {noData && <span className="compare-nodata-badge">데이터 없음</span>}
            </div>
            <div className="compare-metric-source">{metric.source}</div>
            {metric.extraA && (
                <div className="compare-extra-row">
                    <span>A: {metric.extraLabel} <strong>{metric.extraA}</strong></span>
                    <span>B: {metric.extraLabel} <strong>{metric.extraB}</strong></span>
                </div>
            )}
            <div className="compare-bars">
                <div className="compare-bar-row">
                    <span className="compare-bar-label a-label">A</span>
                    <div className="compare-bar-track">
                        <div className={`compare-bar-fill ${metric.winner === 'A' ? 'bar-winner' : metric.lowerIsBetter && metric.winner === 'A' ? 'bar-winner' : 'bar-loser'}`}
                             style={{ width: `${aPct}%` }} />
                    </div>
                    <span className="compare-bar-value">{noData ? '-' : aDisplay}{!noData && metric.unit !== '원' ? metric.unit : ''}</span>
                </div>
                <div className="compare-bar-row">
                    <span className="compare-bar-label b-label">B</span>
                    <div className="compare-bar-track">
                        <div className={`compare-bar-fill ${metric.winner === 'B' ? 'bar-winner' : 'bar-loser'}`}
                             style={{ width: `${bPct}%` }} />
                    </div>
                    <span className="compare-bar-value">{noData ? '-' : bDisplay}{!noData && metric.unit !== '원' ? metric.unit : ''}</span>
                </div>
            </div>
            {metric.note && <div className="compare-metric-note">💡 {metric.note}</div>}
            {metric.type === 'textWithBar' && (
                <div className="compare-metric-detail">
                    <span>🚉 A: {metric.textA}</span>
                    <span>🚉 B: {metric.textB}</span>
                </div>
            )}
        </div>
    );
}

export default function ComparePage() {
    const location = useLocation();
    const navigate = useNavigate();
    
    // 이관된 주소 및 반경 정보가 있으면 자동 할당
    const presetAddressA = location.state?.presetAddressA || '';
    const presetRadius = location.state?.radius || 500;

    const [address1, setAddress1] = useState(presetAddressA);
    const [address2, setAddress2] = useState('');
    const [radius, setRadius] = useState(presetRadius);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [progress, setProgress] = useState('');

    const runCompare = async () => {
        if (!address1.trim() || !address2.trim()) return;
        setLoading(true); setError(null); setResult(null);
        setProgress('📍 두 주소의 좌표를 확인하고 있습니다...');
        try {
            const steps = [
                '📍 좌표 변환 중...', '🏪 반경 내 상가업소 수집 중 (최대 10,000건)...',
                '📊 서울시 12종 실측 데이터 수집 중...', '🚇 교통 접근성 분석 중...',
                '💰 부동산 실거래가 조회 중...', '👥 배후 인구 데이터 분석 중...',
                '🤖 AI 전문가 비교 분석 생성 중...',
            ];
            let step = 0;
            const iv = setInterval(() => { step = Math.min(step + 1, steps.length - 1); setProgress(steps[step]); }, 4000);
            const res = await fetch(`${API_BASE}/api/analyze/compare`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address1, address2, radius })
            });
            clearInterval(iv);
            if (!res.ok) { const err = await res.json(); throw new Error(err.error || '분석 실패'); }
            setResult((await res.json()).data);
        } catch (e) { setError(e.message); }
        finally { setLoading(false); setProgress(''); }
    };

    const emp = result?.empiricalComparison;
    const ai = result?.aiCompareComment;
    const summary = emp?.summary;

    return (
        <div className="b2b-hub-container compare-page">
            <header className="b2b-hub-header" style={{ marginBottom: '24px' }}>
                <div className="b2b-header-brand" style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
                    <span className="b2b-brand-logo">STANBY LAB</span>
                    <span className="b2b-brand-vertical-line"></span>
                    <span className="b2b-brand-subtitle">EXECUTIVE COMMAND CENTER</span>
                </div>
                <div className="b2b-header-status">
                    <div style={{ color: '#D4AF37', fontWeight: 700, fontSize: '14px', border: '1px solid #D4AF37', padding: '6px 12px', borderRadius: '8px', background: 'rgba(212,175,55,0.05)' }}>
                        CHIEF EVALUATOR : MARI
                    </div>
                </div>
            </header>

            <section className="b2b-hero-section" style={{ padding: '0 48px', marginBottom: '40px', textAlign: 'center' }}>
                <h1 className="b2b-hero-title" style={{ fontSize: '32px', marginBottom: '12px' }}>
                    <span className="text-gold">핀포인트 자산 비교 비평</span>
                </h1>
                <p className="compare-subtitle b2b-hero-desc" style={{ margin: '0 auto' }}>
                    수석 비평관 마리(Mari)가 실증 데이터를 바탕으로 두 매물의 우위를 저울질합니다.<br/>
                    {emp ? `분석 완료: 총 ${summary.totalMetrics}개 지표 검증됨` : '비교할 두 매물의 주소를 입력하세요.'}
                </p>
            </section>

            <section className="compare-input-section" style={{ padding: '0 20px' }}>
                <div className="compare-input-grid">
                    <div className="compare-input-card input-a" style={{ background: 'rgba(30, 41, 59, 0.4)', borderColor: 'rgba(255,255,255,0.1)' }}>
                        <div className="compare-input-badge" style={{ background: '#06b6d4', color: '#fff' }}>A 매물</div>
                        <input type="text" placeholder="예: 서울 강남구 테헤란로 152"
                            value={address1} onChange={e => setAddress1(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && runCompare()} 
                            style={{ color: '#fff' }} />
                    </div>
                    
                    <div className="compare-vs-circle" style={{ background: '#0a0f18', borderColor: '#D4AF37', color: '#D4AF37' }}>VS</div>

                    <div className="compare-input-card input-b" style={{ background: 'rgba(30, 41, 59, 0.4)', borderColor: 'rgba(255,255,255,0.1)' }}>
                        <div className="compare-input-badge" style={{ background: '#f59e0b', color: '#1a1a2e' }}>B 매물</div>
                        <input type="text" placeholder="예: 서울 서초구 서초대로 231"
                            value={address2} onChange={e => setAddress2(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && runCompare()} 
                            autoFocus={!!presetAddressA}
                            style={{ color: '#fff' }} />
                    </div>
                </div>
                <div className="compare-controls">
                    <select value={radius} onChange={e => setRadius(Number(e.target.value))}>
                        <option value={300}>반경 300m</option>
                        <option value={500}>반경 500m</option>
                        <option value={1000}>반경 1km</option>
                    </select>
                    <button className="compare-btn" onClick={runCompare} disabled={loading || !address1 || !address2}>
                        {loading ? '분석 중...' : '⚡ 비교 분석 시작'}
                    </button>
                </div>
            </section>

            {loading && (
                <div className="compare-loading">
                    <div className="compare-loading-spinner" />
                    <p>{progress}</p>
                    <p className="compare-loading-sub">양쪽 상권의 공공 데이터 · 서울시 API · 교통 · 부동산 · AI를 동시에 수집합니다</p>
                </div>
            )}

            {error && <div className="compare-error">❌ {error}</div>}

            {result && emp && (
                <div className="compare-results">
                    {/* 스코어보드 */}
                    <section className="compare-scoreboard">
                        <div className={`score-side side-a ${summary.overallWinner === 'A' ? 'side-winner' : ''}`}>
                            <div className="score-badge">A 매물</div>
                            <div className="score-address">{result.area1.location.address}</div>
                            <div className="score-wins">{summary.aWins}</div>
                            <div className="score-wins-label">지표 우세</div>
                        </div>
                        <div className="score-center">
                            <div className="score-vs">VS</div>
                            <div className="score-total">{summary.totalMetrics}개 지표 비교</div>
                            {summary.overallWinner !== 'DRAW' ? (
                                <div className="score-verdict">🏆 {summary.overallWinner} 매물 종합 우세</div>
                            ) : (
                                <div className="score-verdict draw">⚖️ 무승부</div>
                            )}
                        </div>
                        <div className={`score-side side-b ${summary.overallWinner === 'B' ? 'side-winner' : ''}`}>
                            <div className="score-badge">B 매물</div>
                            <div className="score-address">{result.area2.location.address}</div>
                            <div className="score-wins">{summary.bWins}</div>
                            <div className="score-wins-label">지표 우세</div>
                        </div>
                    </section>

                    {/* AI 비교 코멘트 */}
                    {ai && (
                        <section className="compare-ai-section">
                            <h2>🧠 AI 전문가 입지 비교 분석</h2>
                            <div className="compare-ai-verdict">{ai.verdict}</div>
                            <div className="compare-ai-grid">
                                <div className="compare-ai-card ai-a">
                                    <h3>📍 A 매물의 강점</h3>
                                    <ul>{ai.aStrengths?.map((s, i) => <li key={i}>{s.replace(/\*\*/g, '')}</li>)}</ul>
                                </div>
                                <div className="compare-ai-card ai-b">
                                    <h3>📍 B 매물의 강점</h3>
                                    <ul>{ai.bStrengths?.map((s, i) => <li key={i}>{s.replace(/\*\*/g, '')}</li>)}</ul>
                                </div>
                            </div>
                            {ai.targetGuide && (
                                <div className="compare-ai-guide">
                                    <strong>🎯 업종별 선택 가이드</strong>
                                    <ul>
                                        {Array.isArray(ai.targetGuide)
                                            ? ai.targetGuide.map((g, i) => <li key={i}>{g.replace(/\*\*/g, '')}</li>)
                                            : <li>{ai.targetGuide.replace(/\*\*/g, '')}</li>}
                                    </ul>
                                </div>
                            )}
                            {ai.riskFactors && (
                                <div className="compare-ai-risk">
                                    <strong>⚠️ 매물 리스크 요인</strong>
                                    <ul>
                                        {Array.isArray(ai.riskFactors)
                                            ? ai.riskFactors.map((r, i) => <li key={i}>{r.replace(/\*\*/g, '')}</li>)
                                            : <li>{ai.riskFactors.replace(/\*\*/g, '')}</li>}
                                    </ul>
                                </div>
                            )}
                        </section>
                    )}

                    {/* 카테고리별 실증 지표 */}
                    {emp.categories.map((cat, ci) => (
                        <section key={ci} className="compare-metrics-section">
                            <h2>{cat.title} <span className="cat-count">({cat.metrics.length}개 지표)</span></h2>
                            <div className="compare-metrics-grid">
                                {cat.metrics.map(m => <MetricCard key={m.id} metric={m} />)}
                            </div>
                        </section>
                    ))}
                </div>
            )}
        </div>
    );
}
