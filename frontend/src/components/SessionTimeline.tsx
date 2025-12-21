import React, { useState, useEffect, useRef } from 'react';
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
    const popoverRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            loadSessions();
        }
    }, [isOpen]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose]);

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
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    const formatDuration = (start: string, end: string) => {
        const diffMs = new Date(end).getTime() - new Date(start).getTime();
        if (diffMs < 1000) return `${diffMs}ms`;
        if (diffMs < 60000) return `${(diffMs / 1000).toFixed(0)}s`;
        const mins = Math.floor(diffMs / 60000);
        const secs = Math.floor((diffMs % 60000) / 1000);
        return `${mins}m ${secs}s`;
    };

    if (!isOpen) return null;

    return (
        <div className="session-popover" ref={popoverRef}>
            <div className="popover-header">
                <span>Sessions</span>
                {sessions.length > 0 && (
                    <button className="clear-btn" onClick={onClear} title="Clear all">
                        🗑️
                    </button>
                )}
            </div>

            <div className="popover-content">
                {sessions.length === 0 ? (
                    <div className="empty-msg">No recordings yet</div>
                ) : (
                    sessions.map((session) => (
                        <div key={session.id} className="session-row">
                            <div className="session-info">
                                <div className="session-main">
                                    <span className="session-time">
                                        {formatTime(session.startTime)} - {formatTime(session.endTime)}
                                    </span>
                                </div>
                                <div className="session-meta">
                                    {formatDuration(session.startTime, session.endTime)} · {session.snapshotCount} snapshots
                                </div>
                            </div>
                            <button
                                className="load-btn"
                                onClick={() => handleLoadSession(session.id)}
                                disabled={isLoading}
                            >
                                {loadingSessionId === session.id ? '...' : 'Load'}
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default SessionTimeline;
