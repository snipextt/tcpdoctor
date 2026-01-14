import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Area,
    AreaChart,
    Bar,
    BarChart,
    Brush,
    ReferenceArea,
} from 'recharts';
import { downsampleData } from '../utils/dataProcessing';
import './ConnectionHistory.css';

interface ConnectionHistoryPoint {
    timestamp: string;
    state: number;
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
    // Computed fields for UI
    time?: string;
    bytesInKB?: number;
    bytesOutKB?: number;
    rttMs?: number;
    cwndKB?: number;
    inBwMbps?: number;
    outBwMbps?: number;
}

interface ConnectionHistoryProps {
    isOpen: boolean;
    onClose: () => void;
    connectionKey: string;
    getHistory: () => Promise<ConnectionHistoryPoint[]>;
    viewingHistorical?: boolean;
}

const CHART_HEIGHT = 160;
const SYNC_ID = 'connection-history-sync';

    const [zoomState, setZoomState] = useState<{ left?: string, right?: string, refAreaLeft?: string, refAreaRight?: string }>({});
    
    // Convert time string back to index for slicing
    const getIndexFromTime = (timeStr: string) => fullHistory.findIndex(p => new Date(p.timestamp).toLocaleTimeString() === timeStr);

    const zoom = () => {
        let { refAreaLeft, refAreaRight } = zoomState;

        if (refAreaLeft === refAreaRight || refAreaRight === '') {
            setZoomState({ ...zoomState, refAreaLeft: '', refAreaRight: '' });
            return;
        }

        // Determine start and end
        // Note: Axis is categorical (time strings), so we need to find indices
        // But simplified: just pass the indices to existing handleZoom logic
        
        // Find indices in the CURRENT view (history), then map to FULL history
        const currentData = history;
        let startIndex = currentData.findIndex(p => p.time === refAreaLeft);
        let endIndex = currentData.findIndex(p => p.time === refAreaRight);

        // Swap if dragged right-to-left
        if (startIndex > endIndex) [startIndex, endIndex] = [endIndex, startIndex];

        // Map these "view indices" back to "full data indices"
        // This is tricky with downsampling. 
        // Better approach: Use the timestamps to find range in fullHistory
        const startTs = currentData[startIndex]?.timestamp;
        const endTs = currentData[endIndex]?.timestamp;
        
        const fullStartIndex = fullHistory.findIndex(p => p.timestamp === startTs);
        const fullEndIndex = fullHistory.findIndex(p => p.timestamp === endTs);

        if (fullStartIndex >= 0 && fullEndIndex >= 0) {
            handleZoom({ startIndex: fullStartIndex, endIndex: fullEndIndex });
        }

        setZoomState({ ...zoomState, refAreaLeft: '', refAreaRight: '' });
    };

    const zoomOut = () => {
        setZoomDomain(null);
        setHistory(downsampleData(fullHistory, 1000) as ConnectionHistoryPoint[]);
        setZoomState({});
    };

    return (
        <div className="charts-container" style={{ userSelect: 'none' }}>
            <div style={{ position: 'absolute', right: 20, top: -40, zIndex: 10 }}>
                <button 
                    onClick={zoomOut}
                    disabled={!isZoomed}
                    style={{ 
                        opacity: isZoomed ? 1 : 0, 
                        pointerEvents: isZoomed ? 'auto' : 'none',
                        padding: '4px 12px',
                        fontSize: '12px',
                        background: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    Reset Zoom
                </button>
            </div>

            {/* 1. Bandwidth Chart */}
            <div className="chart-section">
                <div className="chart-title">Bandwidth (Mbps)</div>
                <ResponsiveContainer width="100%" height={140}>
                    <LineChart 
                        data={data} 
                        syncId={SYNC_ID} 
                        onMouseMove={(e) => {
                            onMouseMove(e);
                            if (zoomState.refAreaLeft) setZoomState({ ...zoomState, refAreaRight: e.activeLabel });
                        }}
                        onMouseDown={(e) => setZoomState({ ...zoomState, refAreaLeft: e.activeLabel })}
                        onMouseUp={zoom}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis dataKey="time" hide />
                        <YAxis tick={{ fill: '#9ca3af', fontSize: 9 }} tickFormatter={(v) => `${v.toFixed(1)}`} width={40} />
                        <Tooltip content={() => null} cursor={{ stroke: '#fff', strokeWidth: 1, strokeDasharray: '4 4' }} />
                        <Legend verticalAlign="top" height={20} iconType="plainline" />
                        <Line type="monotone" dataKey="inBwMbps" stroke="#22c55e" strokeWidth={2} dot={false} name="Inbound" isAnimationActive={false} />
                        <Line type="monotone" dataKey="outBwMbps" stroke="#3b82f6" strokeWidth={2} dot={false} name="Outbound" isAnimationActive={false} />
                        {zoomState.refAreaLeft && zoomState.refAreaRight ? (
                            <ReferenceArea yAxisId={0} x1={zoomState.refAreaLeft} x2={zoomState.refAreaRight} strokeOpacity={0.3} fill="#3b82f6" fillOpacity={0.1} />
                        ) : null}
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* 2. Retransmissions Chart */}
            <div className="chart-section">
                <div className="chart-title">Retransmissions (Bytes)</div>
                <ResponsiveContainer width="100%" height={100}>
                    <BarChart 
                        data={data} 
                        syncId={SYNC_ID} 
                        onMouseMove={(e) => {
                            onMouseMove(e);
                            if (zoomState.refAreaLeft) setZoomState({ ...zoomState, refAreaRight: e.activeLabel });
                        }}
                        onMouseDown={(e) => setZoomState({ ...zoomState, refAreaLeft: e.activeLabel })}
                        onMouseUp={zoom}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis dataKey="time" hide />
                        <YAxis tick={{ fill: '#ef4444', fontSize: 9 }} tickFormatter={(v) => formatBytes(v)} width={40} />
                        <Tooltip content={() => null} cursor={{ fill: 'rgba(255,255,255,0.1)' }} />
                        <Bar dataKey="retrans" fill="#ef4444" name="Retrans" isAnimationActive={false} />
                        {zoomState.refAreaLeft && zoomState.refAreaRight ? (
                            <ReferenceArea yAxisId={0} x1={zoomState.refAreaLeft} x2={zoomState.refAreaRight} strokeOpacity={0.3} fill="#3b82f6" fillOpacity={0.1} />
                        ) : null}
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* 3. Congestion Window (CWND) */}
            <div className="chart-section">
                <div className="chart-title">Congestion Window (CWND)</div>
                <ResponsiveContainer width="100%" height={120}>
                    <AreaChart 
                        data={data} 
                        syncId={SYNC_ID} 
                        onMouseMove={(e) => {
                            onMouseMove(e);
                            if (zoomState.refAreaLeft) setZoomState({ ...zoomState, refAreaRight: e.activeLabel });
                        }}
                        onMouseDown={(e) => setZoomState({ ...zoomState, refAreaLeft: e.activeLabel })}
                        onMouseUp={zoom}
                    >
                        <defs>
                            <linearGradient id="colorCwnd" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis dataKey="time" hide />
                        <YAxis tick={{ fill: '#3b82f6', fontSize: 9 }} tickFormatter={(v) => `${v.toFixed(0)}K`} width={40} />
                        <Tooltip content={() => null} cursor={{ stroke: '#fff', strokeWidth: 1, strokeDasharray: '4 4' }} />
                        <Area type="monotone" dataKey="cwndKB" stroke="#3b82f6" fill="url(#colorCwnd)" name="CWND" isAnimationActive={false} />
                        {zoomState.refAreaLeft && zoomState.refAreaRight ? (
                            <ReferenceArea yAxisId={0} x1={zoomState.refAreaLeft} x2={zoomState.refAreaRight} strokeOpacity={0.3} fill="#3b82f6" fillOpacity={0.1} />
                        ) : null}
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* 4. Round Trip Time (RTT) */}
            <div className="chart-section">
                <div className="chart-title">Round Trip Time (ms)</div>
                <ResponsiveContainer width="100%" height={120}>
                    <AreaChart 
                        data={data} 
                        syncId={SYNC_ID} 
                        onMouseMove={(e) => {
                            onMouseMove(e);
                            if (zoomState.refAreaLeft) setZoomState({ ...zoomState, refAreaRight: e.activeLabel });
                        }}
                        onMouseDown={(e) => setZoomState({ ...zoomState, refAreaLeft: e.activeLabel })}
                        onMouseUp={zoom}
                    >
                        <defs>
                            <linearGradient id="colorRtt" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis dataKey="time" tick={{ fill: '#9ca3af', fontSize: 9 }} />
                        <YAxis tick={{ fill: '#f59e0b', fontSize: 9 }} width={40} />
                        <Tooltip content={() => null} cursor={{ stroke: '#fff', strokeWidth: 1, strokeDasharray: '4 4' }} />
                        <Area type="monotone" dataKey="rttMs" stroke="#f59e0b" fill="url(#colorRtt)" name="RTT" isAnimationActive={false} />
                        {zoomState.refAreaLeft && zoomState.refAreaRight ? (
                            <ReferenceArea yAxisId={0} x1={zoomState.refAreaLeft} x2={zoomState.refAreaRight} strokeOpacity={0.3} fill="#3b82f6" fillOpacity={0.1} />
                        ) : null}
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}, (prev, next) => {
    // Only re-render if data actually changed
    return prev.data === next.data;
});

