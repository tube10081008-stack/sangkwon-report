import { Chart as ChartJS, ArcElement, Tooltip, Legend, RadialLinearScale, PointElement, LineElement, Filler, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Radar, Bar } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend, RadialLinearScale, PointElement, LineElement, Filler, CategoryScale, LinearScale, BarElement);

export default function CompareReport({ data, address1, address2 }) {
    const { area1, area2, comparison, aiComments } = data;
    const a1 = area1.analysis;
    const a2 = area2.analysis;

    // Overlay radar chart
    const radarLabels = Object.values(a1.indicators).map(i => i.label);
    const radarData = {
        labels: radarLabels,
        datasets: [
            {
                label: address1,
                data: Object.values(a1.indicators).map(i => i.value),
                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                borderColor: '#6366f1',
                borderWidth: 2,
                pointBackgroundColor: '#6366f1',
                pointRadius: 5,
            },
            {
                label: address2,
                data: Object.values(a2.indicators).map(i => i.value),
                backgroundColor: 'rgba(6, 182, 212, 0.15)',
                borderColor: '#06b6d4',
                borderWidth: 2,
                pointBackgroundColor: '#06b6d4',
                pointRadius: 5,
            }
        ]
    };

    const radarOptions = {
        responsive: true, maintainAspectRatio: false,
        scales: {
            r: { min: 0, max: 100, ticks: { stepSize: 20, display: false }, pointLabels: { font: { family: "'Noto Sans KR'", size: 12, weight: '600' }, color: '#475569' }, grid: { color: '#e2e8f0' } }
        },
        plugins: { legend: { position: 'bottom', labels: { padding: 20, font: { family: "'Noto Sans KR'", size: 13 }, usePointStyle: true } } }
    };

    // Category comparison bar chart
    const topCats = comparison.categoryComparison.slice(0, 8);
    const barData = {
        labels: topCats.map(c => c.category),
        datasets: [
            { label: address1, data: topCats.map(c => c.area1Count), backgroundColor: 'rgba(99, 102, 241, 0.7)', borderRadius: 4 },
            { label: address2, data: topCats.map(c => c.area2Count), backgroundColor: 'rgba(6, 182, 212, 0.7)', borderRadius: 4 }
        ]
    };

    const barOptions = {
        responsive: true, maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: { legend: { position: 'bottom', labels: { font: { family: "'Noto Sans KR'", size: 12 } } } },
        scales: { x: { grid: { color: '#f1f5f9' } }, y: { ticks: { font: { family: "'Noto Sans KR'", size: 12 } } } }
    };

    const winner1 = comparison.recommendation === 'area1';
    const winner2 = comparison.recommendation === 'area2';

    return (
        <>
            {/* 1. 두 상권 요약 */}
            <div className="report-section">
                <div className="section-header">
                    <div className="section-number">1</div>
                    <h2>📍 두 상권 비교 요약</h2>
                </div>
                <div className="compare-grid">
                    <div className={`compare-card ${winner1 ? 'winner' : ''}`}>
                        {winner1 && <div className="winner-badge">👑 추천</div>}
                        <h3>상권 A</h3>
                        <p className="region">{area1.location.address}</p>
                        <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                            <div className="stat-card">
                                <div className="stat-label">종합 등급</div>
                                <div className="stat-value" style={{ color: a1.grade.color }}>{a1.grade.grade}</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-label">종합 점수</div>
                                <div className="stat-value">{a1.overallScore}<span className="stat-unit">점</span></div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-label">총 업소</div>
                                <div className="stat-value">{a1.totalStores.toLocaleString()}<span className="stat-unit">개</span></div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-label">업종 수</div>
                                <div className="stat-value">{a1.categorySummary.length}<span className="stat-unit">개</span></div>
                            </div>
                        </div>
                    </div>
                    <div className={`compare-card ${winner2 ? 'winner' : ''}`}>
                        {winner2 && <div className="winner-badge">👑 추천</div>}
                        <h3>상권 B</h3>
                        <p className="region">{area2.location.address}</p>
                        <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                            <div className="stat-card">
                                <div className="stat-label">종합 등급</div>
                                <div className="stat-value" style={{ color: a2.grade.color }}>{a2.grade.grade}</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-label">종합 점수</div>
                                <div className="stat-value">{a2.overallScore}<span className="stat-unit">점</span></div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-label">총 업소</div>
                                <div className="stat-value">{a2.totalStores.toLocaleString()}<span className="stat-unit">개</span></div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-label">업종 수</div>
                                <div className="stat-value">{a2.categorySummary.length}<span className="stat-unit">개</span></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. 레이더 차트 비교 */}
            <div className="report-section">
                <div className="section-header">
                    <div className="section-number">2</div>
                    <h2>📊 6대 지표 비교 분석</h2>
                </div>
                <div className="chart-container" style={{ height: '380px', maxWidth: '550px', margin: '0 auto' }}>
                    <Radar data={radarData} options={radarOptions} />
                </div>
                <div style={{ marginTop: '24px' }}>
                    {aiComments.detailedComparison.map((comp, i) => (
                        <div className="compare-indicator" key={i}>
                            <span className="compare-indicator-label">{comp.indicator}</span>
                            <span className="compare-indicator-value" style={{ color: comp.winner === area1.location.address ? '#6366f1' : comp.winner === area2.location.address ? '#06b6d4' : '#94a3b8' }}>
                                A: {comp.area1}점 vs B: {comp.area2}점
                                {comp.diff > 5 && <span style={{ fontSize: '11px', marginLeft: '8px', opacity: 0.7 }}>({comp.winner === '동점' ? '동점' : `${comp.winner.substring(0, 6)}... 우세 +${comp.diff}점`})</span>}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* 3. 업종 분포 비교 */}
            <div className="report-section">
                <div className="section-header">
                    <div className="section-number">3</div>
                    <h2>🏪 업종 분포 비교</h2>
                </div>
                <div className="chart-container" style={{ height: '350px' }}>
                    <Bar data={barData} options={barOptions} />
                </div>
            </div>

            {/* 4. 장단점 비교 */}
            <div className="report-section">
                <div className="section-header">
                    <div className="section-number">4</div>
                    <h2>⚖️ 장단점 비교</h2>
                </div>
                <div className="compare-grid">
                    <div className="insight-card strength">
                        <h4>💪 상권 A 강점</h4>
                        <p style={{ fontSize: '14px', color: '#475569', lineHeight: 1.7 }}
                            dangerouslySetInnerHTML={{ __html: (aiComments.advantages.area1 || '뚜렷한 우위 지표 없음').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                    </div>
                    <div className="insight-card opportunity">
                        <h4>💪 상권 B 강점</h4>
                        <p style={{ fontSize: '14px', color: '#475569', lineHeight: 1.7 }}
                            dangerouslySetInnerHTML={{ __html: (aiComments.advantages.area2 || '뚜렷한 우위 지표 없음').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                    </div>
                </div>
            </div>

            {/* 5. 종합 추천 */}
            <div className="report-section">
                <div className="section-header">
                    <div className="section-number">5</div>
                    <h2>📋 종합 추천</h2>
                </div>
                <div className="recommendation-box">
                    <h4>🎯 전문가 종합 의견</h4>
                    <p dangerouslySetInnerHTML={{ __html: aiComments.recommendation.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                    <p style={{ marginTop: '12px', color: '#475569' }}>{aiComments.finalAdvice}</p>
                </div>
            </div>
        </>
    );
}
