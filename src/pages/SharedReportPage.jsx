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
                const { db } = await import('../firebase');
                const { doc, getDoc, collection, getDocs } = await import('firebase/firestore');

                // 2. 메인 문서 조회 (메타데이터)
                const docRef = doc(db, "reports", id);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const reportMeta = docSnap.data();

                    // Case A: Chunked Data (Plan B)
                    if (reportMeta.isChunked && reportMeta.chunkCount > 0) {
                        const chunkPromises = [];
                        for (let i = 0; i < reportMeta.chunkCount; i++) {
                            // 문서 ID가 인덱스"0", "1" 형식이므로 바로 접근
                            const chunkRef = doc(db, "reports", id, "chunks", i.toString());
                            chunkPromises.push(getDoc(chunkRef));
                        }

                        const chunkSnaps = await Promise.all(chunkPromises);

                        // 모든 청크가 존재하는지 확인 및 순서대로 결합
                        let fullJson = "";
                        chunkSnaps.forEach(snap => {
                            if (snap.exists()) {
                                fullJson += snap.data().content;
                            }
                        });

                        const reportJson = JSON.parse(fullJson);
                        setReport(reportJson);
                    }
                    // Case B: Storage URL (Storage 사용 가능한 경우 / 레거시)
                    else if (reportMeta.downloadUrl) {
                        try {
                            const res = await fetch(reportMeta.downloadUrl);
                            if (res.ok) {
                                const reportJson = await res.json();
                                setReport(reportJson);
                            } else {
                                throw new Error("Storage fetch failed");
                            }
                        } catch (e) {
                            // CORS 등으로 실패 시, 혹시 Firestore에 데이터가 있는지 확인 (아주 옛날 버전)
                            if (reportMeta.data) setReport(reportMeta);
                            else throw e;
                        }
                    }
                    // Case C: Raw Data in Firestore (소용량 레거시)
                    else if (reportMeta.data) {
                        setReport(reportMeta);
                    } else {
                        setError('리포트 데이터를 찾을 수 없습니다.');
                    }
                } else {
                    setError('리포트를 찾을 수 없습니다.');
                }
            } catch (err) {
                console.error(err);
                setError(`리포트 로딩 오류: ${err.message}`);
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
