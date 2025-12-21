import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    GetConnections,
    IsAdministrator,
    GetUpdateInterval,
    ExportToCSV,
    ConfigureLLM,
    IsLLMConfigured,
    DiagnoseConnection,
    GenerateHealthReport,
    StartRecording,
    StopRecording,
    IsRecording,
    GetSessionCount,
    GetSnapshotMeta,
    GetSnapshot,
    CompareSnapshots,
    ClearSnapshots,
    TakeSnapshot,
    GetConnectionHistory,
    GetSessions,
    GetSessionTimeline
} from "../wailsjs/go/main/App";
import { tcpmonitor } from "../wailsjs/go/models";
import ConnectionTable from './components/ConnectionTable';
import FilterControls from './components/FilterControls';
import StatsPanel from './components/StatsPanel';
import SettingsModal from './components/SettingsModal';
import HealthReportModal from './components/HealthReportModal';
import SnapshotControls from './components/SnapshotControls';
import SessionTimeline from './components/SessionTimeline';
import ConnectionHistory from './components/ConnectionHistory';
import './App.css';

function App() {
    const [connectionCount, setConnectionCount] = useState(0);
    const [isAdmin, setIsAdmin] = useState(false);
    const [updateInterval, setUpdateInterval] = useState(() => {
        const saved = localStorage.getItem('refresh_rate');
        return saved ? parseInt(saved, 10) : 1000;
    });
    const [connections, setConnections] = useState<tcpmonitor.ConnectionInfo[]>([]);
    const [selectedConnection, setSelectedConnection] = useState<tcpmonitor.ConnectionInfo | null>(null);
    const [filter, setFilter] = useState<tcpmonitor.FilterOptions>(new tcpmonitor.FilterOptions({
        IPv4Only: false,
        IPv6Only: false,
        SearchText: ""
    }));
    const [isLoading, setIsLoading] = useState(true);

    // AI State
    const [isHealthReportOpen, setIsHealthReportOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isAIConfigured, setIsAIConfigured] = useState(false);

    // Snapshot State
    const [isRecording, setIsRecording] = useState(false);
    const [snapshotCount, setSnapshotCount] = useState(0);
    const [isTimelineOpen, setIsTimelineOpen] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [viewingSnapshotId, setViewingSnapshotId] = useState<number | null>(null); // null = live, number = viewing snapshot

    // Resizable panels
    const [leftPanelWidth, setLeftPanelWidth] = useState(() => {
        const saved = localStorage.getItem('left_panel_width');
        return saved ? parseInt(saved, 10) : 55; // default 55%
    });
    const [isResizing, setIsResizing] = useState(false);
    const containerRef = useRef<HTMLElement>(null);

    // Handle mouse events for resizing
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing || !containerRef.current) return;
            const containerRect = containerRef.current.getBoundingClientRect();
            const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
            // Clamp between 25% and 75%
            const clampedWidth = Math.max(25, Math.min(75, newWidth));
            setLeftPanelWidth(clampedWidth);
        };

        const handleMouseUp = () => {
            if (isResizing) {
                setIsResizing(false);
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                localStorage.setItem('left_panel_width', leftPanelWidth.toString());
            }
        };

        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, leftPanelWidth]);

    // Check if AI is configured on mount
    useEffect(() => {
        const checkAIConfig = async () => {
            try {
                const configured = await IsLLMConfigured();
                setIsAIConfigured(configured);

                // Try to load from localStorage if not configured
                if (!configured) {
                    const savedKey = localStorage.getItem('gemini_api_key');
                    if (savedKey) {
                        try {
                            await ConfigureLLM(savedKey);
                            setIsAIConfigured(true);
                        } catch (e) {
                            console.warn("Failed to restore API key:", e);
                            localStorage.removeItem('gemini_api_key');
                        }
                    }
                }
            } catch (e) {
                console.error("Failed to check AI config:", e);
            }
        };
        checkAIConfig();
    }, []);

    // Initial setup
    useEffect(() => {
        const init = async () => {
            try {
                const admin = await IsAdministrator();
                setIsAdmin(admin);
                const interval = await GetUpdateInterval();
                setUpdateInterval(interval);
            } catch (e) {
                console.error("Failed to initialize:", e);
            }
        };
        init();
    }, []);

    // Refresh connections
    const refreshConnections = useCallback(async () => {
        try {
            const conns = await GetConnections(filter);
            setConnections(conns);
            setConnectionCount(conns.length);

            // Update selected connection if it still exists (use functional update)
            setSelectedConnection(prevSelected => {
                if (!prevSelected) return null;

                const found = conns.find(c =>
                    c.LocalAddr === prevSelected.LocalAddr &&
                    c.LocalPort === prevSelected.LocalPort &&
                    c.RemoteAddr === prevSelected.RemoteAddr &&
                    c.RemotePort === prevSelected.RemotePort
                );

                // Keep updated stats if found, clear if connection closed
                return found || null;
            });
        } catch (error) {
            console.error("Failed to refresh connections:", error);
        } finally {
            setIsLoading(false);
        }
    }, [filter]);

    const handleExport = async () => {
        try {
            await ExportToCSV("");
            console.log("Export initiated");
        } catch (e) {
            console.error("Export failed:", e);
        }
    };

    // Polling effect - also takes snapshots when recording
    // Only poll when not viewing a historical snapshot
    useEffect(() => {
        if (viewingSnapshotId !== null) return; // Viewing history, don't poll

        refreshConnections();
        const intervalId = setInterval(() => {
            refreshConnections();
            if (isRecording) {
                TakeSnapshot();
                GetSessionCount().then(setSnapshotCount);
            }
        }, updateInterval);
        return () => clearInterval(intervalId);
    }, [refreshConnections, updateInterval, isRecording, viewingSnapshotId]);

    const handleFilterChange = (newFilter: tcpmonitor.FilterOptions) => {
        setFilter(newFilter);
    };

    // Client-side filtering for snapshot mode
    const filteredConnections = useMemo(() => {
        if (viewingSnapshotId === null) {
            // Live mode - filtering is done on backend
            return connections;
        }

        // Snapshot mode - apply filters client-side
        return connections.filter(conn => {
            // Text search
            if (filter.SearchText) {
                const search = filter.SearchText.toLowerCase();
                const matchesSearch =
                    conn.LocalAddr?.toLowerCase().includes(search) ||
                    conn.RemoteAddr?.toLowerCase().includes(search) ||
                    String(conn.LocalPort).includes(search) ||
                    String(conn.RemotePort).includes(search) ||
                    String(conn.PID).includes(search);
                if (!matchesSearch) return false;
            }

            // IPv4/IPv6 filters
            if (filter.IPv4Only && conn.LocalAddr?.includes(':')) return false;
            if (filter.IPv6Only && !conn.LocalAddr?.includes(':')) return false;

            // State filter
            if (filter.State && filter.State > 0 && conn.State !== filter.State) {
                return false;
            }

            return true;
        });
    }, [connections, filter, viewingSnapshotId]);

    // AI Handlers
    const handleSaveAPIKey = async (apiKey: string) => {
        await ConfigureLLM(apiKey);
        setIsAIConfigured(true);
    };

    const handleGenerateReport = async () => {
        const result = await GenerateHealthReport();
        return {
            summary: result?.summary || "",
            highlights: result?.highlights || [],
            concerns: result?.concerns || [],
            suggestions: result?.suggestions || [],
            score: result?.score || 0
        };
    };

    const handleDiagnose = async () => {
        if (!selectedConnection) return null;

        const result = await DiagnoseConnection(
            selectedConnection.LocalAddr,
            selectedConnection.LocalPort,
            selectedConnection.RemoteAddr,
            selectedConnection.RemotePort
        );

        return {
            summary: result?.summary || "",
            issues: result?.issues || [],
            possibleCauses: result?.possibleCauses || [],
            recommendations: result?.recommendations || [],
            severity: result?.severity || "warning"
        };
    };

    // Snapshot Handlers
    const handleStartRecording = async () => {
        await StartRecording();
        setIsRecording(true);
    };

    const handleStopRecording = async () => {
        await StopRecording();
        setIsRecording(false);
        const count = await GetSessionCount();
        setSnapshotCount(count);
    };

    const handleClearSnapshots = async () => {
        await ClearSnapshots();
        setSnapshotCount(0);
        setViewingSnapshotId(null); // Go back to live if viewing was active
    };

    // Load a session's timeline into the view (all connections with timestamps)
    interface TimelineConnection {
        timestamp: string;
        connection: {
            localAddr: string;
            localPort: number;
            remoteAddr: string;
            remotePort: number;
            state: number;
            pid: number;
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
        };
    }

    const handleLoadSession = (sessionId: number, timeline: TimelineConnection[]) => {
        // Convert timeline connections to display format
        // Each row includes the timestamp from when it was captured
        const convertedConnections = timeline.map((item) => ({
            Timestamp: item.timestamp, // Add timestamp for timeline view
            LocalAddr: item.connection.localAddr,
            LocalPort: item.connection.localPort,
            RemoteAddr: item.connection.remoteAddr,
            RemotePort: item.connection.remotePort,
            State: item.connection.state,
            PID: item.connection.pid,
            IsIPv6: item.connection.localAddr.includes(':'),
            LastSeen: item.timestamp,
            HighRetransmissionWarning: false,
            HighRTTWarning: false,
            BasicStats: {
                DataBytesIn: item.connection.bytesIn || 0,
                DataBytesOut: item.connection.bytesOut || 0,
                DataSegsIn: item.connection.segmentsIn || 0,
                DataSegsOut: item.connection.segmentsOut || 0,
            },
            ExtendedStats: {
                SmoothedRTT: item.connection.rtt || 0,
                RTTVariance: item.connection.rttVariance || 0,
                MinRTT: item.connection.minRtt || 0,
                MaxRTT: item.connection.maxRtt || 0,
                BytesRetrans: item.connection.retrans || 0,
                SegsRetrans: item.connection.segsRetrans || 0,
                FastRetrans: 0,
                TimeoutEpisodes: 0,
                CurrentCwnd: item.connection.congestionWin || 0,
                InboundBandwidth: item.connection.inBandwidth || 0,
                OutboundBandwidth: item.connection.outBandwidth || 0,
                MaxCwnd: 0,
                MaxSsthresh: 0,
            },
            convertValues: () => { },
        })) as any[];
        setConnections(convertedConnections);
        setViewingSnapshotId(sessionId); // Reuse this state for session viewing
        setSelectedConnection(null);
        setIsTimelineOpen(false);
    };

    const handleBackToLive = () => {
        setViewingSnapshotId(null);
        // Polling will resume automatically due to useEffect dependency
    };

    return (
        <div className="app-container">
            <header className="app-header">
                <div className="logo">
                    <h1>TCP Doctor</h1>
                </div>
                <div className="header-actions">
                    {viewingSnapshotId !== null ? (
                        <div className="viewing-snapshot-indicator">
                            <span className="snapshot-badge">🎬 Viewing Session #{viewingSnapshotId}</span>
                            <button className="btn-back-live" onClick={handleBackToLive}>
                                ← Back to Live
                            </button>
                        </div>
                    ) : (
                        <SnapshotControls
                            isRecording={isRecording}
                            snapshotCount={snapshotCount}
                            onStartRecording={handleStartRecording}
                            onStopRecording={handleStopRecording}
                            onOpenTimeline={() => setIsTimelineOpen(true)}
                        />
                    )}
                    <button className="btn-export" onClick={handleExport}>
                        Export CSV
                    </button>
                    <button
                        className="btn-report"
                        onClick={() => setIsHealthReportOpen(true)}
                        title="Generate AI Health Report"
                    >
                        📊 Health Report
                    </button>
                    <button
                        className="btn-settings"
                        onClick={() => setIsSettingsOpen(true)}
                        title="AI Settings"
                    >
                        ⚙️
                    </button>
                    {!isAdmin && (
                        <div className="admin-warning-badge">
                            ⚠️ Run as Admin
                        </div>
                    )}
                </div>
            </header>

            <main className="app-content" ref={containerRef as React.RefObject<HTMLElement>}>
                <div className="left-panel" style={{ width: `${leftPanelWidth}%` }}>
                    <FilterControls
                        filter={filter}
                        onFilterChange={handleFilterChange}
                    />
                    <ConnectionTable
                        connections={filteredConnections}
                        selectedConnection={selectedConnection}
                        onSelectConnection={setSelectedConnection}
                        isLoading={isLoading}
                    />
                </div>

                <div
                    className="resize-handle"
                    onMouseDown={() => setIsResizing(true)}
                />

                <div className="right-panel" style={{ width: `${100 - leftPanelWidth}%` }}>
                    <StatsPanel
                        connection={selectedConnection}
                        isAdmin={isAdmin}
                        onDiagnose={selectedConnection ? handleDiagnose : undefined}
                        isAIConfigured={isAIConfigured}
                        onConfigureAPI={() => setIsSettingsOpen(true)}
                        onViewHistory={() => setIsHistoryOpen(true)}
                        hasHistory={snapshotCount > 0}
                    />
                </div>
            </main>

            {/* Health Report Modal */}
            <HealthReportModal
                isOpen={isHealthReportOpen}
                onClose={() => setIsHealthReportOpen(false)}
                generateReport={handleGenerateReport}
                isConfigured={isAIConfigured}
                onConfigureAPI={() => {
                    setIsHealthReportOpen(false);
                    setIsSettingsOpen(true);
                }}
            />

            {/* Settings Modal */}
            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                onSaveAPIKey={handleSaveAPIKey}
                refreshRate={updateInterval}
                onRefreshRateChange={setUpdateInterval}
            />

            {/* Session Timeline Modal */}
            <SessionTimeline
                isOpen={isTimelineOpen}
                onClose={() => setIsTimelineOpen(false)}
                getSessions={GetSessions}
                getSessionTimeline={GetSessionTimeline}
                onLoadSession={handleLoadSession}
                onClear={handleClearSnapshots}
            />

            {/* Connection History Modal */}
            {selectedConnection && (
                <ConnectionHistory
                    isOpen={isHistoryOpen}
                    onClose={() => setIsHistoryOpen(false)}
                    connectionKey={`${selectedConnection.LocalAddr}:${selectedConnection.LocalPort} → ${selectedConnection.RemoteAddr}:${selectedConnection.RemotePort}`}
                    getHistory={async () => {
                        const history = await GetConnectionHistory(
                            selectedConnection.LocalAddr,
                            selectedConnection.LocalPort,
                            selectedConnection.RemoteAddr,
                            selectedConnection.RemotePort
                        );
                        // If viewing a snapshot, filter history to only show up to that snapshot
                        if (viewingSnapshotId !== null && history) {
                            // Find the snapshot metadata to get its timestamp
                            const meta = await GetSnapshotMeta();
                            const viewedSnap = meta?.find((s: { id: number }) => s.id === viewingSnapshotId);
                            if (viewedSnap) {
                                const cutoffTime = new Date(viewedSnap.timestamp).getTime();
                                return history.filter((h: { timestamp: string }) => new Date(h.timestamp).getTime() <= cutoffTime);
                            }
                        }
                        return history;
                    }}
                    viewingHistorical={viewingSnapshotId !== null}
                />
            )}
        </div>
    );
}

export default App;
