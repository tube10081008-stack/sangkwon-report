import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = '/api/agent';

export default function AgentDashboard() {
    const [status, setStatus] = useState(null);
    const [history, setHistory] = useState([]);
    const [districts, setDistricts] = useState([]);
    const [selectedDetail, setSelectedDetail] = useState(null);
    const [isRunning, setIsRunning] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');
    const [selectedDistrict, setSelectedDistrict] = useState('');
    const [refreshKey, setRefreshKey] = useState(0);

    const fetchStatus = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/status`);
            const data = await res.json();
            if (data.success) setStatus(data.data);
        } catch (e) { console.error('상태 조회 실패:', e); }
    }, []);

    const fetchHistory = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/history?limit=50`);
            const data = await res.json();
            if (data.success) setHistory(data.data);
        } catch (e) { console.error('히스토리 조회 실패:', e); }
    }, []);

    const fetchDistricts = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/districts`);
            const data = await res.json();
            if (data.success) setDistricts(data.data);
        } catch (e) { console.error('구 목록 조회 실패:', e); }
    }, []);

    useEffect(() => {
        fetchStatus();
        fetchHistory();
        fetchDistricts();
    }, [refreshKey]);

    // 자동 폴링 (루프 실행 중일 때)
    useEffect(() => {
        if (!isRunning) return;
        const interval = setInterval(() => {
            fetchStatus();
            fetchHistory();
        }, 5000);
        return () => clearInterval(interval);
    }, [isRunning]);

    const startLoop = async (district) => {
        setIsRunning(true);
        try {
            const res = await fetch(`${API_BASE}/run-loop`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ district: district || undefined })
            });
            const data = await res.json();
            if (!data.success && data.error) {
                alert(data.error);
            }
        } catch (e) {
            alert('루프 실행 실패: ' + e.message);
        }
    };

    const loadDetail = async (filename) => {
        try {
            const res = await fetch(`${API_BASE}/history/${filename}`);
            const data = await res.json();
            if (data.success) {
                setSelectedDetail(data.data);
                setActiveTab('detail');
            }
        } catch (e) { console.error('상세 조회 실패:', e); }
    };

    const refresh = () => setRefreshKey(k => k + 1);

    return (
        <div style={styles.container}>
            {/* 헤더 */}
            <header style={styles.header}>
                <div style={styles.headerLeft}>
                    <div style={styles.headerIcon}>🔄</div>
                    <div>
                        <h1 style={styles.title}>AI 에이전트 루프 대시보드</h1>
                        <p style={styles.subtitle}>상권 분석 서비스 자동 검증 시스템</p>
                    </div>
                </div>
                <div style={styles.headerActions}>
                    <button onClick={refresh} style={styles.refreshBtn}>🔄 새로고침</button>
                    <a href="/start-analysis" style={styles.backLink}>← 상권 분석으로</a>
                </div>
            </header>

            {/* 탭 네비게이션 */}
            <nav style={styles.tabNav}>
                {['overview', 'history', 'districts', 'detail'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            ...styles.tabBtn,
                            ...(activeTab === tab ? styles.tabBtnActive : {})
                        }}
                    >
                        {tab === 'overview' && '📊 전체 현황'}
                        {tab === 'history' && '📋 루프 히스토리'}
                        {tab === 'districts' && '🗺️ 구별 관리'}
                        {tab === 'detail' && '🔍 상세 보기'}
                    </button>
                ))}
            </nav>

            {/* 탭 컨텐츠 */}
            <main style={styles.main}>
                {activeTab === 'overview' && <OverviewTab status={status} isRunning={isRunning} startLoop={startLoop} selectedDistrict={selectedDistrict} setSelectedDistrict={setSelectedDistrict} districts={districts} history={history} />}
                {activeTab === 'history' && <HistoryTab history={history} loadDetail={loadDetail} />}
                {activeTab === 'districts' && <DistrictsTab districts={districts} startLoop={startLoop} history={history} />}
                {activeTab === 'detail' && <DetailTab detail={selectedDetail} />}
            </main>
        </div>
    );
}

/* ===== 탭 컴포넌트들 ===== */

function OverviewTab({ status, isRunning, startLoop, selectedDistrict, setSelectedDistrict, districts, history }) {
    const stats = status?.stats;
    const currentLoop = status?.currentLoop;

    return (
        <div>
            {/* 통계 카드 */}
            <div style={styles.statsGrid}>
                <StatCard icon="🔄" label="총 루프 실행" value={stats?.totalLoops || 0} color="#6366f1" />
                <StatCard icon="🔍" label="총 발견 이슈" value={stats?.totalIssues || 0} color="#f59e0b" />
                <StatCard icon="🛠️" label="자동 수정" value={stats?.totalAutoFixed || 0} color="#22c55e" />
                <StatCard icon="👨‍💻" label="수동 검토" value={stats?.totalManualReview || 0} color="#ef4444" />
                <StatCard icon="🗺️" label="검증 완료 구" value={`${stats?.districtsVerified || 0}/25`} color="#8b5cf6" />
                <StatCard icon="✅" label="성공률" value={stats?.successRate || '0%'} color="#06b6d4" />
            </div>

            {/* 현재 루프 상태 */}
            {currentLoop && (
                <div style={{ ...styles.card, border: '2px solid #6366f1', marginTop: '20px' }}>
                    <div style={styles.cardHeader}>
                        <span style={{ fontSize: '20px' }}>{currentLoop.status === 'running' ? '⏳' : currentLoop.status === 'completed' ? '✅' : '❌'}</span>
                        <h3 style={styles.cardTitle}>현재 루프 상태</h3>
                        <span style={{
                            ...styles.badge,
                            background: currentLoop.status === 'running' ? '#dbeafe' : currentLoop.status === 'completed' ? '#dcfce7' : '#fee2e2',
                            color: currentLoop.status === 'running' ? '#2563eb' : currentLoop.status === 'completed' ? '#16a34a' : '#dc2626'
                        }}>
                            {currentLoop.status === 'running' ? '실행 중' : currentLoop.status === 'completed' ? '완료' : '실패'}
                        </span>
                    </div>
                    <p style={styles.cardText}>
                        <strong>{currentLoop.district}</strong> 지역
                        {currentLoop.result && ` — 이슈 ${currentLoop.result.totalIssues}건, 자동수정 ${currentLoop.result.autoFixed}건 (${currentLoop.result.elapsedSeconds}초)`}
                    </p>
                </div>
            )}

            {/* 루프 실행 패널 */}
            <div style={{ ...styles.card, marginTop: '20px', background: 'linear-gradient(135deg, #1e1b4b, #312e81)' }}>
                <h3 style={{ ...styles.cardTitle, color: '#e0e7ff' }}>🚀 루프 실행</h3>
                <p style={{ color: '#c7d2fe', fontSize: '14px', marginBottom: '16px' }}>
                    오늘의 검증 대상: <strong style={{ color: '#a5b4fc' }}>{status?.todayDistrict || '로딩 중...'}</strong>
                </p>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <select
                        value={selectedDistrict}
                        onChange={e => setSelectedDistrict(e.target.value)}
                        style={styles.select}
                    >
                        <option value="">오늘의 구 (자동)</option>
                        {districts.map(d => (
                            <option key={d.name} value={d.name}>{d.name} ({d.addressCount}개 주소)</option>
                        ))}
                    </select>
                    <button
                        onClick={() => startLoop(selectedDistrict)}
                        disabled={isRunning}
                        style={{
                            ...styles.primaryBtn,
                            opacity: isRunning ? 0.5 : 1,
                            cursor: isRunning ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {isRunning ? '⏳ 실행 중...' : '▶️ 루프 시작'}
                    </button>
                </div>
            </div>

            {/* 최근 루프 요약 */}
            <div style={{ ...styles.card, marginTop: '20px' }}>
                <h3 style={styles.cardTitle}>📋 최근 루프 결과 (최근 5건)</h3>
                {history.slice(0, 5).map((item, idx) => (
                    <div key={idx} style={styles.historyItem}>
                        <div style={styles.historyLeft}>
                            <span style={{ fontSize: '18px' }}>{item.status === 'completed' ? '✅' : item.status === 'failed' ? '❌' : '⏳'}</span>
                            <div>
                                <strong>{item.district}</strong>
                                <span style={{ color: '#94a3b8', fontSize: '13px', marginLeft: '8px' }}>
                                    {item.timestamp ? new Date(item.timestamp).toLocaleDateString('ko-KR') : ''}
                                </span>
                            </div>
                        </div>
                        <div style={styles.historyRight}>
                            <span style={styles.miniTag}>이슈 {item.totalIssues || 0}</span>
                            <span style={{ ...styles.miniTag, background: '#dcfce7', color: '#16a34a' }}>수정 {item.autoFixed || 0}</span>
                        </div>
                    </div>
                ))}
                {history.length === 0 && <p style={{ color: '#94a3b8', textAlign: 'center', padding: '20px' }}>아직 실행된 루프가 없습니다.</p>}
            </div>
        </div>
    );
}

function HistoryTab({ history, loadDetail }) {
    return (
        <div style={styles.card}>
            <h3 style={styles.cardTitle}>📋 전체 루프 히스토리</h3>
            <div style={styles.table}>
                <div style={styles.tableHeader}>
                    <span style={{ flex: 0.5 }}>#</span>
                    <span style={{ flex: 1 }}>지역</span>
                    <span style={{ flex: 1.5 }}>일시</span>
                    <span style={{ flex: 0.5 }}>상태</span>
                    <span style={{ flex: 0.5 }}>이슈</span>
                    <span style={{ flex: 0.5 }}>수정</span>
                    <span style={{ flex: 0.5 }}>검토</span>
                    <span style={{ flex: 0.5 }}>시간</span>
                    <span style={{ flex: 0.5 }}>액션</span>
                </div>
                {history.map((item, idx) => (
                    <div key={idx} style={styles.tableRow}>
                        <span style={{ flex: 0.5, fontWeight: 700, color: '#6366f1' }}>#{item.loopNumber || idx + 1}</span>
                        <span style={{ flex: 1 }}>{item.district}</span>
                        <span style={{ flex: 1.5, fontSize: '13px', color: '#64748b' }}>
                            {item.timestamp ? new Date(item.timestamp).toLocaleString('ko-KR') : '-'}
                        </span>
                        <span style={{ flex: 0.5 }}>
                            {item.status === 'completed' ? '✅' : item.status === 'failed' ? '❌' : '⏳'}
                        </span>
                        <span style={{ flex: 0.5, fontWeight: 600, color: item.totalIssues > 10 ? '#ef4444' : '#334155' }}>{item.totalIssues || 0}</span>
                        <span style={{ flex: 0.5, color: '#22c55e', fontWeight: 600 }}>{item.autoFixed || 0}</span>
                        <span style={{ flex: 0.5, color: '#f59e0b', fontWeight: 600 }}>{item.manualReview || 0}</span>
                        <span style={{ flex: 0.5, fontSize: '13px' }}>{item.elapsedSeconds ? `${item.elapsedSeconds}s` : '-'}</span>
                        <span style={{ flex: 0.5 }}>
                            <button onClick={() => loadDetail(item.filename)} style={styles.detailBtn}>상세</button>
                        </span>
                    </div>
                ))}
            </div>
            {history.length === 0 && <p style={{ color: '#94a3b8', textAlign: 'center', padding: '40px' }}>실행 기록이 없습니다.</p>}
        </div>
    );
}

function DistrictsTab({ districts, startLoop, history }) {
    const districtStats = {};
    history.forEach(h => {
        if (!districtStats[h.district]) districtStats[h.district] = { runs: 0, lastRun: null };
        districtStats[h.district].runs++;
        if (!districtStats[h.district].lastRun || h.timestamp > districtStats[h.district].lastRun) {
            districtStats[h.district].lastRun = h.timestamp;
        }
    });

    return (
        <div>
            <div style={styles.districtGrid}>
                {districts.map((d, idx) => {
                    const stat = districtStats[d.name];
                    return (
                        <div key={idx} style={styles.districtCard}>
                            <div style={styles.districtHeader}>
                                <h4 style={styles.districtName}>{d.name}</h4>
                                {stat ? (
                                    <span style={{ ...styles.badge, background: '#dcfce7', color: '#16a34a' }}>
                                        {stat.runs}회 검증
                                    </span>
                                ) : (
                                    <span style={{ ...styles.badge, background: '#fef3c7', color: '#d97706' }}>
                                        미검증
                                    </span>
                                )}
                            </div>
                            <p style={{ fontSize: '13px', color: '#64748b', margin: '8px 0' }}>
                                {d.addressCount}개 테스트 주소
                            </p>
                            <div style={{ fontSize: '12px', color: '#94a3b8', maxHeight: '80px', overflow: 'hidden' }}>
                                {d.addresses.slice(0, 3).map((a, i) => (
                                    <div key={i}>📍 {a}</div>
                                ))}
                                {d.addressCount > 3 && <div>... +{d.addressCount - 3}개</div>}
                            </div>
                            {stat?.lastRun && (
                                <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '8px' }}>
                                    마지막: {new Date(stat.lastRun).toLocaleDateString('ko-KR')}
                                </p>
                            )}
                            <button
                                onClick={() => startLoop(d.name)}
                                style={{ ...styles.smallBtn, marginTop: '12px' }}
                            >
                                ▶️ 이 구 검증
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function DetailTab({ detail }) {
    if (!detail) {
        return (
            <div style={{ ...styles.card, textAlign: 'center', padding: '60px' }}>
                <p style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</p>
                <p style={{ color: '#94a3b8' }}>히스토리에서 항목을 선택하면 상세 내용이 표시됩니다.</p>
            </div>
        );
    }

    const { inspectionReport, improvementPlan, autoFixResult } = detail;

    return (
        <div>
            {/* 루프 요약 */}
            <div style={styles.card}>
                <h3 style={styles.cardTitle}>루프 #{detail.loopNumber} — {detail.district}</h3>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', margin: '12px 0' }}>
                    <span style={styles.miniTag}>⏱️ {detail.elapsedSeconds}초</span>
                    <span style={{ ...styles.miniTag, background: detail.status === 'completed' ? '#dcfce7' : '#fee2e2', color: detail.status === 'completed' ? '#16a34a' : '#dc2626' }}>
                        {detail.status === 'completed' ? '✅ 성공' : '❌ 실패'}
                    </span>
                </div>
            </div>

            {/* Steps */}
            {detail.steps && (
                <div style={{ ...styles.card, marginTop: '16px' }}>
                    <h4 style={{ ...styles.cardTitle, fontSize: '15px' }}>📌 실행 단계</h4>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
                        {detail.steps.map((step, idx) => (
                            <div key={idx} style={styles.stepCard}>
                                <span style={{ fontSize: '20px' }}>{step.status === 'completed' ? '✅' : step.status === 'running' ? '⏳' : '❌'}</span>
                                <strong style={{ fontSize: '14px' }}>{step.name}</strong>
                                {step.issuesFound != null && <span style={{ fontSize: '12px', color: '#64748b' }}>이슈 {step.issuesFound}건</span>}
                                {step.applied != null && <span style={{ fontSize: '12px', color: '#22c55e' }}>수정 {step.applied}건</span>}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 이슈 목록 */}
            {inspectionReport?.results && (
                <div style={{ ...styles.card, marginTop: '16px' }}>
                    <h4 style={{ ...styles.cardTitle, fontSize: '15px' }}>🔍 검증 결과 (주소별)</h4>
                    {inspectionReport.results.map((result, idx) => (
                        <div key={idx} style={styles.resultBlock}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <strong>📍 {result.address}</strong>
                                <span style={styles.miniTag}>
                                    {result.analysisSnapshot ? `${result.analysisSnapshot.grade}등급 (${result.analysisSnapshot.overallScore}점)` : '-'}
                                </span>
                            </div>
                            {result.issues && result.issues.length > 0 ? (
                                <div style={{ marginTop: '8px' }}>
                                    {result.issues.map((issue, iIdx) => (
                                        <div key={iIdx} style={styles.issueItem}>
                                            <span style={{ ...styles.severityDot, background: getSeverityColor(issue.severity) }} />
                                            <span style={{ fontSize: '12px', fontWeight: 600, color: getSeverityColor(issue.severity), marginRight: '8px' }}>{issue.severity}</span>
                                            <span style={{ fontSize: '13px', color: '#334155' }}>{issue.description}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p style={{ fontSize: '13px', color: '#22c55e', marginTop: '4px' }}>✅ 이슈 없음</p>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* 개선 제안 */}
            {improvementPlan && (
                <div style={{ ...styles.card, marginTop: '16px' }}>
                    <h4 style={{ ...styles.cardTitle, fontSize: '15px' }}>💡 개선 제안</h4>
                    <p style={{ fontSize: '14px', color: '#475569', marginBottom: '12px', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                        {improvementPlan.summary}
                    </p>
                    {improvementPlan.improvements && improvementPlan.improvements.map((imp, idx) => (
                        <div key={idx} style={{ ...styles.resultBlock, borderLeft: `3px solid ${imp.autoFixable ? '#22c55e' : '#f59e0b'}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                                <strong>{imp.title}</strong>
                                <span style={{
                                    ...styles.badge,
                                    background: imp.autoFixable ? '#dcfce7' : '#fef3c7',
                                    color: imp.autoFixable ? '#16a34a' : '#d97706'
                                }}>
                                    {imp.autoFixable ? '🛠️ 자동수정' : '👨‍💻 수동검토'}
                                </span>
                            </div>
                            <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>{imp.description}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* 자동 수정 결과 */}
            {autoFixResult && autoFixResult.applied && autoFixResult.applied.length > 0 && (
                <div style={{ ...styles.card, marginTop: '16px', border: '1px solid #22c55e' }}>
                    <h4 style={{ ...styles.cardTitle, fontSize: '15px', color: '#16a34a' }}>✅ 자동 수정 완료</h4>
                    {autoFixResult.applied.map((fix, idx) => (
                        <div key={idx} style={styles.resultBlock}>
                            <strong>{fix.type}</strong>
                            <p style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>{fix.message}</p>
                            {fix.addedBrands && (
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                                    {fix.addedBrands.map((b, bIdx) => (
                                        <span key={bIdx} style={{ ...styles.miniTag, background: '#dcfce7', color: '#16a34a' }}>+ {b}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/* ===== 공통 컴포넌트 ===== */

function StatCard({ icon, label, value, color }) {
    return (
        <div style={styles.statCard}>
            <div style={{ ...styles.statIcon, background: `${color}15`, color }}>{icon}</div>
            <div style={styles.statValue}>{value}</div>
            <div style={styles.statLabel}>{label}</div>
        </div>
    );
}

function getSeverityColor(severity) {
    switch (severity) {
        case 'CRITICAL': return '#dc2626';
        case 'HIGH': return '#ea580c';
        case 'MEDIUM': return '#d97706';
        case 'LOW': return '#65a30d';
        default: return '#64748b';
    }
}

/* ===== 스타일 ===== */

const styles = {
    container: {
        minHeight: '100vh',
        background: '#0f172a',
        color: '#e2e8f0',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px 32px',
        borderBottom: '1px solid #1e293b',
        background: 'linear-gradient(135deg, #0f172a, #1e1b4b)',
        flexWrap: 'wrap',
        gap: '12px'
    },
    headerLeft: { display: 'flex', alignItems: 'center', gap: '16px' },
    headerIcon: { fontSize: '36px', animation: 'spin 4s linear infinite' },
    title: { margin: 0, fontSize: '22px', fontWeight: 800, color: '#e0e7ff' },
    subtitle: { margin: 0, fontSize: '13px', color: '#818cf8' },
    headerActions: { display: 'flex', gap: '12px', alignItems: 'center' },
    refreshBtn: {
        padding: '8px 16px', borderRadius: '8px', border: '1px solid #334155',
        background: '#1e293b', color: '#94a3b8', cursor: 'pointer', fontSize: '13px'
    },
    backLink: { color: '#818cf8', textDecoration: 'none', fontSize: '13px' },
    tabNav: {
        display: 'flex', gap: '4px', padding: '12px 32px',
        borderBottom: '1px solid #1e293b', background: '#0f172a'
    },
    tabBtn: {
        padding: '10px 20px', borderRadius: '8px', border: 'none',
        background: 'transparent', color: '#64748b', cursor: 'pointer',
        fontSize: '14px', fontWeight: 600, transition: 'all 0.2s'
    },
    tabBtnActive: {
        background: '#1e293b', color: '#a5b4fc', boxShadow: '0 0 0 1px #6366f1'
    },
    main: { padding: '24px 32px', maxWidth: '1400px', margin: '0 auto' },
    statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' },
    statCard: {
        padding: '20px', borderRadius: '16px', background: '#1e293b',
        border: '1px solid #334155', textAlign: 'center'
    },
    statIcon: {
        width: '48px', height: '48px', borderRadius: '12px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '24px', margin: '0 auto 12px'
    },
    statValue: { fontSize: '28px', fontWeight: 800, color: '#f1f5f9', marginBottom: '4px' },
    statLabel: { fontSize: '13px', color: '#64748b' },
    card: {
        padding: '24px', borderRadius: '16px', background: '#1e293b',
        border: '1px solid #334155'
    },
    cardHeader: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' },
    cardTitle: { margin: 0, fontSize: '17px', fontWeight: 700, color: '#e2e8f0' },
    cardText: { color: '#94a3b8', fontSize: '14px', margin: 0 },
    badge: {
        padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600
    },
    select: {
        padding: '10px 16px', borderRadius: '10px', border: '1px solid #475569',
        background: '#334155', color: '#e2e8f0', fontSize: '14px', minWidth: '220px'
    },
    primaryBtn: {
        padding: '12px 28px', borderRadius: '12px', border: 'none',
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        color: 'white', fontWeight: 700, fontSize: '15px', cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)',
        transition: 'all 0.2s'
    },
    historyItem: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 0', borderBottom: '1px solid #334155'
    },
    historyLeft: { display: 'flex', alignItems: 'center', gap: '10px' },
    historyRight: { display: 'flex', gap: '8px' },
    miniTag: {
        padding: '3px 8px', borderRadius: '6px', fontSize: '12px',
        background: '#334155', color: '#94a3b8', fontWeight: 600
    },
    table: { marginTop: '16px' },
    tableHeader: {
        display: 'flex', gap: '8px', padding: '12px 16px', borderRadius: '10px',
        background: '#334155', fontSize: '13px', fontWeight: 600, color: '#94a3b8'
    },
    tableRow: {
        display: 'flex', gap: '8px', padding: '12px 16px',
        borderBottom: '1px solid #1e293b', fontSize: '14px', alignItems: 'center'
    },
    detailBtn: {
        padding: '4px 10px', borderRadius: '6px', border: '1px solid #6366f1',
        background: 'transparent', color: '#818cf8', cursor: 'pointer',
        fontSize: '12px', fontWeight: 600
    },
    districtGrid: {
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px'
    },
    districtCard: {
        padding: '20px', borderRadius: '16px', background: '#1e293b',
        border: '1px solid #334155', transition: 'all 0.2s'
    },
    districtHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    districtName: { margin: 0, fontSize: '16px', fontWeight: 700, color: '#e2e8f0' },
    smallBtn: {
        padding: '6px 14px', borderRadius: '8px', border: 'none',
        background: '#6366f1', color: 'white', fontSize: '12px',
        fontWeight: 600, cursor: 'pointer', width: '100%'
    },
    resultBlock: {
        padding: '12px 16px', borderRadius: '10px', background: '#0f172a',
        border: '1px solid #334155', marginTop: '8px'
    },
    issueItem: { display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0' },
    severityDot: { width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0 },
    stepCard: {
        flex: '1 1 120px', display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: '6px', padding: '16px', borderRadius: '12px', background: '#0f172a',
        border: '1px solid #334155'
    }
};
