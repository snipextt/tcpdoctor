import React, { useState, useEffect } from 'react';
import './SnapshotTimeline.css';

interface SnapshotMeta {
    id: number;
    timestamp: string;
    connectionCount: number;
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
    rtt: number;
    retrans: number;
}

interface Snapshot {
    id: number;
    timestamp: string;
    connections: CompactConnection[];
}

interface ConnectionDiff {
    connection: CompactConnection;
    deltaIn: number;
    deltaOut: number;
    deltaRtt: number;
}

interface ComparisonResult {
    snapshot1: number;
    snapshot2: number;
    added: CompactConnection[];
    removed: CompactConnection[];
    changed: ConnectionDiff[];
}

interface SnapshotTimelineProps {
    isOpen: boolean;
    onClose: () => void;
    getMeta: () => Promise<SnapshotMeta[]>;
    getSnapshot: (id: number) => Promise<Snapshot | null>;
    compareSnapshots: (id1: number, id2: number) => Promise<ComparisonResult | null>;
    onLoadSnapshot: (snapshot: Snapshot) => void;
    onClear: () => void;
}

const SnapshotTimeline: React.FC<SnapshotTimelineProps> = ({
    isOpen,
    onClose,
    getMeta,
    getSnapshot,
    compareSnapshots,
    onLoadSnapshot,
    onClear,
}) => {
    const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [comparison, setComparison] = useState<ComparisonResult | null>(null);
    const [isComparing, setIsComparing] = useState(false);
    const [viewingSnapshot, setViewingSnapshot] = useState<Snapshot | null>(null);

    useEffect(() => {
        if (isOpen) {
            loadMeta();
        }
    }, [isOpen]);

    const loadMeta = async () => {
        const meta = await getMeta();
        setSnapshots(meta || []);
    };

    const toggleSelect = (id: number) => {
        const newSelected = new Set(selected);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            if (newSelected.size < 2) {
                newSelected.add(id);
            }
        }
        setSelected(newSelected);
        setComparison(null);
    };

    const handleCompare = async () => {
        if (selected.size !== 2) return;
        const ids = Array.from(selected);
        setIsComparing(true);
        try {
            const result = await compareSnapshots(ids[0], ids[1]);
            setComparison(result);
        } catch (e) {
            console.error('Compare failed:', e);
        }
        setIsComparing(false);
    };

    const handleLoad = async (id: number) => {
        const snapshot = await getSnapshot(id);
        if (snapshot) {
            setViewingSnapshot(snapshot);
            onLoadSnapshot(snapshot);
        }
    };

    const formatTime = (ts: string) => {
        const d = new Date(ts);
        return d.toLocaleTimeString();
    };

    const formatBytes = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="timeline-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>📊 Snapshots ({snapshots.length})</h2>
                    <div className="header-actions">
                        <button className="clear-btn" onClick={onClear} title="Clear All">
                            🗑
                        </button>
                        <button className="close-btn" onClick={onClose}>×</button>
                    </div>
                </div>

                <div className="modal-body">
                    {snapshots.length === 0 ? (
                        <div className="empty-state">
                            <p>No snapshots recorded yet.</p>
                            <p className="hint">Click Record to start capturing.</p>
                        </div>
                    ) : comparison ? (
                        <div className="comparison-view">
                            <div className="comparison-header">
                                <button className="back-btn" onClick={() => setComparison(null)}>
                                    ← Back
                                </button>
                                <span>Comparing snapshots</span>
                            </div>

                            <div className="comparison-stats">
                                <div className="stat added">
                                    <span className="count">+{comparison.added?.length || 0}</span>
                                    <span className="label">New</span>
                                </div>
                                <div className="stat removed">
                                    <span className="count">-{comparison.removed?.length || 0}</span>
                                    <span className="label">Closed</span>
                                </div>
                                <div className="stat changed">
                                    <span className="count">~{comparison.changed?.length || 0}</span>
                                    <span className="label">Changed</span>
                                </div>
                            </div>

                            {comparison.changed && comparison.changed.length > 0 && (
                                <div className="diff-section">
                                    <h4>Changed Connections</h4>
                                    <div className="diff-list">
                                        {comparison.changed.slice(0, 10).map((diff, i) => (
                                            <div key={i} className="diff-item">
                                                <span className="conn-addr">
                                                    {diff.connection.remoteAddr}:{diff.connection.remotePort}
                                                </span>
                                                <span className="diff-delta">
                                                    {diff.deltaIn > 0 && <span className="delta-in">+{formatBytes(diff.deltaIn)}</span>}
                                                    {diff.deltaOut > 0 && <span className="delta-out">↑{formatBytes(diff.deltaOut)}</span>}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="snapshot-list">
                                {snapshots.slice(-50).reverse().map((snap) => (
                                    <div
                                        key={snap.id}
                                        className={`snapshot-item ${selected.has(snap.id) ? 'selected' : ''}`}
                                    >
                                        <label className="select-checkbox">
                                            <input
                                                type="checkbox"
                                                checked={selected.has(snap.id)}
                                                onChange={() => toggleSelect(snap.id)}
                                            />
                                        </label>
                                        <div className="snapshot-info">
                                            <span className="time">{formatTime(snap.timestamp)}</span>
                                            <span className="count">{snap.connectionCount} conn</span>
                                        </div>
                                        <button
                                            className="load-btn"
                                            onClick={() => handleLoad(snap.id)}
                                            title="Load this snapshot into main view"
                                        >
                                            Load
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {selected.size === 2 && (
                                <div className="compare-action">
                                    <button
                                        className="compare-btn"
                                        onClick={handleCompare}
                                        disabled={isComparing}
                                    >
                                        {isComparing ? 'Comparing...' : 'Compare Selected'}
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SnapshotTimeline;
