import React, { useState, useEffect, useCallback } from 'react';
import './SnapshotControls.css';

interface SnapshotMeta {
    id: number;
    timestamp: string;
    connectionCount: number;
}

interface SnapshotControlsProps {
    isRecording: boolean;
    snapshotCount: number;
    onStartRecording: () => void;
    onStopRecording: () => void;
    onOpenTimeline: () => void;
}

const SnapshotControls: React.FC<SnapshotControlsProps> = ({
    isRecording,
    snapshotCount,
    onStartRecording,
    onStopRecording,
    onOpenTimeline,
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
                <button
                    className="timeline-btn"
                    onClick={onOpenTimeline}
                    title="View Snapshots"
                >
                    📊 {snapshotCount.toLocaleString()}
                </button>
            )}
        </div>
    );
};

export default SnapshotControls;
