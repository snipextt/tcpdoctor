import React from 'react';
import SessionTimeline from './SessionTimeline';
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
    snapshotCount: number;
    onStartRecording: () => void;
    onStopRecording: () => void;
    isTimelineOpen: boolean;
    onOpenTimeline: () => void;
    onCloseTimeline: () => void;
    getSessions: () => Promise<RecordingSession[]>;
    getSessionTimeline: (sessionId: number) => Promise<TimelineConnection[]>;
    onLoadSession: (sessionId: number, timeline: TimelineConnection[]) => void;
    onClear: () => void;
}

const SnapshotControls: React.FC<SnapshotControlsProps> = ({
    isRecording,
    snapshotCount,
    onStartRecording,
    onStopRecording,
    isTimelineOpen,
    onOpenTimeline,
    onCloseTimeline,
    getSessions,
    getSessionTimeline,
    onLoadSession,
    onClear,
}) => {
    return (
        <div className="snapshot-controls">
            <button
                className={`record-btn ${isRecording ? 'recording' : ''}`}
                onClick={isRecording ? onStopRecording : onStartRecording}
                title={isRecording ? 'Stop Recording' : 'Start Recording'}
            >
                <span className="record-icon">{isRecording ? '⏹' : '⏺'}</span>
                {isRecording ? 'Stop' : 'Record'}
            </button>

            {snapshotCount > 0 && (
                <div className="timeline-container">
                    <button
                        className="timeline-btn"
                        onClick={onOpenTimeline}
                        title="View Sessions"
                    >
                        📊 {snapshotCount}
                    </button>

                    <SessionTimeline
                        isOpen={isTimelineOpen}
                        onClose={onCloseTimeline}
                        getSessions={getSessions}
                        getSessionTimeline={getSessionTimeline}
                        onLoadSession={onLoadSession}
                        onClear={onClear}
                    />
                </div>
            )}
        </div>
    );
};

export default SnapshotControls;
