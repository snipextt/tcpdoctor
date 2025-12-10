import React, { useState, useRef, useEffect } from 'react';
import './AIAssistant.css';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

interface DiagnosticResult {
    summary: string;
    issues: string[];
    possibleCauses: string[];
    recommendations: string[];
    severity: string;
}

interface QueryResult {
    answer: string;
    success: boolean;
}

interface HealthReport {
    summary: string;
    highlights: string[];
    concerns: string[];
    suggestions: string[];
    score: number;
}

interface AIAssistantProps {
    isOpen: boolean;
    onClose: () => void;
    onConfigureAPI: () => void;
    isConfigured: boolean;
    // Wails bindings
    queryConnections: (query: string) => Promise<QueryResult>;
    generateHealthReport: () => Promise<HealthReport>;
    onDiagnose?: () => Promise<DiagnosticResult | null>;
    selectedConnectionInfo?: string;
}

const AIAssistant: React.FC<AIAssistantProps> = ({
    isOpen,
    onClose,
    onConfigureAPI,
    isConfigured,
    queryConnections,
    generateHealthReport,
    onDiagnose,
    selectedConnectionInfo,
}) => {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            content: 'Hello! I\'m your TCP Doctor AI Assistant. I can help you:\n\n• **Analyze connections** - Ask about your network traffic\n• **Diagnose issues** - Select a connection and click "Diagnose"\n• **Generate reports** - Get a full network health summary\n\nHow can I help you today?',
            timestamp: new Date(),
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const addMessage = (role: 'user' | 'assistant', content: string) => {
        const newMessage: Message = {
            id: Date.now().toString(),
            role,
            content,
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, newMessage]);
    };

    const handleSend = async () => {
        if (!input.trim() || isLoading || !isConfigured) return;

        const userQuery = input.trim();
        setInput('');
        addMessage('user', userQuery);
        setIsLoading(true);

        try {
            const result = await queryConnections(userQuery);
            if (result.success) {
                addMessage('assistant', result.answer);
            } else {
                addMessage('assistant', '❌ ' + result.answer);
            }
        } catch (error) {
            addMessage('assistant', `❌ Error: ${error}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerateReport = async () => {
        if (isLoading || !isConfigured) return;

        setIsLoading(true);
        addMessage('user', '📊 Generate network health report');

        try {
            const report = await generateHealthReport();
            let reportContent = `## Network Health Report\n\n**Score: ${report.score}/100**\n\n${report.summary}\n\n`;

            if (report.highlights?.length > 0) {
                reportContent += '### ✅ Highlights\n' + report.highlights.map(h => `• ${h}`).join('\n') + '\n\n';
            }
            if (report.concerns?.length > 0) {
                reportContent += '### ⚠️ Concerns\n' + report.concerns.map(c => `• ${c}`).join('\n') + '\n\n';
            }
            if (report.suggestions?.length > 0) {
                reportContent += '### 💡 Suggestions\n' + report.suggestions.map(s => `• ${s}`).join('\n');
            }

            addMessage('assistant', reportContent);
        } catch (error) {
            addMessage('assistant', `❌ Failed to generate report: ${error}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDiagnose = async () => {
        if (!onDiagnose || isLoading || !isConfigured) return;

        setIsLoading(true);
        addMessage('user', `🔍 Diagnose connection: ${selectedConnectionInfo || 'selected'}`);

        try {
            const result = await onDiagnose();
            if (!result) {
                addMessage('assistant', '⚠️ Please select a connection to diagnose.');
                return;
            }

            const severityIcon = result.severity === 'healthy' ? '✅' : result.severity === 'warning' ? '⚠️' : '❌';
            let diagContent = `## ${severityIcon} Connection Diagnosis\n\n**${result.summary}**\n\n`;

            if (result.issues?.length > 0) {
                diagContent += '### Issues Detected\n' + result.issues.map(i => `• ${i}`).join('\n') + '\n\n';
            }
            if (result.possibleCauses?.length > 0) {
                diagContent += '### Possible Causes\n' + result.possibleCauses.map(c => `• ${c}`).join('\n') + '\n\n';
            }
            if (result.recommendations?.length > 0) {
                diagContent += '### Recommendations\n' + result.recommendations.map(r => `• ${r}`).join('\n');
            }

            addMessage('assistant', diagContent);
        } catch (error) {
            addMessage('assistant', `❌ Diagnosis failed: ${error}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (!isOpen) return null;

    return (
        <div className={`ai-assistant-overlay ${isOpen ? 'open' : ''}`}>
            <div className="ai-assistant-panel">
                {/* Header */}
                <div className="ai-header">
                    <div className="ai-header-title">
                        <span className="ai-icon">🤖</span>
                        <h3>AI Assistant</h3>
                        {!isConfigured && <span className="not-configured-badge">Not Configured</span>}
                    </div>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                {/* Not configured message */}
                {!isConfigured && (
                    <div className="config-prompt">
                        <p>AI features require a Gemini API key.</p>
                        <button className="btn-primary" onClick={onConfigureAPI}>
                            Configure API Key
                        </button>
                    </div>
                )}

                {/* Messages */}
                <div className="ai-messages">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`message ${msg.role}`}>
                            <div className="message-content">
                                {msg.content.split('\n').map((line, i) => (
                                    <span key={i}>
                                        {line.startsWith('##') ? <strong>{line.replace(/^#+\s*/, '')}</strong> :
                                            line.startsWith('###') ? <em><strong>{line.replace(/^#+\s*/, '')}</strong></em> :
                                                line.startsWith('•') ? <span className="bullet">{line}</span> :
                                                    line.includes('**') ? <span dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} /> :
                                                        line}
                                        <br />
                                    </span>
                                ))}
                            </div>
                            <div className="message-time">
                                {msg.timestamp.toLocaleTimeString()}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="message assistant loading">
                            <div className="typing-indicator">
                                <span></span><span></span><span></span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Quick Actions */}
                {isConfigured && (
                    <div className="quick-actions">
                        <button
                            className="action-btn"
                            onClick={handleDiagnose}
                            disabled={isLoading || !onDiagnose}
                            title="Diagnose selected connection"
                        >
                            🔍 Diagnose
                        </button>
                        <button
                            className="action-btn"
                            onClick={handleGenerateReport}
                            disabled={isLoading}
                            title="Generate network health report"
                        >
                            📊 Health Report
                        </button>
                    </div>
                )}

                {/* Input */}
                <div className="ai-input-container">
                    <textarea
                        className="ai-input"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder={isConfigured ? "Ask about your connections..." : "Configure API key to start..."}
                        disabled={!isConfigured || isLoading}
                        rows={1}
                    />
                    <button
                        className="send-btn"
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading || !isConfigured}
                    >
                        ➤
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AIAssistant;
