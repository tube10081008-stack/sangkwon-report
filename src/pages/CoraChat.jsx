import { useState, useRef, useEffect } from 'react';
import ChatBubble from '../components/chat/ChatBubble';
import ChatInput from '../components/chat/ChatInput';

const API_BASE = import.meta.env.PROD ? '' : 'http://localhost:3001';

export default function CoraChat() {
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [sessionId] = useState(() => 'cora_' + Date.now());
    const [showWelcome, setShowWelcome] = useState(true);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        fetch(`${API_BASE}/api/cora/suggestions`)
            .then(r => r.json())
            .then(d => { if (d.success) setSuggestions(d.suggestions); })
            .catch(() => {});
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const sendMessage = async (text) => {
        if (!text.trim() || isLoading) return;
        setShowWelcome(false);

        const userMsg = { role: 'user', content: text, timestamp: Date.now() };
        setMessages(prev => [...prev, userMsg]);
        setIsLoading(true);

        // 코라 "생각 중" 상태
        const thinkingId = Date.now();
        setMessages(prev => [...prev, { role: 'cora', content: '', isThinking: true, id: thinkingId }]);

        try {
            const res = await fetch(`${API_BASE}/api/cora/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text, sessionId })
            });
            const data = await res.json();

            // "생각 중" 메시지를 실제 응답으로 교체
            setMessages(prev => prev.filter(m => m.id !== thinkingId).concat({
                role: 'cora',
                content: data.response || '응답을 받지 못했어요 😢',
                chartData: data.chartData || null,
                timestamp: Date.now()
            }));
        } catch (err) {
            setMessages(prev => prev.filter(m => m.id !== thinkingId).concat({
                role: 'cora',
                content: `네트워크 오류가 발생했어요 😢\n\n다시 시도해 주세요!`,
                timestamp: Date.now()
            }));
        } finally {
            setIsLoading(false);
        }
    };

    const resetChat = async () => {
        try {
            await fetch(`${API_BASE}/api/cora/reset`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId })
            });
        } catch (e) {}
        setMessages([]);
        setShowWelcome(true);
    };

    return (
        <div className="cora-chat-page">
            {/* 헤더 */}
            <header className="cora-header">
                <div className="cora-header-left">
                    <img src="/cora-avatar.png" alt="Cora" className="cora-header-avatar" />
                    <div>
                        <h1 className="cora-header-title">코라</h1>
                        <span className="cora-header-subtitle">AI 상권분석 컨설턴트</span>
                    </div>
                </div>
                <div className="cora-header-actions">
                    <a href="/start-analysis" className="cora-header-link">📋 보고서 모드</a>
                    <button onClick={resetChat} className="cora-reset-btn">🔄 새 대화</button>
                </div>
            </header>

            {/* 메시지 영역 */}
            <main className="cora-messages">
                {showWelcome && (
                    <div className="cora-welcome">
                        <div className="cora-welcome-avatar-wrap">
                            <img src="/cora-avatar.png" alt="Cora" className="cora-welcome-avatar" />
                            <div className="cora-welcome-pulse"></div>
                        </div>
                        <h2 className="cora-welcome-title">안녕하세요! 저는 <span className="cora-name-highlight">코라</span>예요 ✨</h2>
                        <p className="cora-welcome-desc">상권 분석의 모든 것을 도와드릴게요.<br/>궁금한 동네 주소를 알려주시면, 바로 분석 시작할게요! 🏘️</p>

                        <div className="cora-suggestions">
                            {suggestions.map((s, i) => (
                                <button
                                    key={i}
                                    className="cora-suggestion-chip"
                                    onClick={() => sendMessage(s.text)}
                                    style={{ animationDelay: `${i * 0.1}s` }}
                                >
                                    <span className="cora-chip-icon">{s.icon}</span>
                                    <span>{s.text}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <ChatBubble key={i} message={msg} />
                ))}
                <div ref={messagesEndRef} />
            </main>

            {/* 입력 영역 */}
            <ChatInput onSend={sendMessage} isLoading={isLoading} suggestions={!showWelcome && messages.length < 3 ? suggestions : []} />
        </div>
    );
}
