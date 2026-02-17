import { useNavigate } from 'react-router-dom';

export default function AccessDenied() {
    const navigate = useNavigate();

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f8fafc',
            textAlign: 'center',
            padding: '20px'
        }}>
            <div
                style={{ fontSize: '64px', marginBottom: '20px', cursor: 'default', userSelect: 'none' }}
                onClick={(e) => {
                    if (e.shiftKey) {
                        navigate('/start-analysis');
                    }
                }}
                title=""
            >🚫</div>
            <h1 style={{
                fontSize: '24px',
                fontWeight: '800',
                color: '#1e293b',
                marginBottom: '10px'
            }}>접근 권한이 없습니다</h1>
            <p style={{
                color: '#64748b',
                marginBottom: '40px',
                lineHeight: '1.6'
            }}>
                올바른 리포트 링크를 통해 접속해주세요.<br />
                직접적인 페이지 접근은 제한됩니다.
            </p>
        </div>
    );
}
