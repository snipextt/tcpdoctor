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
    isDocked?: boolean;
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
    isDocked = false,
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
        if (isOpen) {
            scrollToBottom();
        }
    }, [messages, isOpen]);

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
            if (result && typeof result.answer === 'string') {
                addMessage('assistant', result.answer);
            } else if (result && (result as any).Answer) {
                addMessage('assistant', (result as any).Answer);
            } else {
                addMessage('assistant', "I received an empty or invalid response from the network analysis engine.");
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
            let reportContent = `## Health Report: ${report.score}/100\n\n${report.summary}\n\n`;

            if (report.highlights?.length > 0) {
                reportContent += '### ✅ Highlights\n' + report.highlights.map(h => `• ${h}`).join('\n') + '\n\n';
            }
            if (report.concerns?.length > 0) {
                reportContent += '### ⚠️ Concerns\n' + report.concerns.map(c => `• ${c}`).join('\n') + '\n\n';
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
            let diagContent = `## ${severityIcon} Diagnosis\n\n${result.summary}\n\n`;

            if (result.issues?.length > 0) {
                diagContent += '### Issues\n' + result.issues.map(i => `• ${i}`).join('\n') + '\n\n';
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

    const panelClass = isDocked ? 'ai-docked-panel' : 'ai-full-panel';

    return (
        <div className={`ai-assistant-container ${panelClass} animate-slide-in-right`}>
            {/* Header */}
            <div className="ai-header">
                <div className="ai-header-title">
                    <span className="ai-icon">✨</span>
                    <h3>TCP Doctor AI</h3>
                    {!isConfigured && <span className="badge warning">No API Key</span>}
                </div>
                <button className="btn-close" onClick={onClose}>×</button>
            </div>

            <div className="ai-body">
                {/* Messages */}
                <div className="ai-messages">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`message ${msg.role}`}>
                            <div className="message-content">
                                {msg.content.split('\n').map((line, i) => {
                                    if (line.startsWith('##')) {
                                        return <h2 key={i}>{line.replace(/^#+\s*/, '')}</h2>;
                                    }
                                    if (line.startsWith('###')) {
                                        return <h3 key={i}>{line.replace(/^#+\s*/, '')}</h3>;
                                    }
                                    if (line.startsWith('•')) {
                                        return <div key={i} className="bullet">{line}</div>;
                                    }
                                    return (
                                        <p key={i} dangerouslySetInnerHTML={{
                                            __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                        }} />
                                    );
                                })}
                            </div>
                            <div className="message-time">
                                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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

                {!isConfigured && (
                    <div className="config-overlay animate-fade">
                        <div className="config-card">
                            <span className="icon">🔑</span>
                            <p>AI features require a Gemini API key to query the network analysis engine.</p>
                            <button className="btn-primary" onClick={onConfigureAPI}>
                                Configure Gemini
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Input & Quick Actions */}
            <div className="ai-footer">
                {isConfigured && (
                    <div className="quick-actions">
                        <button
                            className="btn-quick"
                            onClick={handleDiagnose}
                            disabled={isLoading || !onDiagnose}
                        >
                            🔍 Diagnose
                        </button>
                        <button
                            className="btn-quick"
                            onClick={handleGenerateReport}
                            disabled={isLoading}
                        >
                            📊 Report
                        </button>
                    </div>
                )}

                <div className="ai-input-wrapper">
                    <textarea
                        className="ai-input"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder={isConfigured ? "Ask about traffic..." : "Configure API..."}
                        disabled={!isConfigured || isLoading}
                        rows={1}
                    />
                    <button
                        className="btn-send"
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
