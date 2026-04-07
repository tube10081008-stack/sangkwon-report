import { useState, useEffect } from 'react';

/**
 * 코라/사용자 메시지 버블 컴포넌트
 * - 마크다운 볼드(**텍스트**) 지원
 * - 타이핑 애니메이션 (코라 thinking 상태)
 * - 인라인 차트 렌더링
 */
export default function ChatBubble({ message }) {
    const isCora = message.role === 'cora' || message.role === 'model';
    const [displayText, setDisplayText] = useState('');
    const [isTyping, setIsTyping] = useState(false);

    useEffect(() => {
        if (isCora && message.content && !message.isThinking) {
            setIsTyping(true);
            let idx = 0;
            const text = message.content;
            const speed = Math.max(5, Math.min(15, 2000 / text.length));
            const timer = setInterval(() => {
                idx += 3;
                if (idx >= text.length) {
                    setDisplayText(text);
                    setIsTyping(false);
                    clearInterval(timer);
                } else {
                    setDisplayText(text.substring(0, idx));
                }
            }, speed);
            return () => clearInterval(timer);
        } else if (!isCora) {
            setDisplayText(message.content);
        }
    }, [message.content, isCora, message.isThinking]);

    // 마크다운 볼드(**text**) → <strong>
    const renderMarkdown = (text) => {
        if (!text) return '';
        const parts = text.split(/(\*\*[^*]+\*\*)/g);
        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i} className="cora-bold">{part.slice(2, -2)}</strong>;
            }
            // 줄바꿈 처리
            return part.split('\n').map((line, j, arr) => (
                <span key={`${i}-${j}`}>
                    {line}
                    {j < arr.length - 1 && <br />}
                </span>
            ));
        });
    };

    // 코라 "생각 중" 상태
    if (message.isThinking) {
        return (
            <div className="chat-bubble-row cora-row">
                <img src="/cora-avatar.png" alt="Cora" className="chat-avatar" />
                <div className="chat-bubble cora-bubble thinking-bubble">
                    <div className="thinking-dots">
                        <span></span><span></span><span></span>
                    </div>
                    <span className="thinking-text">분석 중이에요...</span>
                </div>
            </div>
        );
    }

    // 사용자 메시지
    if (!isCora) {
        return (
            <div className="chat-bubble-row user-row">
                <div className="chat-bubble user-bubble">
                    {renderMarkdown(message.content)}
                </div>
            </div>
        );
    }

    // 코라 메시지
    return (
        <div className="chat-bubble-row cora-row">
            <img src="/cora-avatar.png" alt="Cora" className="chat-avatar" />
            <div className="chat-bubble-wrap">
                <div className="chat-bubble cora-bubble">
                    {renderMarkdown(displayText)}
                    {isTyping && <span className="typing-cursor">|</span>}
                </div>

                {/* 인라인 차트 (레이더) */}
                {!isTyping && message.chartData && message.chartData.type === 'radar' && (
                    <div className="inline-chart-card">
                        <div className="inline-chart-header">📊 상권 6대 지표</div>
                        <div className="radar-grid">
                            {message.chartData.labels.map((label, i) => (
                                <div key={i} className="radar-bar-item">
                                    <span className="radar-bar-label">{label}</span>
                                    <div className="radar-bar-track">
                                        <div
                                            className="radar-bar-fill"
                                            style={{
                                                width: `${message.chartData.values[i]}%`,
                                                animationDelay: `${i * 0.1}s`
                                            }}
                                        ></div>
                                    </div>
                                    <span className="radar-bar-value">{message.chartData.values[i]}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 비교 차트 */}
                {!isTyping && message.chartData && message.chartData.type === 'comparison' && (
                    <div className="inline-chart-card">
                        <div className="inline-chart-header">⚖️ 상권 비교</div>
                        <div className="compare-legend">
                            <span className="compare-label-1">🔵 {message.chartData.label1}</span>
                            <span className="compare-label-2">🟣 {message.chartData.label2}</span>
                        </div>
                        <div className="radar-grid">
                            {message.chartData.labels.map((label, i) => (
                                <div key={i} className="compare-bar-item">
                                    <span className="radar-bar-label">{label}</span>
                                    <div className="compare-bar-pair">
                                        <div className="radar-bar-track">
                                            <div className="radar-bar-fill bar-fill-1" style={{ width: `${message.chartData.values1[i]}%` }}></div>
                                        </div>
                                        <div className="radar-bar-track">
                                            <div className="radar-bar-fill bar-fill-2" style={{ width: `${message.chartData.values2[i]}%` }}></div>
                                        </div>
                                    </div>
                                    <span className="radar-bar-value">{message.chartData.values1[i]} vs {message.chartData.values2[i]}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
