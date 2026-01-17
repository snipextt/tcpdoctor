import React, { useState, useEffect } from 'react';
import { tcpmonitor } from "../../wailsjs/go/models";
import { QueryConnections, GenerateHealthReport } from "../../wailsjs/go/main/App";
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
    const [selectedContext, setSelectedContext] = useState<string>('live'); // 'live' or session ID
    const [isLoadingSessions, setIsLoadingSessions] = useState(false);

    useEffect(() => {
        loadSessions();
    }, []);

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
                    <h3>Context</h3>
                    <button className="refresh-btn" onClick={loadSessions} title="Refresh Sessions">↻</button>
                </div>

                <div className="context-list">
                    <button
                        className={`context-item ${selectedContext === 'live' ? 'active' : ''}`}
                        onClick={() => setSelectedContext('live')}
                    >
                        <span className="icon">📡</span>
                        <div className="info">
                            <span className="title">Live Dashboard</span>
                            <span className="subtitle">Real-time data</span>
                        </div>
                    </button>

                    <div className="section-label">Recorded Sessions</div>

                    {isLoadingSessions ? (
                        <div className="loading-ctx">Loading...</div>
                    ) : sessions.length === 0 ? (
                        <div className="empty-ctx">No sessions recorded</div>
                    ) : (
                        sessions.map(s => (
                            <button
                                key={s.id}
                                className={`context-item ${selectedContext === s.id.toString() ? 'active' : ''}`}
                                onClick={() => setSelectedContext(s.id.toString())}
                            >
                                <span className="icon">💾</span>
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
                        Using Context: <strong>{selectedContext === 'live' ? 'Live Dashboard' : `Session #${selectedContext}`}</strong>
                    </div>
                </div>

                <div className="embedded-assistant">
                    <AIAssistant
                        isOpen={true}
                        onClose={() => { }} // No close in full view
                        onConfigureAPI={onConfigure}
                        isConfigured={isConfigured}
                        contextId={selectedContext} // Pass context for separate chat histories
                        // Bindings
                        queryConnections={async (q) => {
                            // TODO: Pass context ID to query? 
                            // The backend QueryConnections might need to know if we are querying a snapshot.
                            // For now, we assume it queries LIVE data unless we enhance the backend.
                            // We can prepend context to query to prompt the AI: 
                            const prompt = selectedContext === 'live'
                                ? q
                                : `[Context: Session #${selectedContext}] ${q}`;
                            return await QueryConnections(prompt);
                        }}
                        generateHealthReport={GenerateHealthReport}
                        onDiagnose={() => onDiagnoseConnection(selectedConnection)}
                        selectedConnectionInfo={selectedConnection ? `${selectedConnection.LocalAddr}:${selectedConnection.LocalPort} -> ${selectedConnection.RemoteAddr}:${selectedConnection.RemotePort}` : undefined}
                        isDocked={false} // Full width
                    />
                </div>
            </div>
        </div>
    );
};

export default AIAgentView;
