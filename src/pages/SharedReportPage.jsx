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
                const res = await fetch(`/api/reports/${id}`);
                const json = await res.json();
                if (!res.ok) throw new Error(json.error);
                setReport(json.report);
            } catch (err) {
                setError(err.message);
            }
            setLoading(false);
        };
        fetchReport();
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
