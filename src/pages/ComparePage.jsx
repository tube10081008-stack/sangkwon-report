import { useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '';

function formatNumber(n) {
    if (!n) return '0';
    if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`;
    if (n >= 10000) return `${(n / 10000).toFixed(0)}만`;
    return n.toLocaleString();
}

function MetricBar({ metric }) {
    const maxVal = Math.max(metric.a || 1, metric.b || 1);
    const aPct = Math.round((metric.a / maxVal) * 100);
    const bPct = Math.round((metric.b / maxVal) * 100);
    const aDisplay = metric.format === 'currency' ? formatNumber(metric.a) : `${metric.a?.toLocaleString?.() || metric.a}`;
    const bDisplay = metric.format === 'currency' ? formatNumber(metric.b) : `${metric.b?.toLocaleString?.() || metric.b}`;

    return (
        <div className="compare-metric-card">
            <div className="compare-metric-header">
                <span className="compare-metric-icon">{metric.icon}</span>
                <span className="compare-metric-label">{metric.label}</span>
                {metric.winner && (
                    <span className={`compare-winner-badge ${metric.winner === 'A' ? 'winner-a' : 'winner-b'}`}>
                        {metric.winner} 우세 {metric.diff ? `(+${metric.diff}%)` : ''}
                    </span>
                )}
                {!metric.winner && metric.note && (
                    <span className="compare-note-badge">⚖️ 상대적</span>
                )}
            </div>
            <div className="compare-metric-source">{metric.source}</div>
            <div className="compare-bars">
                <div className="compare-bar-row">
                    <span className="compare-bar-label a-label">A</span>
                    <div className="compare-bar-track">
                        <div className={`compare-bar-fill ${metric.winner === 'A' ? 'bar-winner' : 'bar-loser'}`}
                             style={{ width: `${aPct}%` }} />
                    </div>
                    <span className="compare-bar-value">{aDisplay}{metric.unit !== '원' ? metric.unit : ''}</span>
                </div>
                <div className="compare-bar-row">
                    <span className="compare-bar-label b-label">B</span>
                    <div className="compare-bar-track">
                        <div className={`compare-bar-fill ${metric.winner === 'B' ? 'bar-winner' : 'bar-loser'}`}
                             style={{ width: `${bPct}%` }} />
                    </div>
                    <span className="compare-bar-value">{bDisplay}{metric.unit !== '원' ? metric.unit : ''}</span>
                </div>
            </div>
            {metric.detail && metric.id === 'transit_score' && (
                <div className="compare-metric-detail">
                    <span>🚉 A 최근접: {metric.detail.aNearestSubway} ({metric.detail.aNearestDist}m)</span>
                    <span>🚉 B 최근접: {metric.detail.bNearestSubway} ({metric.detail.bNearestDist}m)</span>
                </div>
            )}
        </div>
    );
}

export default function ComparePage() {
    const [address1, setAddress1] = useState('');
    const [address2, setAddress2] = useState('');
    const [radius, setRadius] = useState(500);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [progress, setProgress] = useState('');

    const runCompare = async () => {
        if (!address1.trim() || !address2.trim()) return;
        setLoading(true);
        setError(null);
        setResult(null);
        setProgress('📍 두 주소의 좌표를 확인하고 있습니다...');

        try {
            const progressSteps = [
                '📍 좌표 변환 중...',
                '🏪 반경 내 상가업소 수집 중...',
                '📊 서울시 12종 실측 데이터 수집 중...',
                '🚇 교통 접근성 분석 중...',
                '💰 부동산 실거래가 조회 중...',
                '🤖 AI 비교 분석 생성 중...',
            ];
            let step = 0;
            const interval = setInterval(() => {
                step = Math.min(step + 1, progressSteps.length - 1);
                setProgress(progressSteps[step]);
            }, 3000);

            const res = await fetch(`${API_BASE}/api/analyze/compare`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address1, address2, radius })
            });
            clearInterval(interval);

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || '분석 실패');
            }
            const json = await res.json();
            setResult(json.data);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
            setProgress('');
        }
    };

    const emp = result?.empiricalComparison;
    const ai = result?.aiCompareComment;
    const summary = emp?.summary;

    return (
        <div className="compare-page">
            {/* 헤더 */}
            <header className="compare-header">
                <a href="/" className="compare-back">← 홈</a>
                <h1>⚔️ 매물 비교 분석기</h1>
                <p className="compare-subtitle">실증 데이터 기반 A vs B 상권 비교</p>
            </header>

            {/* 입력 섹션 */}
            <section className="compare-input-section">
                <div className="compare-input-grid">
                    <div className="compare-input-card input-a">
                        <div className="compare-input-badge">A 매물</div>
                        <input
                            type="text" placeholder="주소 입력 (예: 서울 강남구 테헤란로 152)"
                            value={address1} onChange={e => setAddress1(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && runCompare()}
                        />
                    </div>
                    <div className="compare-vs-circle">VS</div>
                    <div className="compare-input-card input-b">
                        <div className="compare-input-badge">B 매물</div>
                        <input
                            type="text" placeholder="주소 입력 (예: 서울 서초구 서초대로 231)"
                            value={address2} onChange={e => setAddress2(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && runCompare()}
                        />
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

            {/* 로딩 */}
            {loading && (
                <div className="compare-loading">
                    <div className="compare-loading-spinner" />
                    <p>{progress}</p>
                    <p className="compare-loading-sub">서울시 12종 API + 교통 + 부동산 데이터를 동시에 수집합니다</p>
                </div>
            )}

            {/* 에러 */}
            {error && <div className="compare-error">❌ {error}</div>}

            {/* 결과 */}
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
                            {summary.overallWinner !== 'DRAW' && (
                                <div className="score-verdict">🏆 {summary.overallWinner} 매물 종합 우세</div>
                            )}
                            {summary.overallWinner === 'DRAW' && (
                                <div className="score-verdict">⚖️ 무승부 — 업종에 따라 판단 필요</div>
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
                            <h2>🧠 AI 전문가 비교 분석</h2>
                            <div className="compare-ai-verdict">{ai.verdict}</div>
                            <div className="compare-ai-grid">
                                <div className="compare-ai-card ai-a">
                                    <h3>📍 A 매물의 강점</h3>
                                    <ul>{ai.aStrengths?.map((s, i) => <li key={i}>{s}</li>)}</ul>
                                </div>
                                <div className="compare-ai-card ai-b">
                                    <h3>📍 B 매물의 강점</h3>
                                    <ul>{ai.bStrengths?.map((s, i) => <li key={i}>{s}</li>)}</ul>
                                </div>
                            </div>
                            {ai.targetGuide && (
                                <div className="compare-ai-guide">
                                    <strong>🎯 업종별 선택 가이드:</strong> {ai.targetGuide}
                                </div>
                            )}
                        </section>
                    )}

                    {/* 실증 지표 카드 그리드 */}
                    <section className="compare-metrics-section">
                        <h2>📊 실증 데이터 비교 ({emp.metrics.length}개 지표)</h2>
                        <div className="compare-metrics-grid">
                            {emp.metrics.map(m => <MetricBar key={m.id} metric={m} />)}
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}
