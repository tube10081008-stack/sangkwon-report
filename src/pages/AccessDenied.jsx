
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

export default function AccessDenied() {
    const navigate = useNavigate();
    const [clickCount, setClickCount] = useState(0);
    let timeoutId = null; // To store the timeout ID

    const handleSecretClick = (e) => {
        // PC: Shift + Click
        if (e.shiftKey) {
            navigate('/start-analysis');
            return;
        }

        // Clear any existing timeout to prevent premature reset
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        // Mobile: 5번 연속 탭 (2초 내)
        setClickCount(prev => {
            const newCount = prev + 1;
            if (newCount >= 5) {
                navigate('/start-analysis');
                return 0; // Reset count after successful navigation
            }
            return newCount;
        });

        // Set a new timeout to reset the count if no further clicks occur within 500ms
        timeoutId = setTimeout(() => {
            setClickCount(0);
            timeoutId = null; // Clear the stored ID after timeout
        }, 500);
    };

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
                onClick={handleSecretClick}
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
