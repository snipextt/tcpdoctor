import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    Filler,
    TimeScale,
    ChartOptions,
    ScriptableContext,
    ChartEvent,
    ActiveElement,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import zoomPlugin from 'chartjs-plugin-zoom';
import 'chartjs-adapter-date-fns';
import { downsampleData } from '../utils/dataProcessing';
import './ConnectionHistory.css';

// Register ChartJS components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    Filler,
    TimeScale,
    zoomPlugin
);

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
    uiKey?: string;
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

// Chart configuration constants
const COMMON_OPTIONS: ChartOptions<any> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: {
        mode: 'index',
        intersect: false,
    },
    plugins: {
        legend: {
            position: 'top' as const,
            align: 'end' as const,
            labels: {
                boxWidth: 10,
                font: { size: 10 },
                color: '#9ca3af'
            }
        },
        tooltip: {
            enabled: false, // We use custom external inspector
        },
        zoom: {
            pan: { enabled: false }, // Disable pan to avoid confusion
            zoom: {
                drag: {
                    enabled: true,
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    borderColor: 'rgba(59, 130, 246, 0.5)',
                    borderWidth: 1,
                },
                mode: 'x',
            },
        },
    },
    scales: {
        x: {
            type: 'time',
            time: {
                unit: 'second',
                displayFormats: { second: 'HH:mm:ss' },
                tooltipFormat: 'HH:mm:ss.SSS'
            },
            grid: {
                color: 'rgba(255, 255, 255, 0.1)',
            },
            ticks: {
                color: '#9ca3af',
                font: { size: 10 },
                maxRotation: 0,
                autoSkip: true,
            }
        },
        y: {
            grid: {
                color: 'rgba(255, 255, 255, 0.1)',
            },
            ticks: {
                color: '#9ca3af',
                font: { size: 10 },
            }
        }
    }
};

const HistoryCharts = React.memo(({ data, onHover, onZoom, zoomRange }: {
    data: ConnectionHistoryPoint[];
    onHover: (index: number) => void;
    onZoom: (min: number, max: number) => void;
    zoomRange: { min: number, max: number } | null;
}) => {
    const chartRefs = useRef<(ChartJS | null)[]>([]);

    // Shared options with dynamic zoom limits
    const options = useMemo(() => {
        const opts = JSON.parse(JSON.stringify(COMMON_OPTIONS)); // Deep clone
        
        // Add zoom callback
        opts.plugins.zoom.zoom.onZoomComplete = ({ chart }: { chart: ChartJS }) => {
            const { min, max } = chart.scales.x;
            onZoom(min, max);
        };

        // Apply current zoom range if exists
        if (zoomRange) {
            opts.scales.x.min = zoomRange.min;
            opts.scales.x.max = zoomRange.max;
        }

        // Add hover callback
        opts.onHover = (_: ChartEvent, elements: ActiveElement[]) => {
            if (elements && elements.length > 0) {
                onHover(elements[0].index);
            } else {
                // Don't clear on mouse out to keep last value visible, 
                // or clear if preferred. Let's keep it stable.
            }
        };

        return opts;
    }, [zoomRange, onZoom, onHover]);

    // Data prep
    const chartData = useMemo(() => {
        const timestamps = data.map(d => new Date(d.timestamp).getTime());
        
        return {
            bandwidth: {
                labels: timestamps,
                datasets: [
                    {
                        label: 'Inbound',
                        data: data.map(d => d.inBwMbps),
                        borderColor: '#22c55e',
                        backgroundColor: '#22c55e',
                        borderWidth: 1.5,
                        pointRadius: 0,
                        tension: 0.2,
                    },
                    {
                        label: 'Outbound',
                        data: data.map(d => d.outBwMbps),
                        borderColor: '#3b82f6',
                        backgroundColor: '#3b82f6',
                        borderWidth: 1.5,
                        pointRadius: 0,
                        tension: 0.2,
                    }
                ]
            },
            retrans: {
                labels: timestamps,
                datasets: [
                    {
                        type: 'bar' as const,
                        label: 'Retrans (Bytes)',
                        data: data.map(d => d.retrans),
                        backgroundColor: '#ef4444',
                        borderColor: '#ef4444',
                        borderWidth: 1,
                    }
                ]
            },
            cwnd: {
                labels: timestamps,
                datasets: [
                    {
                        label: 'CWND (KB)',
                        data: data.map(d => d.cwndKB),
                        borderColor: '#3b82f6',
                        backgroundColor: (context: ScriptableContext<'line'>) => {
                            const ctx = context.chart.ctx;
                            const gradient = ctx.createLinearGradient(0, 0, 0, 200);
                            gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)');
                            gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');
                            return gradient;
                        },
                        borderWidth: 1.5,
                        pointRadius: 0,
                        fill: true,
                    }
                ]
            },
            rtt: {
                labels: timestamps,
                datasets: [
                    {
                        label: 'RTT (ms)',
                        data: data.map(d => d.rttMs),
                        borderColor: '#f59e0b',
                        backgroundColor: (context: ScriptableContext<'line'>) => {
                            const ctx = context.chart.ctx;
                            const gradient = ctx.createLinearGradient(0, 0, 0, 200);
                            gradient.addColorStop(0, 'rgba(245, 158, 11, 0.5)');
                            gradient.addColorStop(1, 'rgba(245, 158, 11, 0.0)');
                            return gradient;
                        },
                        borderWidth: 1.5,
                        pointRadius: 0,
                        fill: true,
                    }
                ]
            }
        };
    }, [data]);

    return (
        <div className="charts-container">
            <div className="chart-section">
                <div className="chart-title">Bandwidth (Mbps)</div>
                <div style={{ height: 140 }}>
                    <Line ref={(el: any) => chartRefs.current[0] = el} data={chartData.bandwidth} options={options} />
                </div>
            </div>
            <div className="chart-section">
                <div className="chart-title">Retransmissions (Bytes)</div>
                <div style={{ height: 100 }}>
                    <Bar ref={(el: any) => chartRefs.current[1] = el} data={chartData.retrans} options={options} />
                </div>
            </div>
            <div className="chart-section">
                <div className="chart-title">Congestion Window (CWND)</div>
                <div style={{ height: 120 }}>
                    <Line ref={(el: any) => chartRefs.current[2] = el} data={chartData.cwnd} options={options} />
                </div>
            </div>
            <div className="chart-section">
                <div className="chart-title">Round Trip Time (ms)</div>
                <div style={{ height: 120 }}>
                    <Line ref={(el: any) => chartRefs.current[3] = el} data={chartData.rtt} options={options} />
                </div>
            </div>
        </div>
    );
});

