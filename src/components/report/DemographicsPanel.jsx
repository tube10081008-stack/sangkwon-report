import { Doughnut, Bar, Line } from 'react-chartjs-2';
import { Chart as ChartJS, LineElement } from 'chart.js';

export default function DemographicsPanel({ data }) {
    if (!data) return null;

    const { floatingPop, workingPop, residentPop, ageDistribution, genderRatio, hourlyPattern, singleHouseholdRatio, householdCount, characteristics, sourceLabel } = data;

    // 성별 도넛
    const genderChartData = {
        labels: ['남성', '여성'],
        datasets: [{
            data: [genderRatio?.male || 50, genderRatio?.female || 50],
            backgroundColor: ['#3b82f6', '#ec4899'],
            borderWidth: 2, borderColor: '#fff'
        }]
    };

    // 연령대 바차트
    const ageChartData = {
        labels: Object.keys(ageDistribution || {}),
        datasets: [{
            label: '비율 (%)',
            data: Object.values(ageDistribution || {}),
            backgroundColor: ['#94a3b8', '#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'],
            borderRadius: 6, borderSkipped: false
        }]
    };

    // 시간대별 라인차트
    const hourlyChartData = hourlyPattern ? {
        labels: hourlyPattern.map(h => h.label),
        datasets: [{
            label: '유동인구 지수',
            data: hourlyPattern.map(h => h.value),
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            fill: true, tension: 0.4, pointRadius: 2, pointHoverRadius: 5
        }]
    } : null;

    const formatNum = (n) => n ? n.toLocaleString() : '-';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* 데이터 소스 표시 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: 0 }}>👥 배후세대 인구분석</h4>
                <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', background: '#f0f9ff', color: '#0369a1', fontWeight: 600 }}>
                    📊 {sourceLabel}
                </span>
            </div>

            {/* 3종 인구 요약 카드 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div style={{ padding: '16px', background: 'linear-gradient(135deg, #fef3c7, #fde68a)', borderRadius: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '22px', marginBottom: '4px' }}>🚶</div>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: '#92400e' }}>{formatNum(floatingPop)}</div>
                    <div style={{ fontSize: '12px', color: '#78350f', fontWeight: 500 }}>유동인구</div>
                </div>
                <div style={{ padding: '16px', background: 'linear-gradient(135deg, #dbeafe, #bfdbfe)', borderRadius: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '22px', marginBottom: '4px' }}>💼</div>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: '#1e40af' }}>{formatNum(workingPop)}</div>
                    <div style={{ fontSize: '12px', color: '#1e3a5f', fontWeight: 500 }}>직장인구</div>
                </div>
                <div style={{ padding: '16px', background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)', borderRadius: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '22px', marginBottom: '4px' }}>🏠</div>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: '#166534' }}>{formatNum(residentPop)}</div>
                    <div style={{ fontSize: '12px', color: '#14532d', fontWeight: 500 }}>거주인구</div>
                </div>
            </div>

            {/* 세대 정보 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ fontSize: '28px' }}>🏘️</div>
                    <div>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>{formatNum(householdCount)}세대</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>추정 세대수</div>
                    </div>
                </div>
                <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ fontSize: '28px' }}>🧑</div>
                    <div>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>{singleHouseholdRatio}%</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>1인 가구 비율</div>
                    </div>
                </div>
            </div>

            {/* 차트 영역 */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                {/* 연령대 분포 */}
                <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px' }}>
                    <h5 style={{ fontSize: '14px', fontWeight: 600, color: '#334155', margin: '0 0 12px 0' }}>연령대 분포</h5>
                    <div style={{ height: '200px' }}>
                        <Bar data={ageChartData} options={{
                            responsive: true, maintainAspectRatio: false,
                            scales: { y: { beginAtZero: true, ticks: { callback: v => v + '%' } } },
                            plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.raw}%` } } }
                        }} />
                    </div>
                </div>
                {/* 성별 비율 */}
                <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px' }}>
                    <h5 style={{ fontSize: '14px', fontWeight: 600, color: '#334155', margin: '0 0 12px 0' }}>성별 비율</h5>
                    <div style={{ height: '200px' }}>
                        <Doughnut data={genderChartData} options={{
                            responsive: true, maintainAspectRatio: false, cutout: '60%',
                            plugins: { legend: { position: 'bottom', labels: { font: { size: 12 }, usePointStyle: true } } }
                        }} />
                    </div>
                </div>
            </div>

            {/* 시간대별 유동인구 */}
            {hourlyChartData && (
                <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px' }}>
                    <h5 style={{ fontSize: '14px', fontWeight: 600, color: '#334155', margin: '0 0 12px 0' }}>⏰ 시간대별 유동인구 흐름</h5>
                    <div style={{ height: '200px' }}>
                        <Line data={hourlyChartData} options={{
                            responsive: true, maintainAspectRatio: false,
                            scales: { x: { ticks: { maxTicksLimit: 12 } }, y: { beginAtZero: true } },
                            plugins: { legend: { display: false } }
                        }} />
                    </div>
                </div>
            )}

            {/* 상권 특성 */}
            {characteristics && characteristics.length > 0 && (
                <div style={{ padding: '14px', background: 'linear-gradient(135deg, #faf5ff, #ede9fe)', borderRadius: '12px' }}>
                    <h5 style={{ fontSize: '14px', fontWeight: 600, color: '#5b21b6', margin: '0 0 8px 0' }}>💡 이 상권의 인구 특성</h5>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {characteristics.map((c, i) => (
                            <div key={i} style={{ fontSize: '13px', color: '#334155', fontWeight: 500 }}>{c}</div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
