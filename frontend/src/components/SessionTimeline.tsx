import React, { useState, useEffect } from 'react';
import './SessionTimeline.css';

interface RecordingSession {
    id: number;
    startTime: string;
    endTime: string;
    snapshotCount: number;
}

interface CompactConnection {
    localAddr: string;
    localPort: number;
    remoteAddr: string;
    remotePort: number;
    state: number;
    pid: number;
    bytesIn: number;
    bytesOut: number;
    segmentsIn: number;
    segmentsOut: number;
    rtt: number;
    rttVariance: number;
    minRtt: number;
    maxRtt: number;
    retrans: number;
    segsRetrans: number;
    congestionWin: number;
    inBandwidth: number;
    outBandwidth: number;
}

interface TimelineConnection {
    timestamp: string;
    connection: CompactConnection;
}

interface SessionTimelineProps {
    isOpen: boolean;
    onClose: () => void;
    getSessions: () => Promise<RecordingSession[]>;
    getSessionTimeline: (sessionId: number) => Promise<TimelineConnection[]>;
    onLoadSession: (sessionId: number, timeline: TimelineConnection[]) => void;
    onClear: () => void;
}

const SessionTimeline: React.FC<SessionTimelineProps> = ({
    isOpen,
    onClose,
    getSessions,
    getSessionTimeline,
    onLoadSession,
    onClear,
}) => {
    const [sessions, setSessions] = useState<RecordingSession[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingSessionId, setLoadingSessionId] = useState<number | null>(null);

    useEffect(() => {
        if (isOpen) {
            loadSessions();
        }
    }, [isOpen]);

    const loadSessions = async () => {
        const data = await getSessions();
        setSessions(data || []);
    };

    const handleLoadSession = async (sessionId: number) => {
        setLoadingSessionId(sessionId);
        setIsLoading(true);
        try {
            const timeline = await getSessionTimeline(sessionId);
            onLoadSession(sessionId, timeline);
            onClose();
        } catch (e) {
            console.error('Failed to load session:', e);
        }
        setIsLoading(false);
        setLoadingSessionId(null);
    };

    const formatTime = (ts: string) => {
        const d = new Date(ts);
        return d.toLocaleTimeString();
    };

    const formatDate = (ts: string) => {
        const d = new Date(ts);
        return d.toLocaleDateString();
    };

    const formatDuration = (start: string, end: string) => {
        const startDate = new Date(start);
        const endDate = new Date(end);
        const diffMs = endDate.getTime() - startDate.getTime();

        if (diffMs < 1000) return `${diffMs}ms`;
        if (diffMs < 60000) return `${(diffMs / 1000).toFixed(1)}s`;
        const mins = Math.floor(diffMs / 60000);
        const secs = Math.floor((diffMs % 60000) / 1000);
        return `${mins}m ${secs}s`;
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="timeline-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>🎬 Recording Sessions ({sessions.length})</h2>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>

                <div className="modal-content">
                    {sessions.length === 0 ? (
                        <div className="empty-state">
                            <p>No recording sessions yet.</p>
                            <p>Click <strong>Record</strong> to start capturing connections over time.</p>
                        </div>
                    ) : (
                        <div className="sessions-list">
                            {sessions.map((session) => (
                                <div key={session.id} className="session-item">
                                    <div className="session-header">
                                        <span className="session-id">Session #{session.id}</span>
                                        <span className="session-date">{formatDate(session.startTime)}</span>
                                    </div>
                                    <div className="session-details">
                                        <div className="session-time">
                                            <span className="time-label">Start:</span>
                                            <span className="time-value">{formatTime(session.startTime)}</span>
                                        </div>
                                        <div className="session-time">
                                            <span className="time-label">End:</span>
                                            <span className="time-value">{formatTime(session.endTime)}</span>
                                        </div>
                                        <div className="session-time">
                                            <span className="time-label">Duration:</span>
                                            <span className="time-value">{formatDuration(session.startTime, session.endTime)}</span>
                                        </div>
                                        <div className="session-time">
                                            <span className="time-label">Snapshots:</span>
                                            <span className="time-value">{session.snapshotCount}</span>
                                        </div>
                                    </div>
                                    <div className="session-actions">
                                        <button
                                            className="btn-load-session"
                                            onClick={() => handleLoadSession(session.id)}
                                            disabled={isLoading}
                                        >
                                            {loadingSessionId === session.id ? 'Loading...' : '▶ Load Timeline'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="btn-clear" onClick={onClear} disabled={sessions.length === 0}>
                        🗑️ Clear All
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SessionTimeline;