const ConnectionHistory: React.FC<ConnectionHistoryProps> = ({
    isOpen,
    onClose,
    connectionKey,
    getHistory,
    viewingHistorical = false,
}) => {
    const [history, setHistory] = useState<ConnectionHistoryPoint[]>([]);
    const [fullHistory, setFullHistory] = useState<ConnectionHistoryPoint[]>([]);
    const [zoomDomain, setZoomDomain] = useState<{ startIndex?: number; endIndex?: number } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [hoveredData, setHoveredData] = useState<any>(null);

    useEffect(() => {
        if (isOpen) {
            loadHistory();
        }
    }, [isOpen]);

    const loadHistory = async () => {
        setIsLoading(true);
        try {
            const rawData = await getHistory();
            const formatted = rawData.map((point, i) => ({
                ...point,
                time: new Date(point.timestamp).toLocaleTimeString(),
                index: i,
                bytesInKB: point.bytesIn / 1024,
                bytesOutKB: point.bytesOut / 1024,
                rttMs: point.rtt,
                minRttMs: point.minRtt,
                maxRttMs: point.maxRtt,
                inBwMbps: point.inBandwidth / 1000000,
                outBwMbps: point.outBandwidth / 1000000,
                cwndKB: point.congestionWin / 1024,
            }));
            
            setFullHistory(formatted);
            // Decimate data if too large to prevent chart lag (max 1000 points)
            // Charts struggle with > 2000 SVG nodes.
            // Force type cast as we know formatted has time property
            const processedData = rawData.length > 1000 
                ? downsampleData(formatted as any, 1000) as ConnectionHistoryPoint[]
                : formatted;

            setHistory(processedData);
        } catch (e) {
            console.error('Failed to load history:', e);
        }
        setIsLoading(false);
    };

    const handleZoom = useCallback((domain: any) => {
        if (!domain || domain.startIndex === undefined || domain.endIndex === undefined) return;
        
        setZoomDomain(domain);
        
        // When zoomed, slice the FULL history and re-downsample the slice
        // This reveals fine-grained details that were lost in the global downsample
        const slicedData = fullHistory.slice(domain.startIndex, domain.endIndex + 1);
        const resampledData = downsampleData(slicedData as any, 1000) as ConnectionHistoryPoint[];
        
        setHistory(resampledData);
    }, [fullHistory]);

    // Stable callback for hover to prevent re-creation
    const handleMouseMove = useCallback((e: any) => {
        if (e && e.activePayload && e.activePayload.length > 0) {
            setHoveredData(e.activePayload[0].payload);
        } else {
            setHoveredData(null);
        }
    }, []);

    const formatBytes = useCallback((bytes: number) => {
        if (bytes < 1024) return `${bytes.toFixed(0)} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }, []);

    if (!isOpen) return null;

    // Data for inspector header
    const currentData = hoveredData || (history.length > 0 ? history[history.length - 1] : null);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="history-modal unified-charts" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>📈 Connection History</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="connection-label">{connectionKey}</div>

                {/* Data Inspector Header */}
                {currentData && (
                    <div className="inspector-header">
                        <div className="inspector-item">
                            <span className="label">Time</span>
                            <span className="value">{currentData.time}</span>
                        </div>
                        <div className="inspector-item">
                            <span className="label">RTT</span>
                            <span className="value">{currentData.rttMs?.toFixed(0)} ms</span>
                        </div>
                        <div className="inspector-item">
                            <span className="label">CWND</span>
                            <span className="value">{currentData.cwndKB?.toFixed(1)} KB</span>
                        </div>
                        <div className="inspector-item">
                            <span className="label">Retrans</span>
                            <span className="value">{formatBytes(currentData.retrans || 0)}</span>
                        </div>
                        <div className="inspector-item">
                            <span className="label">BW In</span>
                            <span className="value">{currentData.inBwMbps?.toFixed(2)} Mbps</span>
                        </div>
                        <div className="inspector-item">
                            <span className="label">BW Out</span>
                            <span className="value">{currentData.outBwMbps?.toFixed(2)} Mbps</span>
                        </div>
                    </div>
                )}

                <div className="modal-body">
                    {isLoading ? (
                        <div className="loading-state">Loading history...</div>
                    ) : history.length === 0 ? (
                        <div className="empty-state">
                            <p>No history recorded for this connection.</p>
                            <p className="hint">Start recording to capture data.</p>
                        </div>
                    ) : (
                        <HistoryCharts 
                            data={history} 
                            fullHistory={fullHistory}
                            onMouseMove={handleMouseMove} 
                            formatBytes={formatBytes} 
                            onZoom={handleZoom}
                            isZoomed={!!zoomDomain}
                        />
                    )}
                </div>

                <div className="chart-stats">
                    <div className="stat">
                        <span className="label">Data Points</span>
                        <span className="value">{history.length}</span>
                    </div>
                    {history.length > 0 && (
                        <>
                            <div className="stat">
                                <span className="label">Duration</span>
                                <span className="value">
                                    {Math.round((new Date(history[history.length - 1].timestamp).getTime() -
                                        new Date(history[0].timestamp).getTime()) / 1000)}s
                                </span>
                            </div>
                            <div className="stat">
                                <span className="label">Avg RTT</span>
                                <span className="value">
                                    {(history.reduce((sum, p) => sum + (p as any).rttMs, 0) / history.length).toFixed(2)}ms
                                </span>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ConnectionHistory;
