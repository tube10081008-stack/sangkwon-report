import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import SingleReport from '../components/report/SingleReport';
import CompareReport from '../components/report/CompareReport';
import StrategyReport from '../components/report/StrategyReport';

export default function SharedReportPage() {
    const { id } = useParams();
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchReport = async () => {
            try {
                // 1. Firebase 모듈 동적 임포트
                const { db, storage } = await import('../firebase');
                const { doc, getDoc } = await import('firebase/firestore');
                const { ref, getDownloadURL } = await import('firebase/storage');

                // 2. Firestore에서 메타데이터(storagePath) 조회
                const docRef = doc(db, "reports", id);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const reportMeta = docSnap.data();

                    // 3. Storage에서 JSON 파일 다운로드 URL 획득
                    // (구버전 호환: storagePath가 없으면 에러 혹은 별도 처리)
                    let jsonUrl = reportMeta.downloadUrl;
                    if (!jsonUrl && reportMeta.storagePath) {
                        jsonUrl = await getDownloadURL(ref(storage, reportMeta.storagePath));
                    }

                    if (jsonUrl) {
                        const res = await fetch(jsonUrl);
                        const reportJson = await res.json();
                        setReport(reportJson);
                    } else {
                        // 레거시: 데이터가 Firestore에 직접 저장된 경우 (초기 개발 버전 등)
                        if (reportMeta.data) {
                            setReport(reportMeta);
                        } else {
                            setError('리포트 데이터를 찾을 수 없습니다.');
                        }
                    }
                } else {
                    // ID로 Firestore 문서 못 찾음 -> 레거시 API 시도 (선택 사항)
                    setError('리포트를 찾을 수 없습니다.');
                }
            } catch (err) {
                console.error(err);
                setError('리포트를 불러오는 중 오류가 발생했습니다.');
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchReport();
        }
    }, [id]);

    if (loading) {
        return (
            <div className="shared-report-loading">
                <div className="loading-spinner" />
                <p>리포트를 불러오는 중...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="shared-report-error">
                <div className="error-icon">📊</div>
                <h2>리포트를 찾을 수 없습니다</h2>
                <p>{error}</p>
            </div>
        );
    }

    const { type, data, address1, address2, targetCategory, radius } = report;

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
        <div className="report-page shared-mode">
            <div className="report-header">
                <div className="shared-badge">🔗 공유된 리포트</div>
                <h1>🎯 {getTitle()}</h1>
                <p>{getSubtitle()}</p>
            </div>

            <div className="report-container">
                {type === 'single' && <SingleReport data={data} />}
                {type === 'compare' && <CompareReport data={data} address1={address1} address2={address2} />}
                {type === 'strategy' && <StrategyReport data={data} targetCategory={targetCategory} />}

                <div className="report-footer">
                    <p>본 리포트는 <strong>공공데이터 API</strong>를 기반으로 자동 생성되었습니다.</p>
                    <p>© {new Date().getFullYear()} 상권분석 리포트 | 데이터 기반 소상공인 컨설팅</p>
                </div>
            </div>
        </div>
    );
}
