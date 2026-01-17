import React, { useState, useRef, useEffect } from 'react';
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
            const historyForContext = messages
                .filter(m => m.id !== `${contextId}-welcome`)
                .map(m => ({ role: m.role, content: m.content }));

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
                            <span className="icon">Key</span>
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
