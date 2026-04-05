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

const CHART_COLORS = ['#6366f1', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316'];
const SUB_COLORS = ['#818cf8', '#60a5fa', '#22d3ee', '#34d399', '#fbbf24', '#f87171', '#f472b6', '#a78bfa', '#2dd4bf', '#fb923c', '#a3e635', '#e879f9'];

export default function SingleReport({ data }) {
    const { location, analysis, aiComments, radius, transitInfo, demographics, seoulData, realEstateData } = data;
    const { totalStores, categorySummary, franchiseAnalysis, heatmapData, multiHeatmaps, targetAnalysis } = analysis;

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
            borderColor: '#fff',
            hoverOffset: 12,
            hoverBorderWidth: 3
        }]
    };

    const donutOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { position: 'right', labels: { padding: 12, font: { family: "'Noto Sans KR'", size: 12 }, usePointStyle: true, pointStyleWidth: 10 } },
            tooltip: {
                callbacks: {
                    label: (ctx) => `${ctx.label}: ${ctx.raw}개 (${((ctx.raw / currentTotal) * 100).toFixed(1)}%)`,
                    afterLabel: (ctx) => !drillCategory ? '👆 클릭하면 세부 업종을 볼 수 있어요' : ''
                }
            }
        },
        cutout: '65%',
        onClick: (event, elements) => {
            if (!drillCategory && elements.length > 0) {
                const idx = elements[0].index;
                const cat = categorySummary[idx];
                if (cat && cat.subCategories && cat.subCategories.length > 0) {
                    setDrillCategory(cat);
                }
            }
        },
        animation: { animateRotate: true, duration: 600 }
    };

    // ===== 인구·매출 통합 탭 상태 =====
    const [dataTab, setDataTab] = useState('population');

    // 섹션 번호 자동 계산
    let sectionNum = 0;
    const nextSection = () => ++sectionNum;

    return (
        <>
            {/* 1. 위치 정보 및 분석 개요 */}
            <div className="report-section">
                <div className="section-header">
                    <div className="section-number">{nextSection()}</div>
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
                        <div className="stat-label">총 업소 수</div>
                        <div className="stat-value">{totalStores.toLocaleString()}<span className="stat-unit">개</span></div>
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

            {/* 2. 업종별 분포 분석 (드릴다운 도넛) */}
            <div className="report-section">
                <div className="section-header">
                    <div className="section-number">{nextSection()}</div>
                    <h2>🏪 업종별 분포 분석</h2>
                </div>

                {/* 드릴다운 네비게이션 */}
                {drillCategory && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', padding: '10px 16px', background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', borderRadius: '10px' }}>
                        <button
                            onClick={() => setDrillCategory(null)}
                            style={{
                                padding: '6px 14px', background: '#6366f1', color: 'white', border: 'none',
                                borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                                display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.2s'
                            }}
                        >
                            ← 전체 업종
                        </button>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#1e40af' }}>
                            📂 {drillCategory.name}
                        </span>
                        <span style={{ fontSize: '13px', color: '#3b82f6', fontWeight: 500 }}>
                            ({drillCategory.count.toLocaleString()}개 업소의 세부 분류)
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
                            <div style={{ fontSize: '24px', fontWeight: 800, color: '#1e293b' }}>
                                {currentTotal.toLocaleString()}
                            </div>
                            <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>
                                {drillCategory ? drillCategory.name : '전체 업소'}
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
                                onMouseEnter={(e) => { if (!drillCategory) e.currentTarget.style.background = '#f1f5f9'; }}
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
                    <div className="section-number">{nextSection()}</div>
                    <h2>🗺️ GIS 다중 히트맵 분석</h2>
                </div>
                <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '12px' }}>
                    탭을 전환하여 전체 밀집도, 업종별 분포, 추정 유동인구, 소비 활성화 지수 등 다양한 관점의 히트맵을 확인하세요.
                </p>
                <HeatMap center={[location.latitude, location.longitude]} points={heatmapData} radius={radius} multiHeatmaps={multiHeatmaps} />
            </div>

            {/* 4. 프리미엄 부동산/입지 분석 */}
            <div className="report-section">
                <div className="section-header">
                    <div className="section-number" style={{ background: '#ec4899', color: 'white' }}>{nextSection()}</div>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        🏢 프리미엄 부동산 / 입지 분석
                        <span style={{ fontSize: '10px', background: '#fef08a', color: '#854d0e', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>PRO</span>
                    </h2>
                </div>
                <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '16px' }}>
                    브이월드(Vworld) 국가공간정보를 활용하여 타겟 상권의 입체적 스카이라인과 토지 용도(상업/주거 등)를 심층 분석합니다.
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
                    <div className="section-number">{nextSection()}</div>
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
                        <div className="section-number">{nextSection()}</div>
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

            {/* 7. SWOT 분석 */}
            <div className="report-section">
                <div className="section-header">
                    <div className="section-number">{nextSection()}</div>
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

            {/* 7-1. 실거래 트렌드 */}
            {aiComments.realEstateTrend && (
                <div className="report-section">
                    <div className="section-header">
                        <div className="section-number" style={{ background: '#3b82f6', color: 'white' }}>{sectionNum}-1</div>
                        <h2>🏢 최신 부동산 실거래 6개월 동향</h2>
                    </div>
                    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '16px', fontSize: '14px', lineHeight: '1.8', whiteSpace: 'pre-line', color: '#1e3a8a' }}
                         dangerouslySetInnerHTML={{ __html: aiComments.realEstateTrend.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #1d4ed8;">$1</strong>') }} />

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
                    <div className="section-number">{nextSection()}</div>
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
                    dangerouslySetInnerHTML={{ __html: aiComments.overview.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
            </div>
        </>
    );
}
