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
            const CHUNK_SIZE = 900 * 1024;
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
        <div className="report-page">
            <div className="report-header">
                <h1>🎯 {getTitle()}</h1>
                <p>{getSubtitle()}</p>
            </div>

            <div className="report-container">
                <button className="report-back-btn" onClick={() => navigate('/')}>
                    ← 새 분석 시작
                </button>

                {type === 'single' && <SingleReport data={data} />}
                {type === 'compare' && <CompareReport data={data} address1={address1} address2={address2} />}
                {type === 'strategy' && <StrategyReport data={data} targetCategory={targetCategory} />}

                <div className="report-footer">
                    <p>본 리포트는 <strong>공공데이터 API</strong>를 기반으로 자동 생성되었습니다.</p>
                    <p>© {new Date().getFullYear()} 상권분석 리포트 | 데이터 기반 소상공인 컨설팅</p>
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
