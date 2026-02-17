import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import SingleReport from '../components/report/SingleReport';
import CompareReport from '../components/report/CompareReport';
import StrategyReport from '../components/report/StrategyReport';

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

    // URL 공유 기능
    // URL 공유 기능 (Firebase Direct Upload)
    const handleShare = async () => {
        setSharing(true);
        try {
            // 1. Firebase 모듈 동적 임포트 (초기 로딩 최적화)
            const { db, storage } = await import('../firebase');
            const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
            const { ref, uploadString, getDownloadURL } = await import('firebase/storage');

            // 2. 고유 ID 생성 (nanoid 대체)
            const generateId = () => Math.random().toString(36).substring(2, 10);
            const reportId = generateId();

            // 3. 리포트 데이터 JSON 변환
            const reportData = { type, data, address1, address2, targetCategory, radius };
            const jsonString = JSON.stringify(reportData);

            // 4. Storage에 JSON 파일 업로드 (대용량 데이터 처리)
            const storagePath = `reports/${reportId}.json`;
            const storageRef = ref(storage, storagePath);
            await uploadString(storageRef, jsonString, 'raw', { contentType: 'application/json' });
            const downloadUrl = await getDownloadURL(storageRef);

            // 5. Firestore에 메타데이터 저장
            await setDoc(doc(db, "reports", reportId), {
                id: reportId,
                type,
                address1,
                address2: address2 || null,
                targetCategory: targetCategory || null,
                createdAt: serverTimestamp(),
                storagePath: storagePath, // 나중에 삭제하거나 참조할 때 사용
                downloadUrl: downloadUrl // 공유 페이지에서 바로 fetch 가능
            });

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
