import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import SingleReport from '../components/report/SingleReport';
import CompareReport from '../components/report/CompareReport';
import StrategyReport from '../components/report/StrategyReport';

import { db } from '../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export default function ReportPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const [sharing, setSharing] = useState(false);
    const [shareUrl, setShareUrl] = useState(null);
    const [copied, setCopied] = useState(false);

    const { type, data, address1, address2, targetCategory, radius } = location.state || {};

    useEffect(() => {
        if (!data) {
            navigate('/');
        }
    }, [data, navigate]);

    if (!data) return null;

    // URL 공유 기능 (Firestore Chunking - Plan B/No Billing)
    const handleShare = async () => {
        setSharing(true);
        try {
            // 2. 고유 ID 생성
            const generateId = () => Math.random().toString(36).substring(2, 10);
            const reportId = generateId();

            // 3. 데이터 직렬화 및 청킹 (Chunking)
            const reportData = { type, data, address1, address2, targetCategory, radius };
            const jsonString = JSON.stringify(reportData);

            // Firestore 문서 제한(1MB)을 고려하여 900KB 단위로 분할
            // Firestore는 UTF-8 바이트 크기를 기준으로 1MiB 제한이 있음.
            // 한글(3바이트)이 포함될 수 있으므로, 안전하게 200KB(약 20만자) 단위로 자름.
            const CHUNK_SIZE = 200 * 1024;
            const totalChunks = Math.ceil(jsonString.length / CHUNK_SIZE);

            // 4. 메인 문서 저장 (메타데이터)
            await setDoc(doc(db, "reports", reportId), {
                id: reportId,
                type,
                address1,
                address2: address2 || null,
                targetCategory: targetCategory || null,
                createdAt: serverTimestamp(),
                chunkCount: totalChunks, // 청크 개수 저장
                totalSize: jsonString.length,
                isChunked: true
            });

            // 5. 청크 데이터 분할 저장 (Batch 사용 권장되나 크기 제한 고려하여 Promise.all 사용)
            const chunkPromises = [];
            for (let i = 0; i < totalChunks; i++) {
                const start = i * CHUNK_SIZE;
                const end = start + CHUNK_SIZE;
                const chunkContent = jsonString.substring(start, end);

                // 서브컬렉션 'chunks'에 저장: reports/{id}/chunks/{index}
                // 문서 ID를 0, 1, 2... 인덱스로 지정하여 정렬 용이하게 함
                const chunkRef = doc(db, "reports", reportId, "chunks", i.toString());
                chunkPromises.push(setDoc(chunkRef, {
                    index: i,
                    content: chunkContent
                }));
            }

            await Promise.all(chunkPromises);

            // 6. 공유 URL 생성
            const url = `${window.location.origin}/shared/${reportId}`;
            setShareUrl(url);

        } catch (err) {
            console.error(err);
            alert(`공유 중 오류가 발생했습니다: ${err.message}`);
        }
        setSharing(false);
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // fallback
            const input = document.createElement('input');
            input.value = shareUrl;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            input.remove();
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const getTitle = () => {
        switch (type) {
            case 'single': return '단일 상권 분석 리포트';
            case 'compare': return '상권 비교 분석 리포트';
            case 'strategy': return '필승전략 가이드 리포트';
            default: return '상권분석 리포트';
        }
    };

    const getSubtitle = () => {
        const date = new Date(data.generatedAt).toLocaleString('ko-KR');
        if (type === 'compare') {
            return `${address1} vs ${address2} | 반경 ${radius}m | ${date}`;
        }
        const addr = data.location?.address || address1;
        return `${addr} | 반경 ${radius}m | ${date}`;
    };

    return (
        <div className="b2b-hub-container report-page">
            <header className="b2b-hub-header" style={{ marginBottom: '24px' }}>
                <div className="b2b-header-brand" style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
                    <span className="b2b-brand-logo">STANBY LAB</span>
                    <span className="b2b-brand-vertical-line"></span>
                    <span className="b2b-brand-subtitle">EXECUTIVE COMMAND CENTER</span>
                </div>
                <div className="b2b-header-status">
                    <div style={{ color: '#06b6d4', fontWeight: 700, fontSize: '14px', border: '1px solid #06b6d4', padding: '6px 12px', borderRadius: '8px', background: 'rgba(6, 182, 212, 0.05)' }}>
                        CHIEF ANALYST : EDDIE
                    </div>
                </div>
            </header>

            <section className="b2b-hero-section" style={{ padding: '0 48px', marginBottom: '24px', textAlign: 'center' }}>
                <h1 className="b2b-hero-title" style={{ fontSize: '32px', marginBottom: '12px' }}>
                    <span style={{ color: '#06b6d4', fontWeight: 700 }}>입지 및 상권 분석 브리핑</span>
                </h1>
                <p className="compare-subtitle b2b-hero-desc" style={{ margin: '0 auto' }}>
                    {getTitle()} · {getSubtitle()}
                </p>
                <div style={{ marginTop: '20px' }}>
                    <button className="report-back-btn" onClick={() => navigate('/')} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>
                        ← 메인 허브로 복귀
                    </button>
                </div>
            </section>

            <div className="report-container" style={{ margin: '0 48px', padding: '20px 0' }}>

                {type === 'single' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <SingleReport data={data} />
                        <div className="b2b-interop-section" style={{
                            marginTop: '24px', padding: '24px', background: 'rgba(212, 175, 55, 0.05)',
                            border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '16px', textAlign: 'center'
                        }}>
                            <h3 style={{ fontSize: '15px', color: '#D4AF37', marginBottom: '8px', fontWeight: 700 }}>
                                ⚖️ 추가적인 매물 비교 분석이 필요하십니까?
                            </h3>
                            <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '16px' }}>
                                현재 조회가 완료된 <strong>{data.location?.address || address1}</strong> 데이터를 유지한 채,<br/>
                                수익성 비교를 위해 <strong>수석 비평관 마리(Mari)</strong>에게 분석을 인계합니다.
                            </p>
                            <button 
                                onClick={() => navigate('/compare', { state: { presetAddressA: address1, radius } })}
                                style={{
                                    padding: '12px 24px', background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                                    border: '1px solid #D4AF37', color: '#FBECC7', borderRadius: '8px',
                                    fontSize: '14px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
                                    boxShadow: '0 4px 12px rgba(212,175,55,0.1)'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.background = '#D4AF37'}
                                onMouseOut={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, #1e293b, #0f172a)'}
                            >
                                🚀 수석 비평관 (Mari) 호출하기 →
                            </button>
                        </div>
                    </div>
                )}
                {type === 'compare' && <CompareReport data={data} address1={address1} address2={address2} />}
                {type === 'strategy' && <StrategyReport data={data} targetCategory={targetCategory} />}

                <div className="report-footer" style={{ marginTop: '40px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px' }}>
                    <p>본 프리미엄 브리핑은 <strong>국토부 및 공공데이터 100% 연동망</strong>을 기반으로 작동합니다.</p>
                    <p>© {new Date().getFullYear()} STANDBY LAB EXECUTIVE | B2B 리서치 허브</p>
                </div>
            </div>

            {/* 공유 버튼 */}
            {!shareUrl ? (
                <button className="share-btn" onClick={handleShare} disabled={sharing}>
                    {sharing ? '⏳ 링크 생성 중...' : '� 리포트 공유하기'}
                </button>
            ) : (
                <div className="share-result">
                    <div className="share-url-box">
                        <input type="text" value={shareUrl} readOnly className="share-url-input" />
                        <button className="share-copy-btn" onClick={handleCopy}>
                            {copied ? '✅ 복사됨!' : '📋 복사'}
                        </button>
                    </div>
                    <p className="share-hint">이 링크를 공유하면 누구나 리포트를 볼 수 있습니다</p>
                </div>
            )}
        </div>
    );
}
