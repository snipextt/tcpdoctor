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

const CHART_HEIGHT = 140;
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

    const formatBytes = (bytes: number) => {
        if (bytes < 1024) return `${bytes.toFixed(0)} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    const tooltipStyle = {
        backgroundColor: '#1f2937',
        border: '1px solid #374151',
        borderRadius: '4px'
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="history-modal unified-charts" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>📈 Connection History</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="connection-label">{connectionKey}</div>

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
                            {/* Traffic Chart */}
                            <div className="chart-section">
                                <div className="chart-title">Traffic (Bytes)</div>
                                <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                                    <AreaChart data={history} syncId={SYNC_ID}>
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
                                        <XAxis dataKey="time" tick={{ fill: '#9ca3af', fontSize: 9 }} hide />
                                        <YAxis tick={{ fill: '#9ca3af', fontSize: 9 }} tickFormatter={(v) => formatBytes(v * 1024)} width={60} />
                                        <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#fff' }}
                                            formatter={(value: number, name: string) => [formatBytes(value * 1024), name === 'bytesInKB' ? 'In' : 'Out']} />
                                        <Area type="monotone" dataKey="bytesInKB" stroke="#22c55e" fill="url(#colorIn)" name="In" />
                                        <Area type="monotone" dataKey="bytesOutKB" stroke="#3b82f6" fill="url(#colorOut)" name="Out" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Segments Chart */}
                            <div className="chart-section">
                                <div className="chart-title">Segments</div>
                                <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                                    <AreaChart data={history} syncId={SYNC_ID}>
                                        <defs>
                                            <linearGradient id="colorSegsIn" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="colorSegsOut" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                        <XAxis dataKey="time" tick={{ fill: '#9ca3af', fontSize: 9 }} hide />
                                        <YAxis tick={{ fill: '#9ca3af', fontSize: 9 }} width={60} />
                                        <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [value.toLocaleString(), name]} />
                                        <Area type="monotone" dataKey="segmentsIn" stroke="#8b5cf6" fill="url(#colorSegsIn)" name="Segs In" />
                                        <Area type="monotone" dataKey="segmentsOut" stroke="#06b6d4" fill="url(#colorSegsOut)" name="Segs Out" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>

                            {/* RTT Chart */}
                            <div className="chart-section">
                                <div className="chart-title">Round Trip Time (RTT)</div>
                                <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                                    <LineChart data={history} syncId={SYNC_ID}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                        <XAxis dataKey="time" tick={{ fill: '#9ca3af', fontSize: 9 }} hide />
                                        <YAxis tick={{ fill: '#9ca3af', fontSize: 9 }} tickFormatter={(v) => `${v.toFixed(0)}ms`} width={60} />
                                        <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value.toFixed(2)} ms`, 'RTT']} />
                                        <Line type="monotone" dataKey="rttMs" stroke="#f59e0b" strokeWidth={2} dot={false} name="RTT" />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Bandwidth Chart */}
                            <div className="chart-section">
                                <div className="chart-title">Bandwidth</div>
                                <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                                    <LineChart data={history} syncId={SYNC_ID}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                        <XAxis dataKey="time" tick={{ fill: '#9ca3af', fontSize: 9 }} hide />
                                        <YAxis tick={{ fill: '#9ca3af', fontSize: 9 }} tickFormatter={(v) => `${v.toFixed(1)} Mbps`} width={60} />
                                        <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value.toFixed(2)} Mbps`, '']} />
                                        <Line type="monotone" dataKey="inBwMbps" stroke="#22c55e" strokeWidth={2} dot={false} name="In" />
                                        <Line type="monotone" dataKey="outBwMbps" stroke="#3b82f6" strokeWidth={2} dot={false} name="Out" />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Retransmissions Chart */}
                            <div className="chart-section">
                                <div className="chart-title">Retransmissions</div>
                                <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                                    <ComposedChart data={history} syncId={SYNC_ID}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                        <XAxis dataKey="time" tick={{ fill: '#9ca3af', fontSize: 9 }} hide />
                                        <YAxis tick={{ fill: '#9ca3af', fontSize: 9 }} tickFormatter={(v) => formatBytes(v)} width={60} />
                                        <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [formatBytes(value), 'Bytes Retrans']} />
                                        <Bar dataKey="retrans" fill="#ef4444" name="Retrans" opacity={0.7} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>

                            {/* CWND Chart with Brush for Zoom */}
                            <div className="chart-section">
                                <div className="chart-title">Congestion Window (CWND)</div>
                                <ResponsiveContainer width="100%" height={CHART_HEIGHT + 40}>
                                    <AreaChart data={history} syncId={SYNC_ID}>
                                        <defs>
                                            <linearGradient id="colorCwnd" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                        <XAxis dataKey="time" tick={{ fill: '#9ca3af', fontSize: 9 }} />
                                        <YAxis tick={{ fill: '#9ca3af', fontSize: 9 }} tickFormatter={(v) => `${v.toFixed(0)} KB`} width={60} />
                                        <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value.toFixed(1)} KB`, 'CWND']} />
                                        <Area type="monotone" dataKey="cwndKB" stroke="#f59e0b" fill="url(#colorCwnd)" name="CWND" />
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
