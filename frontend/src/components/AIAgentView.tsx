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

        // Auto-refresh sessions every 3 seconds to update snapshot counts
        const refreshInterval = setInterval(() => {
            loadSessionsSilent();
        }, 3000);

        return () => clearInterval(refreshInterval);
    }, []);

    // Silent load (no loading spinner) for background refresh
    const loadSessionsSilent = async () => {
        try {
            const data = await getSessions();
            setSessions(data || []);
        } catch (e) {
            // Silently ignore errors on background refresh
        }
    };

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

    // Convert TCP state int to string
    const tcpStateToString = (state: number): string => {
        const states = ['CLOSED', 'LISTEN', 'SYN_SENT', 'SYN_RCVD', 'ESTABLISHED', 'FIN_WAIT1', 'FIN_WAIT2', 'CLOSE_WAIT', 'CLOSING', 'LAST_ACK', 'TIME_WAIT', 'DELETE_TCB'];
        return states[state] || 'UNKNOWN';
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
                            onDiagnose={async (pickedConn) => {
                                // If a connection was picked from the popover, use it
                                // Otherwise fall back to the globally selected connection
                                const connToAnalyze = pickedConn ? {
                                    LocalAddr: pickedConn.localAddr,
                                    LocalPort: pickedConn.localPort,
                                    RemoteAddr: pickedConn.remoteAddr,
                                    RemotePort: pickedConn.remotePort,
                                } as any : selectedConnection;
                                return await onDiagnoseConnection(connToAnalyze);
                            }}
                            selectedConnectionInfo={selectedConnection ? `${selectedConnection.LocalAddr}:${selectedConnection.LocalPort} -> ${selectedConnection.RemoteAddr}:${selectedConnection.RemotePort}` : undefined}
                            isDocked={false}
                            getConnectionsForPicker={async () => {
                                // Fetch connections from the session timeline
                                const sessionID = parseInt(selectedContext);
                                try {
                                    const timeline = await getSessionTimeline(sessionID);
                                    if (!timeline || timeline.length === 0) return [];

                                    // Timeline is array of { timestamp, connection } objects
                                    // Get unique connections by their address:port combo
                                    const seen = new Set<string>();
                                    const connections: any[] = [];

                                    for (const entry of timeline) {
                                        const c = entry.connection;
                                        if (!c) continue;
                                        const key = `${c.localAddr}:${c.localPort}-${c.remoteAddr}:${c.remotePort}`;
                                        if (!seen.has(key)) {
                                            seen.add(key);
                                            connections.push({
                                                localAddr: c.localAddr,
                                                localPort: c.localPort,
                                                remoteAddr: c.remoteAddr,
                                                remotePort: c.remotePort,
                                                state: tcpStateToString(c.state)
                                            });
                                        }
                                    }
                                    return connections;
                                } catch (e) {
                                    console.error('Failed to get connections for picker:', e);
                                    return [];
                                }
                            }}
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
