import React, { useState } from 'react';

export default function RealEstatePanel({ data }) {
    if (!data || !data.summary) return null;

    const [activeTab, setActiveTab] = useState('commTrade');
    const { summary, topTransactions } = data;

    const tabs = [
        { id: 'commTrade', label: '상업/업무용 매매', count: summary.commTotal6Months, emoji: '🏢' },
        { id: 'aptTrade', label: '아파트 매매', count: summary.aptTotal6Months, emoji: '🏢' },
        { id: 'aptRent', label: '아파트 전월세', count: summary.aptRentTotal6Months, emoji: '🏠' },
        { id: 'offiTrade', label: '오피스텔 매매', count: summary.offiTotal6Months, emoji: '🏙️' },
    ];

    const currentTransactions = topTransactions[activeTab] || [];

    return (
        <div style={{ marginTop: '20px' }}>
            {/* 상단 탭 (Grid 레이아웃으로 변경하여 시각적 통일감 제공) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', marginBottom: '20px' }}>
                {tabs.map(tab => (
                    <div 
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            padding: '12px',
                            background: activeTab === tab.id ? '#3b82f6' : '#ffffff',
                            color: activeTab === tab.id ? 'white' : '#475569',
                            borderRadius: '12px',
                            border: `1px solid ${activeTab === tab.id ? '#3b82f6' : '#cbd5e1'}`,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            textAlign: 'center',
                            boxShadow: activeTab === tab.id ? '0 4px 6px -1px rgba(59, 130, 246, 0.3)' : '0 1px 2px rgba(0,0,0,0.05)'
                        }}
                    >
                        <div style={{ fontSize: '20px', marginBottom: '4px' }}>{tab.emoji}</div>
                        <div style={{ fontWeight: '600', fontSize: '13px' }}>{tab.label}</div>
                        <div style={{ fontSize: '11px', opacity: 0.9, marginTop: '2px' }}>최근 {tab.count}건</div>
                    </div>
                ))}
            </div>

            {/* 메인 콘텐츠 영역 */}
            <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>최근 6개월 실거래 내역 (최대 10건)</span>
                    <span style={{ fontSize: '12px', background: '#e0e7ff', color: '#4f46e5', padding: '4px 8px', borderRadius: '20px', fontWeight: 'bold' }}>
                        최고가순 정렬
                    </span>
                </h3>
                
                {currentTransactions.length === 0 ? (
                    <div style={{ padding: '30px 0', textAlign: 'center', color: '#94a3b8' }}>
                        최근 6개월 이내 해당 거래 내역이 없습니다.
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {currentTransactions.slice(0, 10).map((tx, idx) => (
                            <div key={idx} style={{ 
                                background: '#ffffff', 
                                border: '1px solid #cbd5e1', 
                                borderRadius: '8px', 
                                padding: '12px 16px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                                flexWrap: 'wrap',
                                gap: '10px'
                            }}>
                                <div style={{ minWidth: '200px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                        {idx === 0 && <span style={{ background: '#fef08a', color: '#854d0e', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>Top 1</span>}
                                        {idx === 1 && <span style={{ background: '#e2e8f0', color: '#475569', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>Top 2</span>}
                                        {idx === 2 && <span style={{ background: '#ffedd5', color: '#9a3412', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>Top 3</span>}
                                        <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#334155' }}>{tx.name}</div>
                                    </div>
                                    <div style={{ fontSize: '13px', color: '#64748b' }}>
                                        {tx.area} {tx.floor ? `· ${tx.floor}층` : ''} {tx.type ? `· ${tx.type}` : ''}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '16px' }}>
                                        {activeTab === 'aptRent' 
                                            ? (tx.monthlyRent !== '0원' ? `보증금 ${tx.deposit} / 월 ${tx.monthlyRent}` : `전세 ${tx.deposit}`) 
                                            : `${tx.price}`}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>계약일: {tx.date}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
