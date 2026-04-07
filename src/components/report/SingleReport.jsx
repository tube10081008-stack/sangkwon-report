import { useEffect, useRef, useState } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, RadialLinearScale, PointElement, LineElement, Filler, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import HeatMap from '../maps/HeatMap';
import Vworld3DMap from '../maps/Vworld3DMap';
import VworldLandUseMap from '../maps/VworldLandUseMap';
import VworldBuildingAgeMap from '../maps/VworldBuildingAgeMap';
import SlopeChecker from '../maps/SlopeChecker';
import TransitScore from './TransitScore';
import DemographicsPanel from './DemographicsPanel';
import SeoulDataPanel from './SeoulDataPanel';
import AISectionChat from './AISectionChat';
import RealEstatePanel from './RealEstatePanel';

ChartJS.register(ArcElement, Tooltip, Legend, RadialLinearScale, PointElement, LineElement, Filler, CategoryScale, LinearScale, BarElement);

// B2B Dark Theme Chart Colors
const CHART_COLORS = ['#3E8ED0', '#48C774', '#F4A261', '#E76F51', '#2A9D8F', '#E9C46A', '#264653', '#8AB4F8', '#6EE7B7', '#9CA3AF'];
const SUB_COLORS = ['#3E8ED0', '#48C774', '#F4A261', '#E76F51', '#2A9D8F', '#E9C46A', '#264653', '#8AB4F8', '#6EE7B7', '#9CA3AF'];

// 차트 전역 다크 테마 설정
ChartJS.defaults.color = '#A0AAB5';
ChartJS.defaults.borderColor = 'rgba(255, 255, 255, 0.08)';

// Custom CountUp Hook
const useCountUp = (end, duration = 2000) => {
    const [count, setCount] = useState(0);
    
    useEffect(() => {
        let startTime = null;
        let animationFrame;
        
        const animate = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const progress = timestamp - startTime;
            const percentage = Math.min(progress / duration, 1);
            
            const easeOut = percentage === 1 ? 1 : 1 - Math.pow(2, -10 * percentage);
            setCount(Math.floor(end * easeOut));
            
            if (progress < duration) {
                animationFrame = requestAnimationFrame(animate);
            } else {
                setCount(end);
            }
        };
        
        animationFrame = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrame);
    }, [end, duration]);
    
    return count;
};

