import { useState, useEffect, useMemo } from 'react';

/**
 * 코라/사용자 메시지 버블 컴포넌트
 * - 마크다운 볼드(**텍스트**), 이탤릭(*텍스트*), 제목(###) 지원
 * - 코드 블록 (```json ... ```) 에서 차트 데이터 자동 추출
 * - 인라인 차트 렌더링 (radar / comparison)
 * - [CHART:radar], [CHART:bar] 태그 파싱
 */

// 텍스트에서 차트 JSON 코드 블록을 추출
function extractChartFromText(text) {
    if (!text) return { cleanText: text, extractedChart: null };

    // ```json ... ``` 코드 블록에서 차트 데이터 추출 시도
    const codeBlockRegex = /```(?:json)?\s*\n?\{[\s\S]*?"labels"\s*:\s*\[[\s\S]*?\]\s*[\s\S]*?"data(?:sets)?"\s*:[\s\S]*?\}\s*\n?```/gi;
    const match = text.match(codeBlockRegex);
    
    let extractedChart = null;
    let cleanText = text;

    if (match) {
        for (const block of match) {
            try {
                const jsonStr = block.replace(/```(?:json)?\s*\n?/, '').replace(/\n?```$/, '').trim();
                const parsed = JSON.parse(jsonStr);
                
                if (parsed.labels && Array.isArray(parsed.labels)) {
                    // 차트 데이터 변환
                    let values = [];
                    if (parsed.datasets && parsed.datasets[0]?.data) {
                        values = parsed.datasets[0].data;
                    } else if (parsed.data) {
                        values = parsed.data;
                    }
                    
                    if (values.length > 0) {
                        extractedChart = {
                            type: 'radar',
                            labels: parsed.labels,
                            values: values,
                            label: parsed.datasets?.[0]?.label || parsed.label || '상권 지표'
                        };
                        // 코드 블록 제거
                        cleanText = cleanText.replace(block, '').trim();
                    }
                }
            } catch (e) {
                // JSON 파싱 실패 → 코드 블록으로 표시
            }
        }
    }

    // [CHART:radar] 또는 [CHART:bar] 태그도 제거
    cleanText = cleanText.replace(/\[CHART:(radar|bar|heatmap)\]/gi, '').trim();
    // [MAP:heatmap] 태그도 제거
    cleanText = cleanText.replace(/\[MAP:\w+\]/gi, '').trim();

    return { cleanText, extractedChart };
}

// 향상된 마크다운 렌더링
function renderEnhancedMarkdown(text) {
    if (!text) return null;

    const lines = text.split('\n');
    const elements = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // ### 헤딩
        if (line.startsWith('### ')) {
            elements.push(
                <h3 key={i} style={{ fontSize: '16px', fontWeight: 700, color: '#fbbf24', margin: '16px 0 8px', letterSpacing: '-0.01em' }}>
                    {renderInline(line.slice(4))}
                </h3>
            );
            continue;
        }

        // --- 구분선
        if (line.trim() === '---' || line.trim() === '───') {
            elements.push(
                <hr key={i} style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '12px 0' }} />
            );
            continue;
        }

        // 빈 줄
        if (line.trim() === '') {
            elements.push(<div key={i} style={{ height: '8px' }} />);
            continue;
        }

        // 일반 텍스트 (인라인 마크다운 적용)
        elements.push(
            <div key={i} style={{ lineHeight: 1.7 }}>
                {renderInline(line)}
            </div>
        );
    }

    return elements;
}

// 인라인 마크다운: **볼드**, *이탤릭*, `코드`
function renderInline(text) {
    if (!text) return '';
    
    // **bold** → <strong>, *italic* → <em>, `code` → <code>
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="cora-bold">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
            return <em key={i} style={{ color: '#94a3b8', fontStyle: 'italic' }}>{part.slice(1, -1)}</em>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
            return (
                <code key={i} style={{ background: 'rgba(6,182,212,0.15)', padding: '2px 6px', borderRadius: '4px', fontSize: '13px', color: '#06b6d4' }}>
                    {part.slice(1, -1)}
                </code>
            );
        }
        return part;
    });
}

// 인라인 바 차트 컴포넌트 (radar 대체)
function InlineBarChart({ chartData }) {
    const labels = chartData.labels || [];
    const values = chartData.values || [];
    const title = chartData.label || '상권 6대 지표';

    return (
        <div className="inline-chart-card">
            <div className="inline-chart-header">📊 {title}</div>
            <div className="radar-grid">
                {labels.map((label, i) => (
                    <div key={i} className="radar-bar-item">
                        <span className="radar-bar-label">{label}</span>
                        <div className="radar-bar-track">
                            <div
                                className="radar-bar-fill"
                                style={{
                                    width: `${values[i]}%`,
                                    animationDelay: `${i * 0.1}s`
                                }}
                            ></div>
                        </div>
                        <span className="radar-bar-value">{values[i]}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function ChatBubble({ message }) {
    const isCora = message.role === 'cora' || message.role === 'model';
    const [displayText, setDisplayText] = useState('');
    const [isTyping, setIsTyping] = useState(false);

    // 차트 데이터 추출 (텍스트 내 JSON 포함 대응)
    const { cleanText, extractedChart } = useMemo(() => {
        return extractChartFromText(message.content);
    }, [message.content]);

    // 최종 차트 데이터: props > 추출 데이터
    const finalChart = message.chartData || extractedChart;

    useEffect(() => {
        if (isCora && cleanText && !message.isThinking) {
            setIsTyping(true);
            let idx = 0;
            const text = cleanText;
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
    }, [cleanText, isCora, message.isThinking]);

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
                    {renderEnhancedMarkdown(message.content)}
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
                    {renderEnhancedMarkdown(displayText)}
                    {isTyping && <span className="typing-cursor">|</span>}
                </div>

                {/* 인라인 차트 (radar / bar) */}
                {!isTyping && finalChart && finalChart.type === 'radar' && (
                    <InlineBarChart chartData={finalChart} />
                )}

                {/* 비교 차트 */}
                {!isTyping && finalChart && finalChart.type === 'comparison' && (
                    <div className="inline-chart-card">
                        <div className="inline-chart-header">⚖️ 상권 비교</div>
                        <div className="compare-legend">
                            <span className="compare-label-1">🔵 {finalChart.label1}</span>
                            <span className="compare-label-2">🟣 {finalChart.label2}</span>
                        </div>
                        <div className="radar-grid">
                            {finalChart.labels.map((label, i) => (
                                <div key={i} className="compare-bar-item">
                                    <span className="radar-bar-label">{label}</span>
                                    <div className="compare-bar-pair">
                                        <div className="radar-bar-track">
                                            <div className="radar-bar-fill bar-fill-1" style={{ width: `${finalChart.values1[i]}%` }}></div>
                                        </div>
                                        <div className="radar-bar-track">
                                            <div className="radar-bar-fill bar-fill-2" style={{ width: `${finalChart.values2[i]}%` }}></div>
                                        </div>
                                    </div>
                                    <span className="radar-bar-value">{finalChart.values1[i]} vs {finalChart.values2[i]}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
