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
            <div style={{ fontSize: '64px', marginBottom: '20px' }}>🚫</div>
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

            {/* 
                보안상 숨겨진 분석 시작 버튼 
                (투명도 0이지만 클릭 가능하거나, 특정 제스처로 활성화)
                여기서는 간단히 아래쪽에 작게 표시
            */}
            <button
                onClick={() => navigate('/start-analysis')}
                style={{
                    padding: '8px 16px',
                    background: 'transparent',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    color: '#cbd5e1',
                    fontSize: '12px',
                    cursor: 'pointer',
                    marginTop: '80px'
                }}
            >
                관리자 로그인 / 분석 시작
            </button>
        </div>
    );
}
