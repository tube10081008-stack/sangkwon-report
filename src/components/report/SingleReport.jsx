import { useEffect, useRef, useState } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, RadialLinearScale, PointElement, LineElement, Filler, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Doughnut, Radar, Bar } from 'react-chartjs-2';
import { Doughnut, Radar, Bar } from 'react-chartjs-2';
import HeatMap from '../maps/HeatMap';
import Vworld3DMap from '../maps/Vworld3DMap';
import VworldLandUseMap from '../maps/VworldLandUseMap';

ChartJS.register(ArcElement, Tooltip, Legend, RadialLinearScale, PointElement, LineElement, Filler, CategoryScale, LinearScale, BarElement);

const CHART_COLORS = ['#6366f1', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316'];

export default function SingleReport({ data }) {
    const { location, analysis, aiComments, radius } = data;
    const { totalStores, categorySummary, franchiseAnalysis, indicators, overallScore, grade, heatmapData, multiHeatmaps, categoryHeatmap, targetAnalysis } = analysis;

    // Donut chart data
    const donutData = {
        labels: categorySummary.slice(0, 8).map(c => c.name),
        datasets: [{
            data: categorySummary.slice(0, 8).map(c => c.count),
            backgroundColor: CHART_COLORS.slice(0, 8),
            borderWidth: 2,
            borderColor: '#fff',
            hoverOffset: 8
        }]
    };

    const donutOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { position: 'right', labels: { padding: 12, font: { family: "'Noto Sans KR'", size: 12 }, usePointStyle: true, pointStyleWidth: 10 } },
            tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.raw}개 (${((ctx.raw / totalStores) * 100).toFixed(1)}%)` } }
        },
        cutout: '65%'
    };

    // Radar chart
    const radarLabels = Object.values(indicators).map(i => i.label);
    const radarValues = Object.values(indicators).map(i => i.value);
    const radarData = {
        labels: radarLabels,
        datasets: [{
            label: '상권 지표',
            data: radarValues,
            backgroundColor: 'rgba(99, 102, 241, 0.15)',
            borderColor: '#6366f1',
            borderWidth: 2,
            pointBackgroundColor: '#6366f1',
            pointRadius: 5,
            pointHoverRadius: 7
        }]
    };

    const radarOptions = {
        responsive: true, maintainAspectRatio: false,
        scales: {
            r: { min: 0, max: 100, ticks: { stepSize: 20, display: false }, pointLabels: { font: { family: "'Noto Sans KR'", size: 12, weight: '600' }, color: '#475569' }, grid: { color: '#e2e8f0' } }
        },
        plugins: { legend: { display: false } }
    };

    // Score circle animation
    const circumference = 2 * Math.PI * 85;
    const dashOffset = circumference - (overallScore / 100) * circumference;
    const gradeGradientId = `grade-gradient-${grade.grade}`;

    return (
        <>
            {/* 1. 위치 정보 및 분석 개요 */}
            <div className="report-section">
                <div className="section-header">
                    <div className="section-number">1</div>
                    <h2>📍 위치 정보 및 분석 개요</h2>
                </div>
                <div className="stat-grid">
                    <div className="stat-card">
                        <div className="stat-label">분석 주소</div>
                        <div className="stat-value" style={{ fontSize: '16px', fontWeight: 600 }}>{location.address}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-label">행정구역</div>
                        <div className="stat-value" style={{ fontSize: '18px' }}>{location.region3 || location.region2}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-label">좌표 (위도, 경도)</div>
                        <div className="stat-value" style={{ fontSize: '14px', fontWeight: 500 }}>{location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-label">분석 반경</div>
                        <div className="stat-value">{radius}<span className="stat-unit">m</span></div>
                    </div>
                </div>
                <p style={{ fontSize: '14px', color: '#64748b', lineHeight: '1.7' }}>
                    본 리포트는 <strong>{location.address}</strong>를 중심으로 반경 <strong>{radius}m</strong> 이내의 상권 정보를 종합적으로 분석한 결과입니다.
                </p>
            </div>

            {/* 2. 상권 종합 등급 */}
            <div className="report-section">
                <div className="section-header">
                    <div className="section-number">2</div>
                    <h2>⭐ 상권 종합 평가</h2>
                </div>
                <div className="chart-row">
                    <div className="score-container">
                        <div className="score-gauge">
                            <svg viewBox="0 0 200 200">
                                <defs>
                                    <linearGradient id={gradeGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor={grade.color} />
                                        <stop offset="100%" stopColor="#8b5cf6" />
                                    </linearGradient>
                                </defs>
                                <circle className="score-gauge-bg" cx="100" cy="100" r="85" />
                                <circle className="score-gauge-fill" cx="100" cy="100" r="85"
                                    stroke={`url(#${gradeGradientId})`}
                                    strokeDasharray={circumference}
                                    strokeDashoffset={dashOffset}
                                />
                            </svg>
                            <div className="score-center">
                                <div className="score-grade">{grade.grade}</div>
                                <div className="score-label">{grade.label}</div>
                            </div>
                        </div>
                        <div className="score-number">{overallScore}점 / 100점</div>
                        <p style={{ textAlign: 'center', color: '#64748b', fontSize: '14px', marginTop: '8px', maxWidth: '400px' }}>
                            {grade.description}
                        </p>
                    </div>
                    <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                        <div className="stat-card">
                            <div className="stat-label">총 업소 수</div>
                            <div className="stat-value">{totalStores.toLocaleString()}<span className="stat-unit">개</span></div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">업종 수</div>
                            <div className="stat-value">{categorySummary.length}<span className="stat-unit">개</span></div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">프랜차이즈</div>
                            <div className="stat-value">{franchiseAnalysis.totalFranchise}<span className="stat-unit">개</span></div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">주요 업종</div>
                            <div className="stat-value" style={{ fontSize: '16px' }}>{categorySummary[0]?.name || '-'}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. 6대 지표 레이더 차트 */}
            <div className="report-section">
                <div className="section-header">
                    <div className="section-number">3</div>
                    <h2>📊 6대 핵심 지표 분석</h2>
                </div>
                <div className="chart-row">
                    <div className="chart-container" style={{ height: '320px' }}>
                        <Radar data={radarData} options={radarOptions} />
                    </div>
                    <div>
                        {Object.values(indicators).map((ind, i) => (
                            <div key={i} style={{ marginBottom: '14px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>{ind.label}</span>
                                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#6366f1' }}>{ind.value}점</span>
                                </div>
                                <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px' }}>
                                    <div style={{ width: `${ind.value}%`, height: '100%', background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', borderRadius: '3px', transition: 'width 1.5s ease' }} />
                                </div>
                                <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{ind.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 4. 업종별 분포 분석 */}
            <div className="report-section">
                <div className="section-header">
                    <div className="section-number">4</div>
                    <h2>🏪 업종별 분포 분석</h2>
                </div>
                <div className="chart-row">
                    <div className="chart-container" style={{ height: '300px' }}>
                        <Doughnut data={donutData} options={donutOptions} />
                    </div>
                    <div className="category-list">
                        {categorySummary.slice(0, 10).map((cat, i) => (
                            <div className="category-item" key={i}>
                                <div className={`category-rank ${i < 3 ? 'top3' : ''}`}>{i + 1}</div>
                                <div className="category-name">{cat.name}</div>
                                <div className="category-count">{cat.count.toLocaleString()}개 ({cat.percentage}%)</div>
                                <div className="category-bar-wrapper">
                                    <div className="category-bar" style={{ width: `${cat.percentage}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 5. GIS 다중 히트맵 */}
            <div className="report-section">
                <div className="section-header">
                    <div className="section-number">5</div>
                    <h2>🗺️ GIS 다중 히트맵 분석</h2>
                </div>
                <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '12px' }}>
                    탭을 전환하여 전체 밀집도, 업종별 분포, 추정 유동인구, 소비 활성화 지수 등 다양한 관점의 히트맵을 확인하세요.
                </p>
                <HeatMap center={[location.latitude, location.longitude]} points={heatmapData} radius={radius} multiHeatmaps={multiHeatmaps} />
            </div>

            {/* [NEW] 5-1. 프리미엄 부동산/입지 분석 (Vworld 연동) */}
            <div className="report-section">
                <div className="section-header">
                    <div className="section-number" style={{ background: '#ec4899', color: 'white' }}>5-1</div>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        🏢 프리미엄 부동산 / 입지 분석
                        <span style={{ fontSize: '10px', background: '#fef08a', color: '#854d0e', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>PRO</span>
                    </h2>
                </div>
                <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '16px' }}>
                    브이월드(Vworld) 국가공간정보를 활용하여 타겟 상권의 입체적 스카이라인과 토지 용도(상업/주거 등)를 심층 분석합니다.
                </p>
                
                <div className="vworld-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    {/* 3D Map */}
                    <div className="vworld-card">
                        <h4 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '10px', color: '#334155' }}>👀 3D 상권 뷰어 (스카이라인)</h4>
                        <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '12px' }}>주변 건물의 높낮이와 밀집도를 통해 오피스/상업 권역을 직관적으로 확인하세요.</p>
                        <Vworld3DMap center={[location.longitude, location.latitude]} /> 
                        {/* Vworld API는 [lon, lat] 순서를 사용함 유의 */}
                    </div>

                    {/* 2D Land Use Map */}
                    <div className="vworld-card">
                        <h4 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '10px', color: '#334155' }}>🎨 토지 컬러 테마 (용도지역)</h4>
                        <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '12px' }}>해당 구역의 법정 토지 용도를 색상표로 확인하여 상권의 성격을 유추하세요.</p>
                        <VworldLandUseMap center={[location.latitude, location.longitude]} radius={radius} />
                        {/* Leaflet은 [lat, lon] 사용 */}
                    </div>
                </div>
            </div>

            {/* 6. 프랜차이즈 분석 */}
            <div className="report-section">
                <div className="section-header">
                    <div className="section-number">6</div>
                    <h2>🏢 프랜차이즈 현황 분석</h2>
                </div>
                <div className="stat-grid" style={{ marginBottom: '20px' }}>
                    <div className="stat-card">
                        <div className="stat-label">프랜차이즈 업소</div>
                        <div className="stat-value">{franchiseAnalysis.totalFranchise}<span className="stat-unit">개</span></div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-label">독립 업소</div>
                        <div className="stat-value">{franchiseAnalysis.totalIndependent}<span className="stat-unit">개</span></div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-label">프랜차이즈 비율</div>
                        <div className="stat-value">{franchiseAnalysis.franchiseRatio}<span className="stat-unit">%</span></div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-label">브랜드 수</div>
                        <div className="stat-value">{franchiseAnalysis.brands.length}<span className="stat-unit">개</span></div>
                    </div>
                </div>
                {franchiseAnalysis.topBrands.length > 0 && (
                    <>
                        <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px', color: '#334155' }}>상위 브랜드</h4>
                        <div className="franchise-grid">
                            {franchiseAnalysis.topBrands.map((b, i) => (
                                <div className="franchise-item" key={i}>
                                    <span className="franchise-name">{b.name}</span>
                                    <span className="franchise-count">{b.count}개</span>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* 7. 타겟 업종 분석 (있을 경우) */}
            {targetAnalysis && (
                <div className="report-section">
                    <div className="section-header">
                        <div className="section-number">7</div>
                        <h2>🎯 {targetAnalysis.targetCategory} 업종 분석</h2>
                    </div>
                    <div className={`verdict ${targetAnalysis.saturationLevel.level === '미진입' || targetAnalysis.saturationLevel.level === '적정' ? 'recommend' : targetAnalysis.saturationLevel.level === '경쟁' ? 'conditional' : 'caution'}`}>
                        <div className="verdict-icon">{targetAnalysis.saturationLevel.level === '미진입' ? '🟢' : targetAnalysis.saturationLevel.level === '적정' ? '🟢' : targetAnalysis.saturationLevel.level === '경쟁' ? '🟡' : '🔴'}</div>
                        <div className="verdict-text">
                            <h3>시장 상태: {targetAnalysis.saturationLevel.level}</h3>
                            <p>{targetAnalysis.saturationLevel.advice}</p>
                        </div>
                    </div>
                    <div className="stat-grid">
                        <div className="stat-card">
                            <div className="stat-label">경쟁 업소 수</div>
                            <div className="stat-value">{targetAnalysis.competitorCount}<span className="stat-unit">개</span></div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">시장 점유율</div>
                            <div className="stat-value">{targetAnalysis.marketShare}<span className="stat-unit">%</span></div>
                        </div>
                    </div>
                    {aiComments.targetInsight && (
                        <div className="recommendation-box" style={{ marginTop: '16px' }}>
                            <h4>💡 전문가 인사이트</h4>
                            <p dangerouslySetInnerHTML={{ __html: aiComments.targetInsight.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                        </div>
                    )}
                </div>
            )}

            {/* 8. SWOT 분석 */}
            <div className="report-section">
                <div className="section-header">
                    <div className="section-number">{targetAnalysis ? 8 : 7}</div>
                    <h2>💡 상권 특성 및 인사이트</h2>
                </div>
                <div className="insight-grid">
                    <div className="insight-card strength">
                        <h4>💪 강점 (Strength)</h4>
                        <ul>{aiComments.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
                    </div>
                    <div className="insight-card weakness">
                        <h4>⚠️ 약점 (Weakness)</h4>
                        <ul>{aiComments.weaknesses.length > 0 ? aiComments.weaknesses.map((w, i) => <li key={i}>{w}</li>) : <li>특이 약점 없음</li>}</ul>
                    </div>
                    <div className="insight-card opportunity">
                        <h4>🚀 기회 (Opportunity)</h4>
                        <ul>{aiComments.opportunities.length > 0 ? aiComments.opportunities.map((o, i) => <li key={i}>{o}</li>) : <li>추가 조사 필요</li>}</ul>
                    </div>
                    <div className="insight-card threat">
                        <h4>🔥 위협 (Threat)</h4>
                        <ul>{aiComments.threats.length > 0 ? aiComments.threats.map((t, i) => <li key={i}>{t}</li>) : <li>현재 뚜렷한 위협 요소 없음</li>}</ul>
                    </div>
                </div>
            </div>

            {/* 9. 종합 결론 및 제언 */}
            <div className="report-section">
                <div className="section-header">
                    <div className="section-number">{targetAnalysis ? 9 : 8}</div>
                    <h2>📋 종합 결론 및 전문가 제언</h2>
                </div>
                <div className="recommendation-box">
                    <h4>📌 전문가 추천 사항</h4>
                    <ul>
                        {aiComments.recommendations.map((r, i) => (
                            <li key={i} dangerouslySetInnerHTML={{ __html: r.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                        ))}
                    </ul>
                </div>
                <p style={{ marginTop: '20px', fontSize: '14px', color: '#64748b', lineHeight: '1.8', padding: '16px', background: '#f8fafc', borderRadius: '8px' }}
                    dangerouslySetInnerHTML={{ __html: aiComments.conclusion.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
            </div>
        </>
    );
}
