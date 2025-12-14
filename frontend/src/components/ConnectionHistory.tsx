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
    Bar
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
    connectionKey: string; // "localAddr:localPort -> remoteAddr:remotePort"
    getHistory: () => Promise<ConnectionHistoryPoint[]>;
    viewingHistorical?: boolean; // True if viewing a snapshot (history limited to that point)
}

type MetricTab = 'traffic' | 'segments' | 'rtt' | 'retrans' | 'bandwidth' | 'cwnd';

const ConnectionHistory: React.FC<ConnectionHistoryProps> = ({
    isOpen,
    onClose,
    connectionKey,
    getHistory,
    viewingHistorical = false,
}) => {
    const [history, setHistory] = useState<ConnectionHistoryPoint[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<MetricTab>('traffic');

    useEffect(() => {
        if (isOpen) {
            loadHistory();
        }
    }, [isOpen]);

    const loadHistory = async () => {
        setIsLoading(true);
        try {
            const data = await getHistory();
            // Format timestamps for chart
            const formatted = (data || []).map((point, i) => ({
                ...point,
                time: new Date(point.timestamp).toLocaleTimeString(),
                index: i,
                // Convert bytes to KB/MB for readability
                bytesInKB: point.bytesIn / 1024,
                bytesOutKB: point.bytesOut / 1024,
                // RTT is already in milliseconds from Windows API
                rttMs: point.rtt,
                minRttMs: point.minRtt,
                maxRttMs: point.maxRtt,
                // Bandwidth in Mbps
                inBwMbps: point.inBandwidth / 1000000,
                outBwMbps: point.outBandwidth / 1000000,
                // Cwnd in KB
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

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="history-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>📈 Connection History</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="connection-label">{connectionKey}</div>

                <div className="tab-bar">
                    <button
                        className={`tab ${activeTab === 'traffic' ? 'active' : ''}`}
                        onClick={() => setActiveTab('traffic')}
                    >
                        Traffic
                    </button>
                    <button
                        className={`tab ${activeTab === 'segments' ? 'active' : ''}`}
                        onClick={() => setActiveTab('segments')}
                    >
                        Segments
                    </button>
                    <button
                        className={`tab ${activeTab === 'rtt' ? 'active' : ''}`}
                        onClick={() => setActiveTab('rtt')}
                    >
                        RTT
                    </button>
                    <button
                        className={`tab ${activeTab === 'retrans' ? 'active' : ''}`}
                        onClick={() => setActiveTab('retrans')}
                    >
                        Retrans
                    </button>
                    <button
                        className={`tab ${activeTab === 'bandwidth' ? 'active' : ''}`}
                        onClick={() => setActiveTab('bandwidth')}
                    >
                        Bandwidth
                    </button>
                    <button
                        className={`tab ${activeTab === 'cwnd' ? 'active' : ''}`}
                        onClick={() => setActiveTab('cwnd')}
                    >
                        CWND
                    </button>
                </div>

                <div className="modal-body">
                    {isLoading ? (
                        <div className="loading-state">Loading history...</div>
                    ) : history.length === 0 ? (
                        <div className="empty-state">
                            <p>No history recorded for this connection.</p>
                            <p className="hint">Start recording to capture data.</p>
                        </div>
                    ) : (
                        <div className="chart-container">
                            {activeTab === 'traffic' && (
                                <ResponsiveContainer width="100%" height={280}>
                                    <AreaChart data={history}>
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
                                        <XAxis
                                            dataKey="time"
                                            tick={{ fill: '#9ca3af', fontSize: 10 }}
                                            interval="preserveStartEnd"
                                        />
                                        <YAxis
                                            tick={{ fill: '#9ca3af', fontSize: 10 }}
                                            tickFormatter={(v) => formatBytes(v * 1024)}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: '#1f2937',
                                                border: '1px solid #374151',
                                                borderRadius: '4px'
                                            }}
                                            labelStyle={{ color: '#fff' }}
                                            formatter={(value: number, name: string) => [
                                                formatBytes(value * 1024),
                                                name === 'bytesInKB' ? 'Bytes In' : 'Bytes Out'
                                            ]}
                                        />
                                        <Legend />
                                        <Area
                                            type="monotone"
                                            dataKey="bytesInKB"
                                            stroke="#22c55e"
                                            fill="url(#colorIn)"
                                            name="Bytes In"
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="bytesOutKB"
                                            stroke="#3b82f6"
                                            fill="url(#colorOut)"
                                            name="Bytes Out"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            )}

                            {activeTab === 'rtt' && (
                                <ResponsiveContainer width="100%" height={280}>
                                    <LineChart data={history}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                        <XAxis
                                            dataKey="time"
                                            tick={{ fill: '#9ca3af', fontSize: 10 }}
                                            interval="preserveStartEnd"
                                        />
                                        <YAxis
                                            tick={{ fill: '#9ca3af', fontSize: 10 }}
                                            tickFormatter={(v) => `${v.toFixed(1)}ms`}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: '#1f2937',
                                                border: '1px solid #374151',
                                                borderRadius: '4px'
                                            }}
                                            formatter={(value: number) => [`${value.toFixed(2)} ms`, 'RTT']}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="rttMs"
                                            stroke="#f59e0b"
                                            strokeWidth={2}
                                            dot={false}
                                            name="RTT"
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            )}

                            {activeTab === 'retrans' && (
                                <ResponsiveContainer width="100%" height={280}>
                                    <ComposedChart data={history}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                        <XAxis
                                            dataKey="time"
                                            tick={{ fill: '#9ca3af', fontSize: 10 }}
                                            interval="preserveStartEnd"
                                        />
                                        <YAxis
                                            tick={{ fill: '#9ca3af', fontSize: 10 }}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: '#1f2937',
                                                border: '1px solid #374151',
                                                borderRadius: '4px'
                                            }}
                                            formatter={(value: number) => [formatBytes(value), 'Bytes Retransmitted']}
                                        />
                                        <Bar
                                            dataKey="retrans"
                                            fill="#ef4444"
                                            name="Retransmissions"
                                            opacity={0.7}
                                        />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            )}

                            {activeTab === 'segments' && (
                                <ResponsiveContainer width="100%" height={280}>
                                    <AreaChart data={history}>
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
                                        <XAxis dataKey="time" tick={{ fill: '#9ca3af', fontSize: 10 }} interval="preserveStartEnd" />
                                        <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '4px' }}
                                            formatter={(value: number, name: string) => [value.toLocaleString(), name]}
                                        />
                                        <Legend />
                                        <Area type="monotone" dataKey="segmentsIn" stroke="#8b5cf6" fill="url(#colorSegsIn)" name="Segs In" />
                                        <Area type="monotone" dataKey="segmentsOut" stroke="#06b6d4" fill="url(#colorSegsOut)" name="Segs Out" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            )}

                            {activeTab === 'bandwidth' && (
                                <ResponsiveContainer width="100%" height={280}>
                                    <LineChart data={history}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                        <XAxis dataKey="time" tick={{ fill: '#9ca3af', fontSize: 10 }} interval="preserveStartEnd" />
                                        <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={(v) => `${v.toFixed(1)} Mbps`} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '4px' }}
                                            formatter={(value: number) => [`${value.toFixed(2)} Mbps`, '']}
                                        />
                                        <Legend />
                                        <Line type="monotone" dataKey="inBwMbps" stroke="#22c55e" strokeWidth={2} dot={false} name="In" />
                                        <Line type="monotone" dataKey="outBwMbps" stroke="#3b82f6" strokeWidth={2} dot={false} name="Out" />
                                    </LineChart>
                                </ResponsiveContainer>
                            )}

                            {activeTab === 'cwnd' && (
                                <ResponsiveContainer width="100%" height={280}>
                                    <AreaChart data={history}>
                                        <defs>
                                            <linearGradient id="colorCwnd" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                        <XAxis dataKey="time" tick={{ fill: '#9ca3af', fontSize: 10 }} interval="preserveStartEnd" />
                                        <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={(v) => `${v.toFixed(0)} KB`} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '4px' }}
                                            formatter={(value: number) => [`${value.toFixed(1)} KB`, 'CWND']}
                                        />
                                        <Area type="monotone" dataKey="cwndKB" stroke="#f59e0b" fill="url(#colorCwnd)" name="Congestion Window" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            )}
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
