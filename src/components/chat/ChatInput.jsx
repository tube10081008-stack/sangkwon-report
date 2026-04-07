import { useState, useRef, useEffect } from 'react';

/**
 * 코라 채팅 입력 컴포넌트
 * - 자동 높이 조절 textarea
 * - Shift+Enter 줄바꿈, Enter 전송
 * - 로딩 상태 표시
 */
export default function ChatInput({ onSend, isLoading, suggestions = [] }) {
    const [text, setText] = useState('');
    const textareaRef = useRef(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
        }
    }, [text]);

    const handleSubmit = () => {
        if (!text.trim() || isLoading) return;
        onSend(text.trim());
        setText('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <footer className="cora-input-area">
            {suggestions.length > 0 && (
                <div className="cora-input-suggestions">
                    {suggestions.slice(0, 3).map((s, i) => (
                        <button key={i} className="cora-mini-chip" onClick={() => onSend(s.text)}>
                            {s.icon} {s.text}
                        </button>
                    ))}
                </div>
            )}
            <div className="cora-input-row">
                <textarea
                    ref={textareaRef}
                    className="cora-textarea"
                    placeholder={isLoading ? '코라가 분석 중이에요...' : '코라에게 물어보세요... (Enter로 전송)'}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isLoading}
                    rows={1}
                />
                <button
                    className={`cora-send-btn ${text.trim() && !isLoading ? 'active' : ''}`}
                    onClick={handleSubmit}
                    disabled={!text.trim() || isLoading}
                >
                    {isLoading ? (
                        <span className="cora-send-spinner"></span>
                    ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                        </svg>
                    )}
                </button>
            </div>
            <p className="cora-disclaimer">코라는 공공데이터 기반 AI 분석을 제공합니다. 실제 창업 의사결정 시 전문가 상담을 병행해주세요.</p>
        </footer>
    );
}