const ConnectionHistory: React.FC<ConnectionHistoryProps> = ({
    isOpen,
    onClose,
    connectionKey,
    getHistory,
}) => {
    const [fullHistory, setFullHistory] = useState<ConnectionHistoryPoint[]>([]);
    const [displayData, setDisplayData] = useState<ConnectionHistoryPoint[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);
    const [zoomRange, setZoomRange] = useState<{ min: number, max: number } | null>(null);

    useEffect(() => {
        if (isOpen) {
            loadHistory();
        }
    }, [isOpen]);

    const loadHistory = async () => {
        setIsLoading(true);
        try {
            const rawData = await getHistory();
            // Pre-process for Chart.js
            const formatted = rawData.map((point, i) => ({
                ...point,
                uiKey: `${point.timestamp}-${i}`,
                time: new Date(point.timestamp).toLocaleTimeString(),
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
            // Initial view: use full data (Chart.js canvas handles 2-3k points fine)
            // If > 5000, downsample to 2000 for safety
            setDisplayData(formatted.length > 5000 ? downsampleData(formatted as any, 2000) as ConnectionHistoryPoint[] : formatted);
        } catch (e) {
            console.error('Failed to load history:', e);
        }
        setIsLoading(false);
    };

    const handleZoom = useCallback((min: number, max: number) => {
        setZoomRange({ min, max });
    }, []);

    const resetZoom = () => {
        setZoomRange(null);
    };

    const formatBytes = (bytes: number) => {
        if (bytes < 1024) return `${bytes.toFixed(0)} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    if (!isOpen) return null;

    // Current data point for inspector
    const currentData = hoverIndex !== null && displayData[hoverIndex] 
        ? displayData[hoverIndex] 
        : (displayData.length > 0 ? displayData[displayData.length - 1] : null);

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
                        <div style={{ marginLeft: 'auto' }}>
                            <button 
                                onClick={resetZoom}
                                disabled={!zoomRange}
                                style={{ 
                                    opacity: zoomRange ? 1 : 0.5, 
                                    pointerEvents: zoomRange ? 'auto' : 'none',
                                    padding: '4px 12px',
                                    fontSize: '12px',
                                    background: '#3b82f6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                            >
                                🔍 Reset Zoom
                            </button>
                        </div>
                    </div>
                )}

                <div className="modal-body">
                    {isLoading ? (
                        <div className="loading-state">Loading history...</div>
                    ) : displayData.length === 0 ? (
                        <div className="empty-state">
                            <p>No history recorded for this connection.</p>
                            <p className="hint">Start recording to capture data.</p>
                        </div>
                    ) : (
                        <HistoryCharts 
                            data={displayData} 
                            onHover={setHoverIndex}
                            onZoom={handleZoom}
                            zoomRange={zoomRange}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default ConnectionHistory;