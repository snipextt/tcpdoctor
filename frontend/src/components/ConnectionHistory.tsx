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

const HistoryCharts = React.memo(({ data, onHover, onZoom, zoomRange, hoverIndex, visibleCharts }: {
    data: ConnectionHistoryPoint[];
    onHover: (index: number | null) => void;
    onZoom: (min: number, max: number) => void;
    zoomRange: { min: number, max: number } | null;
    hoverIndex: number | null;
    visibleCharts: Set<string>;
}) => {
    const chartRefs = useRef<(ChartJS | null)[]>([]);

    const crosshairPlugin = useMemo(() => ({
        id: 'crosshair',
        afterDraw: (chart: ChartJS) => {
            if (hoverIndex === null || !chart.scales.x) return;

            const ctx = chart.ctx;
            const x = chart.scales.x.getPixelForValue(new Date(data[hoverIndex].timestamp).getTime());
            const top = chart.chartArea.top;
            const bottom = chart.chartArea.bottom;

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(x, top);
            ctx.lineTo(x, bottom);
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.restore();
        }
    }), [hoverIndex, data]);

    useEffect(() => {
        const index = hoverIndex;
        if (index === null) {
            chartRefs.current.forEach(chart => {
                if (chart && chart.ctx) {
                    chart.setActiveElements([]);
                    chart.update();
                }
            });
            return;
        }

        chartRefs.current.forEach(chart => {
            if (chart && chart.ctx) {
                const activeElements: ActiveElement[] = [];
                chart.data.datasets.forEach((_, datasetIndex) => {
                    const meta = chart.getDatasetMeta(datasetIndex);
                    const element = meta.data[index];
                    if (element) {
                        activeElements.push({ datasetIndex, index, element: element as any });
                    }
                });
                chart.setActiveElements(activeElements);
                chart.update();
            }
        });
    }, [hoverIndex, data]);

    // Build options with tooltip ENABLED and DRAG-to-ZOOM enabled
    const options = useMemo(() => {
        const opts: ChartOptions<any> = {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            layout: {
                padding: { top: 0, bottom: 0, left: 0, right: 0 }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.9)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#666',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: true,
                    titleFont: { size: 12, family: 'JetBrains Mono' },
                    bodyFont: { size: 11, family: 'JetBrains Mono' },
                    callbacks: {
                        label: function (context: any) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null && context.parsed.y !== undefined) {
                                label += context.parsed.y.toFixed(2);
                            }
                            return label;
                        }
                    }
                },
                zoom: {
                    pan: {
                        enabled: true,
                        mode: 'x',
                        modifierKey: 'alt',
                    },
                    zoom: {
                        drag: {
                            enabled: true,
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            borderColor: 'rgba(59, 130, 246, 0.4)',
                            borderWidth: 1,
                        },
                        wheel: { enabled: true },
                        pinch: { enabled: true },
                        mode: 'x',
                        onZoomComplete: ({ chart }: { chart: ChartJS }) => {
                            const { min, max } = chart.scales.x;
                            onZoom(min, max);
                        },
                    }
                }
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
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false,
                    },
                    ticks: {
                        color: '#6c757d',
                        font: { size: 10, family: 'JetBrains Mono' },
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 8,
                    },
                    ...(zoomRange && { min: zoomRange.min, max: zoomRange.max })
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false,
                    },
                    ticks: {
                        color: '#6c757d',
                        font: { size: 10, family: 'JetBrains Mono' },
                    },
                    beginAtZero: true,
                }
            }
        };

        opts.onHover = (_: ChartEvent, elements: ActiveElement[]) => {
            if (elements && elements.length > 0) {
                onHover(elements[0].index);
            }
        };

        return opts;
    }, [zoomRange, onZoom, onHover]);

    const chartData = useMemo(() => {
        const timestamps = data.map(d => new Date(d.timestamp).getTime());

        return {
            bandwidth: {
                labels: timestamps,
                datasets: [
                    {
                        label: 'In (Mbps)',
                        data: data.map(d => d.inBwMbps),
                        borderColor: '#22c55e',
                        backgroundColor: '#22c55e',
                        borderWidth: 1.5,
                        pointRadius: 0,
                        tension: 0.2,
                    },
                    {
                        label: 'Out (Mbps)',
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
                        backgroundColor: 'rgba(239, 68, 68, 0.8)',
                        borderColor: '#ef4444',
                        borderWidth: 0,
                        barPercentage: 1.0,
                        categoryPercentage: 1.0,
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
                            gradient.addColorStop(0, 'rgba(59, 130, 246, 0.2)');
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
                            gradient.addColorStop(0, 'rgba(245, 158, 11, 0.2)');
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

    const plugins = [crosshairPlugin];

    return (
        <div className="charts-container" onMouseLeave={() => onHover(null)}>
            {visibleCharts.has('bandwidth') && (
                <div className="chart-section">
                    <div className="chart-title">
                        Bandwidth (Mbps)
                        <span className="inline-legend">
                            <span className="legend-item"><span className="legend-dot" style={{ backgroundColor: '#22c55e' }}></span> In</span>
                            <span className="legend-item"><span className="legend-dot" style={{ backgroundColor: '#3b82f6' }}></span> Out</span>
                        </span>
                    </div>
                    <div style={{ height: 200 }}>
                        <Line ref={(el: any) => chartRefs.current[0] = el} data={chartData.bandwidth} options={options} plugins={plugins as any} />
                    </div>
                </div>
            )}

            {visibleCharts.has('retrans') && (
                <div className="chart-section">
                    <div className="chart-title">Retransmissions (Bytes)</div>
                    <div style={{ height: 160 }}>
                        <Bar ref={(el: any) => chartRefs.current[1] = el} data={chartData.retrans} options={options} plugins={plugins as any} />
                    </div>
                </div>
            )}

            {visibleCharts.has('cwnd') && (
                <div className="chart-section">
                    <div className="chart-title">Congestion Window (CWND)</div>
                    <div style={{ height: 180 }}>
                        <Line ref={(el: any) => chartRefs.current[2] = el} data={chartData.cwnd} options={options} plugins={plugins as any} />
                    </div>
                </div>
            )}

            {visibleCharts.has('rtt') && (
                <div className="chart-section">
                    <div className="chart-title">Round Trip Time (ms)</div>
                    <div style={{ height: 180 }}>
                        <Line ref={(el: any) => chartRefs.current[3] = el} data={chartData.rtt} options={options} plugins={plugins as any} />
                    </div>
                </div>
            )}
        </div>
    );
});

const ConnectionHistory: React.FC<ConnectionHistoryProps> = ({
    isOpen,
    onClose,
    connectionKey,
    getHistory,
    viewingHistorical = false
}) => {
    const [fullHistory, setFullHistory] = useState<ConnectionHistoryPoint[]>([]);
    const [displayData, setDisplayData] = useState<ConnectionHistoryPoint[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);
    const [zoomRange, setZoomRange] = useState<{ min: number, max: number } | null>(null);
    const [visibleCharts, setVisibleCharts] = useState<Set<string>>(new Set(['bandwidth', 'retrans', 'cwnd', 'rtt']));

    useEffect(() => {
        if (isOpen) {
            loadHistory();
        }
    }, [isOpen]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;

            if (e.key === 'r' && zoomRange) {
                resetZoom();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, zoomRange]);

    const loadHistory = async () => {
        setIsLoading(true);
        try {
            const rawData = await getHistory();
            const formatted = rawData.map((point, i) => ({
                ...point,
                uiKey: `${point.timestamp}-${i}`,
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

    const toggleChart = (chartId: string) => {
        const newSet = new Set(visibleCharts);
        if (newSet.has(chartId)) {
            newSet.delete(chartId);
        } else {
            newSet.add(chartId);
        }
        setVisibleCharts(newSet);
    };

    const zoomStep = (factor: number) => {
        if (!zoomRange && displayData.length > 0) {
            const start = new Date(displayData[0].timestamp).getTime();
            const end = new Date(displayData[displayData.length - 1].timestamp).getTime();
            const span = end - start;
            const mid = start + span / 2;
            const newSpan = span * factor;
            handleZoom(mid - newSpan / 2, mid + newSpan / 2);
            return;
        }
        if (zoomRange) {
            const span = zoomRange.max - zoomRange.min;
            const mid = zoomRange.min + span / 2;
            const newSpan = span * factor;
            handleZoom(mid - newSpan / 2, mid + newSpan / 2);
        }
    };

    const formatBytes = (bytes: number) => {
        if (bytes < 1024) return `${bytes.toFixed(0)} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    if (!isOpen) return null;

    const currentData = hoverIndex !== null && displayData[hoverIndex]
        ? displayData[hoverIndex]
        : (displayData.length > 0 ? displayData[displayData.length - 1] : null);

    const content = (
        <div className={`history-modal unified-charts ${viewingHistorical ? 'embedded-mode' : ''}`} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
                <h2>📈 Connection History</h2>
                <div className="control-toolbar">
                    <button className="tool-btn" onClick={() => zoomStep(0.8)} title="Zoom In (+)">Zoom In</button>
                    <button className="tool-btn" onClick={() => zoomStep(1.2)} title="Zoom Out (-)">Zoom Out</button>
                    <div className="tool-separator"></div>
                    <button className="tool-btn" onClick={resetZoom} disabled={!zoomRange} title="Reset Zoom (R)">⟲ Reset</button>
                    <div className="tool-separator"></div>
                    <button className={`tool-btn ${visibleCharts.has('bandwidth') ? 'active' : ''}`} onClick={() => toggleChart('bandwidth')} title="Toggle Bandwidth">B</button>
                    <button className={`tool-btn ${visibleCharts.has('retrans') ? 'active' : ''}`} onClick={() => toggleChart('retrans')} title="Toggle Retrans">R</button>
                    <button className={`tool-btn ${visibleCharts.has('cwnd') ? 'active' : ''}`} onClick={() => toggleChart('cwnd')} title="Toggle CWND">C</button>
                    <button className={`tool-btn ${visibleCharts.has('rtt') ? 'active' : ''}`} onClick={() => toggleChart('rtt')} title="Toggle RTT">T</button>
                </div>
                {!viewingHistorical && <button className="close-btn" onClick={onClose}>×</button>}
            </div>

            {!viewingHistorical && <div className="connection-label">{connectionKey}</div>}

            {currentData && (
                <div className="inspector-header">
                    <div className="inspector-item">
                        <span className="label">Time</span>
                        <span className="value">{currentData.time}</span>
                    </div>
                    <div className="inspector-item">
                        <span className="label">RTT</span>
                        <span className="value rtt">{currentData.rttMs?.toFixed(0)} ms</span>
                    </div>
                    <div className="inspector-item">
                        <span className="label">CWND</span>
                        <span className="value cwnd">{currentData.cwndKB?.toFixed(1)} KB</span>
                    </div>
                    <div className="inspector-item">
                        <span className="label">Retrans</span>
                        <span className="value retrans">{formatBytes(currentData.retrans || 0)}</span>
                    </div>
                    <div className="inspector-item">
                        <span className="label">BW In</span>
                        <span className="value bw-in">{currentData.inBwMbps?.toFixed(2)} Mbps</span>
                    </div>
                    <div className="inspector-item">
                        <span className="label">BW Out</span>
                        <span className="value bw-out">{currentData.outBwMbps?.toFixed(2)} Mbps</span>
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
                    <>
                        <div className="interaction-hint">
                            💡 Click and drag to zoom • Mouse wheel to zoom • Alt+Drag to pan • Press 'R' to reset
                        </div>
                        <HistoryCharts
                            data={displayData}
                            onHover={setHoverIndex}
                            onZoom={handleZoom}
                            zoomRange={zoomRange}
                            hoverIndex={hoverIndex}
                            visibleCharts={visibleCharts}
                        />
                    </>
                )}
            </div>
        </div>
    );

    if (viewingHistorical) {
        return content;
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            {content}
        </div>
    );
};

export default ConnectionHistory;