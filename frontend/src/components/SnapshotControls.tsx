import React, { useState, useEffect, useRef } from 'react';
import './SnapshotControls.css';

interface RecordingSession {
    id: number;
    startTime: string;
    endTime: string;
    snapshotCount: number;
}

interface TimelineConnection {
    timestamp: string;
    connection: any;
}

interface SnapshotControlsProps {
    isRecording: boolean;
    sessionCount: number;
    onStartRecording: () => void;
    onStopRecording: () => void;
    getSessions: () => Promise<RecordingSession[]>;
    getSessionTimeline: (sessionId: number) => Promise<TimelineConnection[]>;
    onLoadSession: (sessionId: number, timeline: TimelineConnection[]) => void;
    onClear: () => void;
    onExportSession: (sessionId: number) => void;
    onImportSession: () => void;
}

const SnapshotControls: React.FC<SnapshotControlsProps> = ({
    isRecording,
    sessionCount,
    onStartRecording,
    onStopRecording,
    getSessions,
    getSessionTimeline,
    onLoadSession,
    onClear,
    onExportSession,
    onImportSession,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [sessions, setSessions] = useState<RecordingSession[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingSessionId, setLoadingSessionId] = useState<number | null>(null);
    const popoverRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            loadSessions();
        }
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
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
            setIsOpen(false);
        } catch (e) {
            console.error('Failed to load session:', e);
        }
        setIsLoading(false);
        setLoadingSessionId(null);
    };

    const formatTime = (ts: string) => {
        if (!ts || ts === '0001-01-01T00:00:00Z' || new Date(ts).getFullYear() < 2000) {
            return null; // Invalid/zero time
        }
        const d = new Date(ts);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    const formatDuration = (start: string, end: string) => {
        const startTime = new Date(start).getTime();
        let endTime = new Date(end).getTime();

        // If end time is invalid (zero date or before 2000), use current time for ongoing sessions
        if (!end || end === '0001-01-01T00:00:00Z' || new Date(end).getFullYear() < 2000) {
            endTime = Date.now();
        }

        const diffMs = endTime - startTime;
        if (diffMs < 0) return 'Recording...';
        if (diffMs < 1000) return `${diffMs}ms`;
        if (diffMs < 60000) return `${(diffMs / 1000).toFixed(0)}s`;
        const mins = Math.floor(diffMs / 60000);
        const secs = Math.floor((diffMs % 60000) / 1000);
        return `${mins}m ${secs}s`;
    };

    const isSessionOngoing = (session: RecordingSession) => {
        return !session.endTime || session.endTime === '0001-01-01T00:00:00Z' || new Date(session.endTime).getFullYear() < 2000;
    };

    const handleRecordToggle = () => {
        if (isRecording) {
            onStopRecording();
        } else {
            onStartRecording();
        }
        // Always refresh sessions after toggling (both start and stop)
        setTimeout(loadSessions, 200);
    };

    const handleClear = () => {
        onClear();
        setSessions([]);
    };

    return (
        <div className="snapshot-controls" ref={popoverRef}>
            <button
                className={`sessions-btn ${isRecording ? 'recording' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                {isRecording && <span className="recording-dot" />}
                Sessions {sessionCount > 0 && `(${sessionCount})`}
            </button>

            {isOpen && (
                <div className="sessions-popover">
                    {/* Control Buttons */}
                    <div className="controls-row">
                        {!isRecording ? (
                            <button
                                className="record-btn start"
                                onClick={onStartRecording}
                            >
                                ● Start Capture
                            </button>
                        ) : (
                            <button
                                className="record-btn save-new"
                                onClick={() => {
                                    onStopRecording();
                                    setTimeout(onStartRecording, 200);
                                    setTimeout(loadSessions, 500);
                                }}
                                title="Save current capture and start a new one"
                            >
                                💾 Save & New Capture
                            </button>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="action-row">
                        <button className="action-btn" onClick={onImportSession}>
                            Import
                        </button>
                        <button
                            className="action-btn danger"
                            onClick={handleClear}
                            disabled={sessions.length === 0}
                        >
                            Clear All
                        </button>
                    </div>

                    {/* Sessions List */}
                    <div className="sessions-list">
                        {sessions.length === 0 ? (
                            <div className="empty-state">
                                No captures yet.<br />
                                Click "Start Capture" to begin.
                            </div>
                        ) : (
                            sessions.map((session) => {
                                const ongoing = isSessionOngoing(session);
                                const startTimeStr = formatTime(session.startTime);
                                const endTimeStr = ongoing ? 'Capturing...' : formatTime(session.endTime);

                                return (
                                    <div key={session.id} className={`session-card ${ongoing ? 'ongoing' : ''}`}>
                                        <div className="session-info">
                                            <div className="session-time">
                                                {startTimeStr} → {endTimeStr}
                                            </div>
                                            <div className="session-meta">
                                                Duration: {formatDuration(session.startTime, session.endTime)} · {session.snapshotCount} snapshots
                                            </div>
                                        </div>
                                        <div className="session-buttons">
                                            <button
                                                className="session-action-btn"
                                                onClick={() => onExportSession(session.id)}
                                            >
                                                Export
                                            </button>
                                            <button
                                                className="session-action-btn primary"
                                                onClick={() => handleLoadSession(session.id)}
                                                disabled={isLoading}
                                            >
                                                {loadingSessionId === session.id ? 'Loading...' : 'Load'}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SnapshotControls;
