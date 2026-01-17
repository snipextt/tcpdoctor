import React, { useState, useEffect } from 'react';
import { tcpmonitor } from "../../wailsjs/go/models";
import { GenerateHealthReportForSession } from "../../wailsjs/go/main/App";
import AIAssistant from './AIAssistant';
import './AIAgentView.css';

interface RecordingSession {
    id: number;
    startTime: string;
    endTime: string;
    snapshotCount: number;
}

interface AIAgentViewProps {
    isConfigured: boolean;
    onConfigure: () => void;
    getSessions: () => Promise<RecordingSession[]>;
    getSessionTimeline: (sessionId: number) => Promise<any[]>;
    selectedConnection: tcpmonitor.ConnectionInfo | null;
    onDiagnoseConnection: (connection: tcpmonitor.ConnectionInfo | null) => Promise<any>;
}

const AIAgentView: React.FC<AIAgentViewProps> = ({
    isConfigured,
    onConfigure,
    getSessions,
    getSessionTimeline,
    selectedConnection,
    onDiagnoseConnection
}) => {
    const [sessions, setSessions] = useState<RecordingSession[]>([]);
    const [selectedContext, setSelectedContext] = useState<string>('');
    const [isLoadingSessions, setIsLoadingSessions] = useState(false);

    useEffect(() => {
        loadSessions();
    }, []);

    // Auto-select first session when sessions load
    useEffect(() => {
        if (sessions.length > 0 && !selectedContext) {
            setSelectedContext(sessions[0].id.toString());
        }
    }, [sessions, selectedContext]);

    const loadSessions = async () => {
        setIsLoadingSessions(true);
        try {
            const data = await getSessions();
            setSessions(data || []);
        } catch (e) {
            console.error('Failed to load sessions for AI context:', e);
        }
        setIsLoadingSessions(false);
    };

    const formatTime = (ts: string) => {
        if (!ts || new Date(ts).getFullYear() < 2000) return 'Ongoing';
        return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="ai-agent-view">
            {/* Context Sidebar */}
            <div className="ai-context-sidebar">
                <div className="context-header">
                    <h3>Sessions</h3>
                    <button className="refresh-btn" onClick={loadSessions} title="Refresh Sessions">↻</button>
                </div>

                <div className="context-list">
                    {isLoadingSessions ? (
                        <div className="loading-ctx">Loading...</div>
                    ) : sessions.length === 0 ? (
                        <div className="empty-ctx">No sessions recorded yet. Start a capture from the Dashboard to analyze with AI.</div>
                    ) : (
                        sessions.map(s => (
                            <button
                                key={s.id}
                                className={`context-item ${selectedContext === s.id.toString() ? 'active' : ''}`}
                                onClick={() => setSelectedContext(s.id.toString())}
                            >
                                <span className="icon">●</span>
                                <div className="info">
                                    <span className="title">Session #{s.id}</span>
                                    <span className="subtitle">{formatTime(s.startTime)} • {s.snapshotCount} snaps</span>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* AI Assistant Chat Area */}
            <div className="ai-chat-area">
                <div className="chat-header-bar">
                    <div className="current-context">
                        {selectedContext ? (
                            <>Analyzing: <strong>Session #{selectedContext}</strong></>
                        ) : (
                            <span className="no-context">Select a session to begin analysis</span>
                        )}
                    </div>
                </div>

                <div className="embedded-assistant">
                    {selectedContext ? (
                        <AIAssistant
                            isOpen={true}
                            onClose={() => { }}
                            onConfigureAPI={onConfigure}
                            isConfigured={isConfigured}
                            contextId={selectedContext}
                            queryConnections={async (q, history) => {
                                const sessionID = parseInt(selectedContext);
                                // @ts-ignore - Use window.go binding directly until Wails bindings are regenerated
                                return await (window as any).go.main.App.QueryConnectionsForSessionWithHistory(q, sessionID, history);
                            }}
                            generateHealthReport={async () => {
                                const sessionID = parseInt(selectedContext);
                                return await GenerateHealthReportForSession(sessionID);
                            }}
                            onDiagnose={() => onDiagnoseConnection(selectedConnection)}
                            selectedConnectionInfo={selectedConnection ? `${selectedConnection.LocalAddr}:${selectedConnection.LocalPort} -> ${selectedConnection.RemoteAddr}:${selectedConnection.RemotePort}` : undefined}
                            isDocked={false}
                        />
                    ) : (
                        <div className="no-session-placeholder">
                            <div className="placeholder-icon">◉</div>
                            <h3>No Session Selected</h3>
                            <p>Select a recorded session from the sidebar to start AI-powered analysis.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AIAgentView;
