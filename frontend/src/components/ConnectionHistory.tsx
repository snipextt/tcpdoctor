import React, { useState, useEffect } from 'react';
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
    ComposedChart,
    Bar,
    Brush,
    ReferenceLine
} from 'recharts';
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

const ConnectionHistory: React.FC<ConnectionHistoryProps> = ({
    isOpen,
    onClose,
    connectionKey,
    getHistory,
    viewingHistorical = false,
}) => {
    const [history, setHistory] = useState<ConnectionHistoryPoint[]>([]);
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
            const data = await getHistory();
            const formatted = (data || []).map((point, i) => ({
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
            setHistory(formatted);
        } catch (e) {
            console.error('Failed to load history:', e);
        }
        setIsLoading(false);
    };

    const handleMouseMove = (e: any) => {
        if (e && e.activePayload && e.activePayload.length > 0) {
            setHoveredData(e.activePayload[0].payload);
        } else {
            setHoveredData(null);
        }
    };

    const formatBytes = (bytes: number) => {
        if (bytes < 1024) return `${bytes.toFixed(0)} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

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
                            <span className="value">{currentData.rttMs.toFixed(0)} ms</span>
                        </div>
                        <div className="inspector-item">
                            <span className="label">CWND</span>
                            <span className="value">{currentData.cwndKB.toFixed(1)} KB</span>
                        </div>
                        <div className="inspector-item">
                            <span className="label">Retrans</span>
                            <span className="value">{formatBytes(currentData.retrans)}</span>
                        </div>
                        <div className="inspector-item">
                            <span className="label">BW In</span>
                            <span className="value">{currentData.inBwMbps.toFixed(2)} Mbps</span>
                        </div>
                        <div className="inspector-item">
                            <span className="label">BW Out</span>
                            <span className="value">{currentData.outBwMbps.toFixed(2)} Mbps</span>
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
                        <div className="charts-container">
                            
                            {/* 1. Network Performance (Bandwidth + Retransmits) */}
                            <div className="chart-section">
                                <div className="chart-title">Network Performance (Bandwidth & Retransmissions)</div>
                                <ResponsiveContainer width="100%" height={CHART_HEIGHT + 40}>
                                    <ComposedChart data={history} syncId={SYNC_ID} onMouseMove={handleMouseMove}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                        <XAxis dataKey="time" tick={{ fill: '#9ca3af', fontSize: 9 }} />
                                        <YAxis yAxisId="left" tick={{ fill: '#9ca3af', fontSize: 9 }} tickFormatter={(v) => `${v.toFixed(1)}M`} width={45} label={{ value: 'Mbps', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 9 }} />
                                        <YAxis yAxisId="right" orientation="right" tick={{ fill: '#ef4444', fontSize: 9 }} tickFormatter={(v) => formatBytes(v)} width={45} />
                                        <Tooltip content={() => null} cursor={{ stroke: 'rgba(255,255,255,0.3)', strokeWidth: 1 }} />
                                        <Legend />
                                        <Line yAxisId="left" type="monotone" dataKey="inBwMbps" stroke="#22c55e" strokeWidth={2} dot={false} name="BW In" />
                                        <Line yAxisId="left" type="monotone" dataKey="outBwMbps" stroke="#3b82f6" strokeWidth={2} dot={false} name="BW Out" />
                                        <Bar yAxisId="right" dataKey="retrans" fill="#ef4444" name="Retrans (Bytes)" opacity={0.6} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>

                            {/* 2. Congestion Analysis (RTT + CWND) */}
                            <div className="chart-section">
                                <div className="chart-title">Congestion Analysis (RTT vs CWND)</div>
                                <ResponsiveContainer width="100%" height={CHART_HEIGHT + 40}>
                                    <ComposedChart data={history} syncId={SYNC_ID} onMouseMove={handleMouseMove}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                        <XAxis dataKey="time" tick={{ fill: '#9ca3af', fontSize: 9 }} />
                                        <YAxis yAxisId="left" tick={{ fill: '#f59e0b', fontSize: 9 }} width={45} label={{ value: 'RTT (ms)', angle: -90, position: 'insideLeft', fill: '#f59e0b', fontSize: 9 }} />
                                        <YAxis yAxisId="right" orientation="right" tick={{ fill: '#3b82f6', fontSize: 9 }} width={45} label={{ value: 'CWND (KB)', angle: 90, position: 'insideRight', fill: '#3b82f6', fontSize: 9 }} />
                                        <Tooltip content={() => null} cursor={{ stroke: 'rgba(255,255,255,0.3)', strokeWidth: 1 }} />
                                        <Legend />
                                        <Line yAxisId="left" type="monotone" dataKey="rttMs" stroke="#f59e0b" strokeWidth={2} dot={false} name="RTT" />
                                        <Area yAxisId="right" type="monotone" dataKey="cwndKB" fill="#3b82f6" stroke="#3b82f6" fillOpacity={0.1} name="CWND" />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>

                            {/* 3. Traffic Overview (Bytes with Zoom) */}
                            <div className="chart-section">
                                <div className="chart-title">Total Traffic Volume & Zoom</div>
                                <ResponsiveContainer width="100%" height={CHART_HEIGHT + 40}>
                                    <AreaChart data={history} syncId={SYNC_ID} onMouseMove={handleMouseMove}>
                                        <defs>
                                            <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                        <XAxis dataKey="time" tick={{ fill: '#9ca3af', fontSize: 9 }} />
                                        <YAxis tick={{ fill: '#9ca3af', fontSize: 9 }} tickFormatter={(v) => formatBytes(v * 1024)} width={60} />
                                        <Tooltip content={() => null} cursor={{ stroke: 'rgba(255,255,255,0.3)', strokeWidth: 1 }} />
                                        <Legend />
                                        <Area type="monotone" dataKey="bytesInKB" stroke="#22c55e" fill="url(#colorIn)" name="Bytes In" />
                                        <Area type="monotone" dataKey="bytesOutKB" stroke="#3b82f6" fill="url(#colorOut)" name="Bytes Out" />
                                        <Brush dataKey="time" height={25} stroke="#3b82f6" fill="#1f2937" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
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