export default function SingleReport({ data }) {
    const { location, analysis, aiComments, radius, transitInfo, demographics, seoulData, realEstateData } = data;
    const { totalStores, categorySummary, franchiseAnalysis, heatmapData, multiHeatmaps, targetAnalysis } = analysis;

    // 카운트업 적용
    const animatedTotalStores = useCountUp(totalStores);

    // ===== 도넛 드릴다운 상태 =====
    const [drillCategory, setDrillCategory] = useState(null);
    const chartRef = useRef(null);

    // 현재 표시할 카테고리 데이터
    const currentCategories = drillCategory
        ? drillCategory.subCategories.map((sub, i) => ({
            name: sub.name,
            count: sub.count,
            percentage: ((sub.count / drillCategory.count) * 100).toFixed(1)
        }))
        : categorySummary.slice(0, 8);

    const currentTotal = drillCategory ? drillCategory.count : totalStores;

    const donutData = {
        labels: currentCategories.map(c => c.name),
        datasets: [{
            data: currentCategories.map(c => c.count),
            backgroundColor: drillCategory ? SUB_COLORS.slice(0, currentCategories.length) : CHART_COLORS.slice(0, 8),
            borderWidth: 2,
            borderColor: '#0B0F19', // Dark theme background
            hoverOffset: 12,
            hoverBorderWidth: 3
        }]
    };

    const donutOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { position: 'right', labels: { padding: 12, font: { family: "'Noto Sans KR'", size: 12 }, usePointStyle: true, pointStyleWidth: 10, color: '#A0AAB5' } },
            tooltip: {
                callbacks: {
                    label: (ctx) => `${ctx.label}: ${ctx.raw}개 (${((ctx.raw / currentTotal) * 100).toFixed(1)}%)`,
                    afterLabel: (ctx) => !drillCategory ? '👆 클릭하면 세부 업종을 볼 수 있어요' : ''
                }
            }
        },
        cutout: '68%',
        onClick: (event, elements) => {
            if (!drillCategory && elements.length > 0) {
                const idx = elements[0].index;
                const cat = categorySummary[idx];
                if (cat && cat.subCategories && cat.subCategories.length > 0) {
                    setDrillCategory(cat);
                }
            }
        },
        animation: { animateRotate: true, duration: 800 }
    };

    // ===== 인구·매출 통합 탭 상태 =====
    const [dataTab, setDataTab] = useState('population');

    return (
        <>
            {/* 1. 위치 정보 및 분석 개요 */}
            <div className="report-section">
                <div className="section-header">
                    <h2>📍 핵심 분석 대상 영역</h2>
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
                        <div className="stat-label">총 업소 수</div>
                        <div className="stat-value">{animatedTotalStores.toLocaleString()}<span className="stat-unit">개</span></div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-label">분석 반경</div>
                        <div className="stat-value">{radius}<span className="stat-unit">m</span></div>
                    </div>
                </div>
                <p style={{ fontSize: '14px', color: '#A0AAB5', lineHeight: '1.7' }}>
                    본 리포트는 <strong>{location.address}</strong>를 중심으로 반경 <strong>{radius}m</strong> 이내의 상권 데이터를 다각도로 인텔리전스화 한 결과입니다.
                </p>
            </div>

            {/* 2. 업종별 분포 분석 (드릴다운 도넛) */}
            <div className="report-section">
                <div className="section-header">
                    <h2>🏪 상권 포트폴리오 분포도</h2>
                </div>

                {/* 드릴다운 네비게이션 */}
                {drillCategory && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', padding: '10px 16px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '6px', border: '1px solid var(--report-border)' }}>
                        <button
                            onClick={() => setDrillCategory(null)}
                            style={{
                                padding: '6px 14px', background: 'var(--report-accent-dim)', color: 'var(--report-accent-mint)', border: '1px solid rgba(110, 231, 183, 0.3)',
                                borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                                display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.2s'
                            }}
                        >
                            ← 전체 포트폴리오
                        </button>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--report-text-primary)' }}>
                            📂 {drillCategory.name}
                        </span>
                        <span style={{ fontSize: '13px', color: 'var(--report-text-secondary)', fontWeight: 500 }}>
                            ({drillCategory.count.toLocaleString()}개소 세분화)
                        </span>
                    </div>
                )}

                <div className="chart-row">
                    <div className="chart-container" style={{ height: '320px', position: 'relative' }}>
                        <Doughnut ref={chartRef} data={donutData} options={donutOptions} />
                        {/* 중앙 라벨 */}
                        <div style={{
                            position: 'absolute', top: '50%', left: drillCategory ? '38%' : '35%',
                            transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none'
                        }}>
                            <div style={{ fontSize: '24px', fontWeight: 800, color: '#FFFFFF' }}>
                                {currentTotal.toLocaleString()}
                            </div>
                            <div style={{ fontSize: '11px', color: '#A0AAB5', fontWeight: 500 }}>
                                {drillCategory ? drillCategory.name : '전체 포트폴리오'}
                            </div>
                        </div>
                    </div>
                    <div className="category-list">
                        {currentCategories.slice(0, 10).map((cat, i) => (
                            <div
                                className="category-item"
                                key={i}
                                onClick={() => {
                                    if (!drillCategory) {
                                        const fullCat = categorySummary[i];
                                        if (fullCat?.subCategories?.length > 0) setDrillCategory(fullCat);
                                    }
                                }}
                                style={{ cursor: !drillCategory ? 'pointer' : 'default', transition: 'background 0.2s' }}
                                onMouseEnter={(e) => { if (!drillCategory) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
                            >
                                <div className={`category-rank ${i < 3 ? 'top3' : ''}`}>{i + 1}</div>
                                <div className="category-name">
                                    {cat.name}
                                    {!drillCategory && <span style={{ fontSize: '10px', color: '#94a3b8', marginLeft: '4px' }}>▶</span>}
                                </div>
                                <div className="category-count">{cat.count.toLocaleString()}개 ({cat.percentage}%)</div>
                                <div className="category-bar-wrapper">
                                    <div className="category-bar" style={{ width: `${Math.min(100, parseFloat(cat.percentage))}%`, background: drillCategory ? SUB_COLORS[i] : undefined }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <AISectionChat
                    sectionName="업종별 분포 분석"
                    contextData={categorySummary}
                    suggestedQuestions={["이 상권에서 당장 들어가기 가장 좋은 블루오션 업종은?", "현재 1위 업종의 경쟁 포화도 방어 전략은?", "이 업종 분포를 볼 때 추천하는 타겟 연령층/성별은?"]}
                />
            </div>

            {/* 3. GIS 다중 히트맵 */}
            <div className="report-section">
                <div className="section-header">
                    <h2>🗺️ 상권 데이터 히트맵 및 토폴로지 분석</h2>
                </div>
                <p style={{ fontSize: '14px', color: 'var(--report-text-secondary)', marginBottom: '12px' }}>
                    공간 빅데이터(GIS)를 활용하여 상권의 밀집도와 소비 심도를 직관적인 맵 스캐닝으로 분석합니다.
                </p>
                <HeatMap center={[location.latitude, location.longitude]} points={heatmapData} radius={radius} multiHeatmaps={multiHeatmaps} />
            </div>

            {/* 4. 프리미엄 부동산/입지 분석 */}
            <div className="report-section">
                <div className="section-header">
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        🏢 상권 스카이라인 및 인프라 구조
                        <span style={{ fontSize: '10px', background: 'rgba(236, 72, 153, 0.15)', color: '#ec4899', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', border: '1px solid rgba(236, 72, 153, 0.3)' }}>PRO</span>
                    </h2>
                </div>
                <p style={{ fontSize: '14px', color: 'var(--report-text-secondary)', marginBottom: '16px' }}>
                    브이월드(Vworld) 3D 공간정보를 기반으로 타겟 구역의 입체적 스카이라인과 용도 지구를 정밀 진단합니다.
                </p>

                <div className="vworld-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div className="vworld-card" style={{ gridColumn: '1 / -1' }}>
                        <h4 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '10px', color: '#334155' }}>👀 3D 상권 뷰어 (스카이라인)</h4>
                        <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '12px' }}>주변 건물의 높낮이와 밀집도를 통해 오피스/상업 권역을 직관적으로 확인하고, 마우스로 자유롭게 조망하세요.</p>
                        <Vworld3DMap center={[location.longitude, location.latitude]} />
                    </div>
                    <div className="vworld-card">
                        <h4 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '10px', color: '#334155' }}>🎨 토지 컬러 테마 (용도지역)</h4>
                        <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '12px' }}>해당 구역의 법정 토지 용도를 색상표로 확인하여 상권의 성격을 유추하세요.</p>
                        <VworldLandUseMap center={[location.latitude, location.longitude]} radius={radius} />
                    </div>
                    <div className="vworld-card">
                        <h4 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '10px', color: '#334155' }}>🏠 건물 노후도 컬러맵 & 건물 X-ray 팝업</h4>
                        <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '12px' }}>건축물 연식을 파악하여 신도심/구도심 여부를 판별하고, 클릭하여 세부정보를 확인하세요.</p>
                        <VworldBuildingAgeMap center={[location.latitude, location.longitude]} radius={radius} />
                    </div>
                </div>

                <div style={{ marginTop: '20px' }}>
                    <SlopeChecker center={[location.latitude, location.longitude]} radius={radius} />
                </div>

                {transitInfo && (
                    <div style={{ marginTop: '20px' }}>
                        <TransitScore data={transitInfo} />
                    </div>
                )}

                {/* 통합 인구·매출 분석 */}
                {(demographics || seoulData) && (
                    <div style={{ marginTop: '20px', padding: '24px', background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <h4 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: 0 }}>📊 인구 · 매출 통합 분석</h4>
                            <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', borderRadius: '10px', padding: '3px' }}>
                                {demographics && (
                                    <button
                                        onClick={() => setDataTab('population')}
                                        style={{
                                            padding: '7px 16px', fontSize: '13px', fontWeight: 600, border: 'none', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s',
                                            background: dataTab === 'population' ? '#6366f1' : 'transparent',
                                            color: dataTab === 'population' ? 'white' : '#64748b'
                                        }}
                                    >
                                        👥 인구 분석
                                    </button>
                                )}
                                {seoulData && (
                                    <button
                                        onClick={() => setDataTab('sales')}
                                        style={{
                                            padding: '7px 16px', fontSize: '13px', fontWeight: 600, border: 'none', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s',
                                            background: dataTab === 'sales' ? '#6366f1' : 'transparent',
                                            color: dataTab === 'sales' ? 'white' : '#64748b'
                                        }}
                                    >
                                        💳 매출·소비
                                    </button>
                                )}
                            </div>
                        </div>

                        {dataTab === 'population' && demographics && (
                            <DemographicsPanel data={demographics} />
                        )}
                        {dataTab === 'sales' && seoulData && (
                            <SeoulDataPanel seoulData={seoulData} />
                        )}
                    </div>
                )}
            </div>

            {/* 5. 프랜차이즈 분석 */}
            <div className="report-section">
                <div className="section-header">
                    <h2>🏢 브랜드 / 독립 시장 침투율 분석</h2>
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
                <AISectionChat
                    sectionName="프랜차이즈 현황 분석"
                    contextData={franchiseAnalysis}
                    suggestedQuestions={["개인 매장 창업 시 대형 프랜차이즈 방어 전략은?", "가장 많이 입점해 있는 브랜드들의 공통된 특징은?", "이 정도 프랜차이즈 비율을 볼 때 상권의 매력도는?"]}
                />
            </div>

            {/* 6. 타겟 업종 분석 (있을 경우) */}
            {targetAnalysis && (
                <div className="report-section">
                    <div className="section-header">
                        <h2>🎯 {targetAnalysis.targetCategory} 경쟁 강도 지표</h2>
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

            {/* 7. SWOT 분석 */}
            <div className="report-section">
                <div className="section-header">
                    <h2>💡 상권 다면 SWOT 지표</h2>
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

            {/* 7-1. 실거래 트렌드 */}
            {aiComments.realEstateTrend && (
                <div className="report-section">
                    <div className="section-header">
                        <h2>🏢 최신 실거래가 동향 인프라</h2>
                    </div>
                    <div style={{ background: 'var(--report-panel)', border: '1px solid var(--report-border)', borderRadius: '8px', padding: '16px', fontSize: '14px', lineHeight: '1.8', whiteSpace: 'pre-line', color: 'var(--report-text-primary)' }}
                         dangerouslySetInnerHTML={{ __html: aiComments.realEstateTrend.replace(/\*\*(.*?)\*\*/g, '<strong style="color: var(--report-accent-mint);">$1</strong>') }} />

                    <RealEstatePanel data={realEstateData} />

                    <AISectionChat
                        sectionName="부동산 실거래 트렌드"
                        contextData={realEstateData}
                        suggestedQuestions={["가장 비싸게 거래된 건물의 특징은 무엇일까?", "최근 상가 매매 대비 아파트 전월세 활성도는?", "조회된 실거래를 바탕으로 대략적인 시세를 평가해줘."]}
                    />
                </div>
            )}

            {/* 8. 종합 결론 및 제언 */}
            <div className="report-section">
                <div className="section-header">
                    <h2>📋 종합 결론 및 전략적 제언</h2>
                </div>
                <div className="recommendation-box">
                    <h4>📌 전문가 추천 사항</h4>
                    <ul>
                        {aiComments.recommendations.map((r, i) => (
                            <li key={i} dangerouslySetInnerHTML={{ __html: r.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                        ))}
                    </ul>
                </div>
                <p style={{ marginTop: '20px', fontSize: '14px', color: 'var(--report-text-primary)', lineHeight: '1.8', padding: '16px', background: 'var(--report-panel)', borderRadius: '8px', border: '1px solid var(--report-border)' }}
                    dangerouslySetInnerHTML={{ __html: aiComments.overview.replace(/\*\*(.*?)\*\*/g, '<strong style="color: var(--report-accent-mint);">$1</strong>') }} />
            </div>
        </>
    );
}
