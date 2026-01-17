import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import './AIAssistant.css';
import AIChart from './AIChart';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    graphs?: GraphSuggestion[];
}

interface DiagnosticResult {
    summary: string;
    issues: string[];
    possibleCauses: string[];
    recommendations: string[];
    severity: string;
    graphs?: GraphSuggestion[];
}

interface GraphDataPoint {
    label: string;
    value: number;
}

interface GraphSuggestion {
    type: string; // 'bar', 'line', or 'pie' - using string for Wails type compatibility
    title: string;
    xLabel?: string;
    yLabel?: string;
    dataPoints: GraphDataPoint[];
}

interface QueryResult {
    answer: string;
    graphs?: GraphSuggestion[];
    success: boolean;
}

interface HealthReport {
    summary: string;
    highlights: string[];
    concerns: string[];
    suggestions: string[];
    score: number;
    graphs?: GraphSuggestion[];
}

interface AIAssistantProps {
    isOpen: boolean;
    onClose: () => void;
    onConfigureAPI: () => void;
    isConfigured: boolean;
    // Wails bindings - queryConnections now accepts history for context
    queryConnections: (query: string, history: Array<{ role: string, content: string }>) => Promise<QueryResult>;
    generateHealthReport: () => Promise<HealthReport>;
    onDiagnose?: () => Promise<DiagnosticResult | null>;
    selectedConnectionInfo?: string;
    isDocked?: boolean;
    contextId: string; // 'live' or 'session-N' for separate chat histories
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
    contextId,
}) => {
    // Context-based chat histories - each context has its own message array
    const [messagesByContext, setMessagesByContext] = useState<Record<string, Message[]>>({});
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Get current context's messages
    const messages = messagesByContext[contextId] || [];

    // Initialize welcome message for new contexts
    useEffect(() => {
        if (!messagesByContext[contextId]) {
            const contextName = contextId === 'live' ? 'Live Dashboard' : `Session #${contextId.replace('session-', '')}`;
            const welcomeMessage: Message = {
                id: `${contextId}-welcome`,
                role: 'assistant',
                content: `Hello! I'm your TCP Doctor AI Assistant for **${contextName}**.\n\nI can help you:\n\n• **Analyze connections** - Ask about network traffic in this context\n• **Diagnose issues** - Select a connection and click "Analyze Connection"\n• **Generate reports** - Get a comprehensive health summary\n\nHow can I help you today?`,
                timestamp: new Date(),
            };
            setMessagesByContext(prev => ({
                ...prev,
                [contextId]: [welcomeMessage]
            }));
        }
    }, [contextId, messagesByContext]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
        }
    }, [messages, isOpen]);

    const addMessage = (role: 'user' | 'assistant', content: string, graphs?: GraphSuggestion[]) => {
        const newMessage: Message = {
            id: `${contextId}-${Date.now()}`,
            role,
            content,
            timestamp: new Date(),
            graphs,
        };
        setMessagesByContext(prev => ({
            ...prev,
            [contextId]: [...(prev[contextId] || []), newMessage]
        }));
    };

    const handleSend = async () => {
        if (!input.trim() || isLoading || !isConfigured) return;

        const userQuery = input.trim();
        setInput('');
        addMessage('user', userQuery);
        setIsLoading(true);

        try {
            // Pass conversation history (excluding welcome message) for context
            // Include graph data so AI can reference its previous visualizations
            const historyForContext = messages
                .filter(m => m.id !== `${contextId}-welcome`)
                .map(m => {
                    let content = m.content;
                    // Append graph info to the content so AI knows what it visualized
                    if (m.graphs && m.graphs.length > 0) {
                        const graphSummary = m.graphs.map(g =>
                            `[Generated Graph: "${g.title}" (${g.type} chart) with data: ${g.dataPoints.map(d => `${d.label}=${d.value}`).join(', ')}]`
                        ).join('\n');
                        content += '\n\n' + graphSummary;
                    }
                    return { role: m.role, content };
                });

            const result = await queryConnections(userQuery, historyForContext);
            if (result && typeof result.answer === 'string') {
                addMessage('assistant', result.answer, result.graphs);
            } else if (result && (result as any).Answer) {
                addMessage('assistant', (result as any).Answer, (result as any).Graphs);
            } else if (result && (result as any).response) {
                // Handle JSON format with response field
                addMessage('assistant', (result as any).response, (result as any).graphs);
            } else {
                addMessage('assistant', "I received an empty or invalid response from the network analysis engine.");
            }
        } catch (error) {
            addMessage('assistant', `Error: ${error}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerateReport = async () => {
        if (isLoading || !isConfigured) return;

        setIsLoading(true);
        addMessage('user', 'Generate comprehensive network health report');

        try {
            const report = await generateHealthReport();
            let reportContent = `## Network Health Assessment: ${report.score}/100\n\n${report.summary}\n\n`;

            if (report.highlights?.length > 0) {
                reportContent += '### Positive Indicators\n' + report.highlights.map(h => `• ${h}`).join('\n') + '\n\n';
            }
            if (report.concerns?.length > 0) {
                reportContent += '### Technical Concerns\n' + report.concerns.map(c => `• ${c}`).join('\n') + '\n\n';
            }

            addMessage('assistant', reportContent, report.graphs);
        } catch (error) {
            addMessage('assistant', `Error: Failed to generate report - ${error}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDiagnose = async () => {
        if (!onDiagnose || isLoading || !isConfigured) return;

        setIsLoading(true);
        addMessage('user', `Analyze connection: ${selectedConnectionInfo || 'selected'}`);

        try {
            const result = await onDiagnose();
            if (!result) {
                addMessage('assistant', 'Action Required: Please select a connection to analyze.');
                return;
            }

            let diagContent = `## Connection Analysis: ${result.severity.toUpperCase()}\n\n${result.summary}\n\n`;

            if (result.issues?.length > 0) {
                diagContent += '### Detected Issues\n' + result.issues.map(i => `• ${i}`).join('\n') + '\n\n';
            }
            if (result.recommendations?.length > 0) {
                diagContent += '### Technical Recommendations\n' + result.recommendations.map(r => `• ${r}`).join('\n');
            }

            addMessage('assistant', diagContent, result.graphs);
        } catch (error) {
            addMessage('assistant', `Error: Analysis failed - ${error}`);
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

    const exportChat = () => {
        if (messages.length <= 1) return; // Only welcome message

        const timestamp = new Date().toISOString().split('T')[0];
        let markdown = `# AI Chat Export - Session ${contextId}\n`;
        markdown += `Exported: ${new Date().toLocaleString()}\n\n---\n\n`;

        messages.forEach(msg => {
            if (msg.id.includes('welcome')) return; // Skip welcome
            const role = msg.role === 'user' ? '**You**' : '**AI Assistant**';
            const time = msg.timestamp.toLocaleTimeString();
            markdown += `### ${role} (${time})\n\n${msg.content}\n\n---\n\n`;
        });

        const blob = new Blob([markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ai-chat-session-${contextId}-${timestamp}.md`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (!isOpen) return null;

    const panelClass = isDocked ? 'ai-docked-panel' : 'ai-full-panel';

    return (
        <div className={`ai-assistant-container ${panelClass} animate-slide-in-right`}>
            {/* Header */}
            <div className="ai-header">
                <div className="ai-header-title">
                    <h3>TCP Doctor AI</h3>
                    {!isConfigured && <span className="badge warning">No API Key</span>}
                </div>
                <div className="ai-header-actions">
                    {messages.length > 1 && (
                        <button className="btn-export" onClick={exportChat} title="Export Chat">
                            Export
                        </button>
                    )}
                    <button className="btn-close" onClick={onClose}>×</button>
                </div>
            </div>

            <div className="ai-body">
                {/* Messages */}
                <div className="ai-messages">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`message ${msg.role}`}>
                            <div className="message-content">
                                <ReactMarkdown
                                    components={{
                                        h1: ({ children }) => <h1 className="md-h1">{children}</h1>,
                                        h2: ({ children }) => <h2 className="md-h2">{children}</h2>,
                                        h3: ({ children }) => <h3 className="md-h3">{children}</h3>,
                                        p: ({ children }) => <p className="md-p">{children}</p>,
                                        ul: ({ children }) => <ul className="md-ul">{children}</ul>,
                                        ol: ({ children }) => <ol className="md-ol">{children}</ol>,
                                        li: ({ children }) => <li className="md-li">{children}</li>,
                                        code: ({ className, children, ...props }) => {
                                            const isInline = !className;
                                            return isInline
                                                ? <code className="md-code-inline" {...props}>{children}</code>
                                                : <code className={`md-code-block ${className || ''}`} {...props}>{children}</code>;
                                        },
                                        pre: ({ children }) => <pre className="md-pre">{children}</pre>,
                                        strong: ({ children }) => <strong className="md-strong">{children}</strong>,
                                        em: ({ children }) => <em className="md-em">{children}</em>,
                                        blockquote: ({ children }) => <blockquote className="md-blockquote">{children}</blockquote>,
                                        a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="md-link">{children}</a>,
                                    }}
                                >
                                    {msg.content}
                                </ReactMarkdown>

                                {/* Render graphs if present */}
                                {msg.graphs && msg.graphs.length > 0 && msg.graphs.map((graph, gIdx) => (
                                    <AIChart
                                        key={gIdx}
                                        type={graph.type}
                                        title={graph.title}
                                        dataPoints={graph.dataPoints}
                                        xLabel={graph.xLabel}
                                        yLabel={graph.yLabel}
                                    />
                                ))}
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
                            <span className="icon">⚿</span>
                            <h4>API Key Required</h4>
                            <p>Connect your Google Gemini API key to unlock AI-powered network analysis, diagnostics, and intelligent insights.</p>
                            <button className="btn-primary" onClick={onConfigureAPI}>
                                Configure API Key
                            </button>
                            <span className="config-hint">Free tier available at ai.google.dev</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Input & Quick Actions */}
            <div className="ai-footer">
                {isConfigured && (
                    <>
                        <div className="quick-actions-label">Quick Actions:</div>
                        <div className="quick-actions">
                            <button
                                className="btn-quick"
                                onClick={handleDiagnose}
                                disabled={isLoading || !onDiagnose}
                            >
                                Analyze Selected Connection
                            </button>
                            <button
                                className="btn-quick"
                                onClick={handleGenerateReport}
                                disabled={isLoading}
                            >
                                Full Health Report
                            </button>
                        </div>
                        <div className="quick-actions-label">Suggested Queries:</div>
                        <div className="quick-actions suggestions">
                            <button
                                className="btn-suggestion"
                                onClick={() => { setInput("Show connection state distribution"); handleSend(); }}
                                disabled={isLoading}
                            >
                                Connection State Distribution
                            </button>
                            <button
                                className="btn-suggestion"
                                onClick={() => { setInput("Compare RTT across all connections"); handleSend(); }}
                                disabled={isLoading}
                            >
                                Compare RTT
                            </button>
                            <button
                                className="btn-suggestion"
                                onClick={() => { setInput("Show bandwidth usage for active connections"); handleSend(); }}
                                disabled={isLoading}
                            >
                                Bandwidth Analysis
                            </button>
                            <button
                                className="btn-suggestion"
                                onClick={() => { setInput("Identify connections with high retransmission rates"); handleSend(); }}
                                disabled={isLoading}
                            >
                                High Retransmissions
                            </button>
                            <button
                                className="btn-suggestion"
                                onClick={() => { setInput("Which connections have the worst latency?"); handleSend(); }}
                                disabled={isLoading}
                            >
                                Worst Latency
                            </button>
                            <button
                                className="btn-suggestion"
                                onClick={() => { setInput("Show top 5 connections by data transferred"); handleSend(); }}
                                disabled={isLoading}
                            >
                                Top Data Usage
                            </button>
                        </div>
                    </>
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
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AIAssistant;
