import SingleReport from './SingleReport';

export default function StrategyReport({ data, targetCategory }) {
    const { location, analysis, aiComments, strategy, radius } = data;
    const { grade, overallScore } = analysis;

    return (
        <>
            {/* 기본 상권 분석 (SingleReport 재사용) */}
            <SingleReport data={data} />

            {/* === 필승전략 가이드 섹션 시작 === */}
            <div className="report-section" style={{ borderTop: '4px solid #6366f1' }}>
                <div className="section-header">
                    <div className="section-number" style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}>★</div>
                    <h2>🎯 {targetCategory} 필승전략 가이드</h2>
                </div>

                {/* 시장 진입 판단 */}
                <div className={`verdict ${strategy.marketEntry.verdict === '추천' ? 'recommend' : strategy.marketEntry.verdict === '조건부 추천' ? 'conditional' : 'caution'}`}>
                    <div className="verdict-icon">{strategy.marketEntry.icon}</div>
                    <div className="verdict-text">
                        <h3>시장 진입 판단: {strategy.marketEntry.verdict}</h3>
                        <p>{strategy.marketEntry.text}</p>
                    </div>
                </div>
            </div>

            {/* 타겟 고객 프로파일 */}
            <div className="report-section">
                <div className="section-header">
                    <div className="section-number" style={{ background: 'linear-gradient(135deg, #3b82f6, #06b6d4)' }}>👥</div>
                    <h2>👥 타겟 고객 프로파일</h2>
                </div>
                <div className="strategy-items">
                    {strategy.targetCustomer.map((tc, i) => (
                        <div className="strategy-item" key={i}>
                            <strong>{tc.segment}</strong>
                            <p style={{ margin: '4px 0', color: '#475569' }}>{tc.description}</p>
                            <p style={{ color: '#6366f1', fontWeight: 500, fontSize: '13px' }}>💡 전략: {tc.strategy}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* 포지셔닝 전략 */}
            <div className="report-section">
                <div className="section-header">
                    <div className="section-number" style={{ background: 'linear-gradient(135deg, #8b5cf6, #ec4899)' }}>🏆</div>
                    <h2>🏆 포지셔닝 전략</h2>
                </div>
                {strategy.positioning.map((pos, i) => (
                    <div className="strategy-section" key={i}>
                        <h3>📌 {pos.title}</h3>
                        <div className="strategy-items">
                            {pos.items.map((item, j) => (
                                <div className="strategy-item" key={j}>{item}</div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* 경쟁 전략 */}
            <div className="report-section">
                <div className="section-header">
                    <div className="section-number" style={{ background: 'linear-gradient(135deg, #ef4444, #f59e0b)' }}>⚔️</div>
                    <h2>⚔️ 경쟁 전략</h2>
                </div>
                <div className="strategy-items">
                    {strategy.competitiveStrategy.map((cs, i) => (
                        <div className="strategy-item" key={i}>
                            <strong>{cs.type}</strong>
                            <p style={{ margin: '4px 0', color: '#475569' }}>{cs.detail}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* 마케팅 채널 & 전략 */}
            <div className="report-section">
                <div className="section-header">
                    <div className="section-number" style={{ background: 'linear-gradient(135deg, #10b981, #06b6d4)' }}>📣</div>
                    <h2>📣 마케팅 채널 & 전략</h2>
                </div>

                <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px', color: '#334155' }}>🌐 온라인 마케팅</h4>
                <table className="marketing-table">
                    <thead>
                        <tr><th>채널</th><th>우선순위</th><th>실행 방안</th></tr>
                    </thead>
                    <tbody>
                        {strategy.marketing.online.map((m, i) => (
                            <tr key={i}>
                                <td style={{ fontWeight: 600 }}>{m.channel}</td>
                                <td><span className={`priority-badge ${m.priority === '높음' ? 'high' : 'medium'}`}>{m.priority}</span></td>
                                <td>{m.action}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <h4 style={{ fontSize: '15px', fontWeight: 700, margin: '24px 0 12px', color: '#334155' }}>🏪 오프라인 마케팅</h4>
                <table className="marketing-table">
                    <thead>
                        <tr><th>채널</th><th>우선순위</th><th>실행 방안</th></tr>
                    </thead>
                    <tbody>
                        {strategy.marketing.offline.map((m, i) => (
                            <tr key={i}>
                                <td style={{ fontWeight: 600 }}>{m.channel}</td>
                                <td><span className={`priority-badge ${m.priority === '높음' ? 'high' : 'medium'}`}>{m.priority}</span></td>
                                <td>{m.action}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* 매출 시나리오 */}
            <div className="report-section">
                <div className="section-header">
                    <div className="section-number" style={{ background: 'linear-gradient(135deg, #f59e0b, #10b981)' }}>💰</div>
                    <h2>💰 매출 시나리오</h2>
                </div>
                <div className="stat-grid">
                    <div className="stat-card" style={{ borderLeft: '4px solid #ef4444' }}>
                        <div className="stat-label">{strategy.revenueScenarios.conservative.label}</div>
                        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>{strategy.revenueScenarios.conservative.description}</div>
                        <div style={{ fontSize: '14px', color: '#ef4444', fontWeight: 600, marginTop: '8px' }}>예상: {strategy.revenueScenarios.conservative.factor} 수준</div>
                    </div>
                    <div className="stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
                        <div className="stat-label">{strategy.revenueScenarios.base.label}</div>
                        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>{strategy.revenueScenarios.base.description}</div>
                        <div style={{ fontSize: '14px', color: '#3b82f6', fontWeight: 600, marginTop: '8px' }}>예상: {strategy.revenueScenarios.base.factor} 수준</div>
                    </div>
                    <div className="stat-card" style={{ borderLeft: '4px solid #22c55e' }}>
                        <div className="stat-label">{strategy.revenueScenarios.optimistic.label}</div>
                        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>{strategy.revenueScenarios.optimistic.description}</div>
                        <div style={{ fontSize: '14px', color: '#22c55e', fontWeight: 600, marginTop: '8px' }}>예상: {strategy.revenueScenarios.optimistic.factor} 수준</div>
                    </div>
                </div>
                <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '12px' }}>{strategy.revenueScenarios.note}</p>
            </div>

            {/* 리스크 분석 */}
            <div className="report-section">
                <div className="section-header">
                    <div className="section-number" style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>⚠️</div>
                    <h2>⚠️ 리스크 분석 & 대응 전략</h2>
                </div>
                <table className="risk-table">
                    <thead>
                        <tr><th>리스크</th><th>위험도</th><th>대응 전략</th></tr>
                    </thead>
                    <tbody>
                        {strategy.riskAnalysis.map((r, i) => (
                            <tr key={i}>
                                <td style={{ fontWeight: 600 }}>{r.risk}</td>
                                <td><span className={`risk-level ${r.level === '높음' ? 'high' : r.level === '중간' ? 'medium' : 'low'}`}>{r.level}</span></td>
                                <td>{r.mitigation}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* 오픈 전 체크리스트 */}
            <div className="report-section">
                <div className="section-header">
                    <div className="section-number" style={{ background: 'linear-gradient(135deg, #22c55e, #10b981)' }}>📅</div>
                    <h2>📅 오픈 전 체크리스트 & 타임라인</h2>
                </div>
                <div className="timeline">
                    {strategy.checklist.map((phase, i) => (
                        <div className="timeline-item" key={i}>
                            <h4>{phase.phase}</h4>
                            <ul>
                                {phase.items.map((item, j) => <li key={j}>{item}</li>)}
                            </ul>
                        </div>
                    ))}
                </div>
            </div>

            {/* 최종 종합 조언 */}
            <div className="report-section" style={{ borderTop: '4px solid #6366f1' }}>
                <div className="section-header">
                    <div className="section-number" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>🎯</div>
                    <h2>🎯 최종 종합 조언</h2>
                </div>
                <div className="recommendation-box">
                    <p style={{ fontSize: '15px', lineHeight: 1.8, color: '#334155' }}
                        dangerouslySetInnerHTML={{ __html: strategy.finalAdvice.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                </div>
            </div>
        </>
    );
}
