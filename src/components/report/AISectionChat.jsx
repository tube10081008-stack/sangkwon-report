import React, { useState } from 'react';

export default function AISectionChat({ sectionName, suggestedQuestions, contextData }) {
    const [messages, setMessages] = useState([]);
    const [customQuestion, setCustomQuestion] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    const handleAskOptions = async (question) => {
        setIsExpanded(true);
        const newMessages = [...messages, { role: 'user', content: question }];
        setMessages(newMessages);
        setCustomQuestion('');
        await fetchAnswer(question, newMessages);
    };

    const handleCustomAsk = (e) => {
        e.preventDefault();
        if (!customQuestion.trim()) return;
        handleAskOptions(customQuestion.trim());
    };

    const fetchAnswer = async (question, currentMessages) => {
        setIsLoading(true);

        try {
            // 프로젝트 설정에 따라 호스트 포트 변경 가능 로직 처리 (상대 경로로 호출)
            const response = await fetch('/api/ask-ai', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    prompt: question,
                    contextData: contextData,
                    sectionName: sectionName
                })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'AI 서버 오류');
            }

            setMessages([...currentMessages, { role: 'ai', content: data.answer }]);
        } catch (error) {
            setMessages([...currentMessages, { role: 'error', content: `[에러 발생] ${error.message}` }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{ marginTop: '20px', padding: '16px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>🤖</span>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#334155' }}>이 섹션의 데이터를 기반으로 AI에게 물어보세요!</h4>
            </div>

            {/* 추천 질문 버튼 그룹 */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
                {suggestedQuestions.map((q, idx) => (
                    <button
                        key={idx}
                        onClick={() => handleAskOptions(q)}
                        disabled={isLoading}
                        style={{
                            padding: '8px 12px', fontSize: '13px', background: '#ffffff',
                            border: '1px solid #cbd5e1', borderRadius: '20px', color: '#475569',
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', gap: '6px',
                            transition: 'all 0.2s',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                        }}
                        onMouseOver={(e) => { if(!isLoading) { e.target.style.borderColor = '#6366f1'; e.target.style.color = '#6366f1'; } }}
                        onMouseOut={(e) => { if(!isLoading) { e.target.style.borderColor = '#cbd5e1'; e.target.style.color = '#475569'; } }}
                    >
                        💡 {q}
                    </button>
                ))}
            </div>

            {/* 자율 질문 폼 */}
            <form onSubmit={handleCustomAsk} style={{ display: 'flex', gap: '8px', marginBottom: isExpanded ? '16px' : '0' }}>
                <input
                    type="text"
                    value={customQuestion}
                    onChange={(e) => setCustomQuestion(e.target.value)}
                    placeholder="이 섹션의 데이터에 대해 궁금한 점을 자유롭게 물어보세요..."
                    disabled={isLoading}
                    style={{
                        flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1',
                        fontSize: '14px', outline: 'none'
                    }}
                />
                <button
                    type="submit"
                    disabled={isLoading || !customQuestion.trim()}
                    style={{
                        background: isLoading || !customQuestion.trim() ? '#94a3b8' : '#6366f1',
                        color: 'white', padding: '0 20px', borderRadius: '8px', border: 'none',
                        fontWeight: 600, cursor: isLoading || !customQuestion.trim() ? 'not-allowed' : 'pointer'
                    }}
                >
                    질문하기
                </button>
            </form>

            {/* 채팅 이력 */}
            {isExpanded && (
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {messages.map((msg, idx) => (
                        <div key={idx} style={{
                            display: 'flex', gap: '12px',
                            flexDirection: msg.role === 'user' ? 'row-reverse' : 'row'
                        }}>
                            <div style={{ fontSize: '24px' }}>
                                {msg.role === 'user' ? '👤' : msg.role === 'error' ? '⚠️' : '✨'}
                            </div>
                            <div style={{
                                background: msg.role === 'user' ? '#6366f1' : msg.role === 'error' ? '#fee2e2' : '#ffffff',
                                color: msg.role === 'user' ? '#ffffff' : msg.role === 'error' ? '#b91c1c' : '#334155',
                                padding: '12px 16px', borderRadius: '12px', border: msg.role === 'user' ? 'none' : '1px solid #e2e8f0',
                                maxWidth: '85%', fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-line',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                            }} dangerouslySetInnerHTML={{ __html: msg.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                        </div>
                    ))}
                    {isLoading && (
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <div style={{ fontSize: '24px' }}>✨</div>
                            <div style={{
                                background: '#ffffff', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0',
                                color: '#64748b', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px'
                            }}>
                                <span className="spinner" style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid #cbd5e1', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></span>
                                Gemini 2.5 Flash가 상권 데이터를 분석하며 답변을 작성 중입니다...
                            </div>
                        </div>
                    )}
                </div>
            )}
            
            <style jsx>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
