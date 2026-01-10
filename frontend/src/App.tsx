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
    GetConnectionHistoryForSession,
    GetSessions,
    GetSessionTimeline
} from "../wailsjs/go/main/App";
import { tcpmonitor } from "../wailsjs/go/models";
import ConnectionTable from './components/ConnectionTable';
import FilterControls from './components/FilterControls';
import ConnectionFilters, { FilterState } from './components/ConnectionFilters';
import StatsPanel from './components/StatsPanel';
import SettingsModal from './components/SettingsModal';
import HealthReportModal from './components/HealthReportModal';
import SnapshotControls from './components/SnapshotControls';
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
    const [viewingSnapshotId, setViewingSnapshotId] = useState<number | null>(null);
    const viewingSnapshotRef = useRef<number | null>(null); // Ref to check in async callbacks
    const [sessionTimeline, setSessionTimeline] = useState<TimelineConnection[]>([]); // Store timeline for session mode

    // Advanced Filters
    const [advancedFilters, setAdvancedFilters] = useState<FilterState>({
        hideInternal: false,
        hideLocalhost: false,
        stateFilter: '',
        rtt: '',
        bytesIn: '',
        bytesOut: '',
        bandwidth: '',
        showOnlyRetrans: false,
    });
    const [filtersExpanded, setFiltersExpanded] = useState(false);

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

    // Refresh connections - only updates state if not viewing a snapshot
    const refreshConnections = useCallback(async () => {
        // Skip if viewing a snapshot (check ref before starting)
        if (viewingSnapshotRef.current !== null) return;

        try {
            const conns = await GetConnections(filter);

            // Check AFTER async call - if user loaded a session while fetching, don't overwrite
            if (viewingSnapshotRef.current !== null) return;

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

    // Client-side filtering for snapshot mode and advanced filters
    const filteredConnections = useMemo(() => {
        let result = connections;

        // Apply basic filter first (backend already does this in live mode for text search)
        if (viewingSnapshotId !== null) {
            result = result.filter(conn => {
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

                // State filter from basic filters
                if (filter.State && filter.State > 0 && conn.State !== filter.State) {
                    return false;
                }

                return true;
            });
        }

        // Apply advanced filters (always, both live and snapshot)
        return result.filter(conn => {
            // Hide localhost
            if (advancedFilters.hideLocalhost) {
                if (conn.LocalAddr === '127.0.0.1' || conn.RemoteAddr === '127.0.0.1' ||
                    conn.LocalAddr === '::1' || conn.RemoteAddr === '::1') {
                    return false;
                }
            }

            // Hide internal/private IPs
            if (advancedFilters.hideInternal) {
                const isPrivate = (ip: string) => {
                    if (!ip) return false;
                    return ip.startsWith('10.') ||
                        ip.startsWith('192.168.') ||
                        ip.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./) ||
                        ip.startsWith('127.') ||
                        ip === '::1';
                };
                if (isPrivate(conn.RemoteAddr)) return false;
            }

            // State filter
            if (advancedFilters.stateFilter && conn.State !== parseInt(advancedFilters.stateFilter)) {
                return false;
            }

            // Helper to parse condition string (e.g. "> 50", "<= 100")
            const checkMetric = (value: number, condition: string): boolean => {
                if (!condition) return true;
                const match = condition.trim().match(/^([<>]=?|=)?\s*(\d+(\.\d+)?([KMG]B?)?)$/i);
                if (!match) return true; // Invalid format treated as pass or could be false

                const operator = match[1] || '>='; // Default to >= if no operator
                let threshold = parseFloat(match[2]);

                // Handle suffixes for bytes/bandwidth
                const suffix = match[2].match(/[KMG]B?$/i)?.[0].toUpperCase();
                if (suffix) {
                    const num = parseFloat(match[2]);
                    if (suffix.startsWith('K')) threshold = num * 1024;
                    if (suffix.startsWith('M')) threshold = num * 1024 * 1024;
                    if (suffix.startsWith('G')) threshold = num * 1024 * 1024 * 1024;
                }

                switch (operator) {
                    case '>': return value > threshold;
                    case '>=': return value >= threshold;
                    case '<': return value < threshold;
                    case '<=': return value <= threshold;
                    case '=': return value === threshold;
                    default: return value >= threshold;
                }
            };

            // RTT filter
            const rtt = conn.ExtendedStats?.SmoothedRTT || 0;
            if (advancedFilters.rtt && !checkMetric(rtt, advancedFilters.rtt)) {
                return false;
            }

            // Bytes filters
            if (advancedFilters.bytesIn && !checkMetric(conn.BasicStats?.DataBytesIn || 0, advancedFilters.bytesIn)) {
                return false;
            }
            if (advancedFilters.bytesOut && !checkMetric(conn.BasicStats?.DataBytesOut || 0, advancedFilters.bytesOut)) {
                return false;
            }

            // Bandwidth filter
            const bw = Math.max(
                conn.ExtendedStats?.InboundBandwidth || 0,
                conn.ExtendedStats?.OutboundBandwidth || 0
            );
            if (advancedFilters.bandwidth && !checkMetric(bw, advancedFilters.bandwidth)) {
                return false;
            }

            // Retransmissions only
            if (advancedFilters.showOnlyRetrans) {
                if ((conn.ExtendedStats?.BytesRetrans || 0) === 0 &&
                    (conn.ExtendedStats?.SegsRetrans || 0) === 0) {
                    return false;
                }
            }

            return true;
        });
    }, [connections, filter, viewingSnapshotId, advancedFilters]);

    // Compute history for selected connection in session mode
    const selectedConnectionHistory = useMemo(() => {
        if (!selectedConnection || !viewingSnapshotId || sessionTimeline.length === 0) {
            return undefined;
        }

        // Filter timeline to get all entries for the selected connection
        const connectionEntries = sessionTimeline.filter(item =>
            item.connection.localAddr === selectedConnection.LocalAddr &&
            item.connection.localPort === selectedConnection.LocalPort &&
            item.connection.remoteAddr === selectedConnection.RemoteAddr &&
            item.connection.remotePort === selectedConnection.RemotePort
        );

        // Convert to StatsPanel history format
        return connectionEntries.map(item => ({
            time: new Date(item.timestamp).getTime(),
            rtt: item.connection.rtt || 0,
            bwIn: item.connection.inBandwidth || 0,
            bwOut: item.connection.outBandwidth || 0,
        }));
    }, [selectedConnection, viewingSnapshotId, sessionTimeline]);

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
        viewingSnapshotRef.current = null;
        setViewingSnapshotId(null); // Go back to live if viewing was active
    };

    const handleExportSession = async (sessionId: number) => {
        // Get session timeline data
        const timeline = await GetSessionTimeline(sessionId);
        const sessions = await GetSessions();
        const session = sessions?.find((s: { id: number }) => s.id === sessionId);

        if (!timeline || !session) return;

        // Create export data
        const exportData = {
            session: session,
            timeline: timeline,
            exportedAt: new Date().toISOString()
        };

        // Download as JSON
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `session-${sessionId}-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImportSession = () => {
        // Create file input and trigger
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;

            try {
                const text = await file.text();
                const data = JSON.parse(text);

                // Load the timeline directly
                if (data.timeline && Array.isArray(data.timeline)) {
                    handleLoadSession(data.session?.id || Date.now(), data.timeline);
                }
            } catch (err) {
                console.error('Failed to import session:', err);
                alert('Failed to import session. Invalid file format.');
            }
        };
        input.click();
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
            // New Stats
            winScaleRcvd: number;
            winScaleSent: number;
            curRwinRcvd: number;
            maxRwinRcvd: number;
            curRwinSent: number;
            maxRwinSent: number;
            curMss: number;
            maxMss: number;
            minMss: number;
            dupAcksIn: number;
            dupAcksOut: number;
            sacksRcvd: number;
            sackBlocksRcvd: number;
            dsackDups: number;
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
                // New Stats Mapping
                WinScaleRcvd: item.connection.winScaleRcvd || 0,
                WinScaleSent: item.connection.winScaleSent || 0,
                CurRwinRcvd: item.connection.curRwinRcvd || 0,
                MaxRwinRcvd: item.connection.maxRwinRcvd || 0,
                CurRwinSent: item.connection.curRwinSent || 0,
                MaxRwinSent: item.connection.maxRwinSent || 0,
                CurMss: item.connection.curMss || 0,
                MaxMss: item.connection.maxMss || 0,
                MinMss: item.connection.minMss || 0,
                DupAcksIn: item.connection.dupAcksIn || 0,
                DupAcksOut: item.connection.dupAcksOut || 0,
                SacksRcvd: item.connection.sacksRcvd || 0,
                SackBlocksRcvd: item.connection.sackBlocksRcvd || 0,
                DsackDups: item.connection.dsackDups || 0,
            },
            convertValues: () => { },
        })) as any[];
        setConnections(convertedConnections);
        setSessionTimeline(timeline); // Store timeline for StatsPanel
        viewingSnapshotRef.current = sessionId; // Update ref FIRST (prevents race conditions)
        setViewingSnapshotId(sessionId); // Reuse this state for session viewing
        setSelectedConnection(null);
        setIsTimelineOpen(false);
    };

    const handleBackToLive = () => {
        viewingSnapshotRef.current = null; // Clear ref FIRST
        setViewingSnapshotId(null);
        setSessionTimeline([]); // Clear timeline
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
                            sessionCount={snapshotCount}
                            onStartRecording={handleStartRecording}
                            onStopRecording={handleStopRecording}
                            getSessions={GetSessions}
                            getSessionTimeline={GetSessionTimeline}
                            onLoadSession={handleLoadSession}
                            onClear={handleClearSnapshots}
                            onExportSession={handleExportSession}
                            onImportSession={handleImportSession}
                        />
                    )}
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
                        advancedFilters={advancedFilters}
                        onAdvancedFiltersChange={setAdvancedFilters}
                    />
                    <ConnectionFilters
                        filters={advancedFilters}
                        onFiltersChange={setAdvancedFilters}
                        isExpanded={filtersExpanded}
                        onToggleExpand={() => setFiltersExpanded(!filtersExpanded)}
                    />
                    <ConnectionTable
                        connections={filteredConnections}
                        selectedConnection={selectedConnection}
                        onSelectConnection={setSelectedConnection}
                        isLoading={isLoading}
                        viewingSnapshot={viewingSnapshotId !== null}
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
                        initialHistory={selectedConnectionHistory}
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

            {/* Connection History Modal */}
            {selectedConnection && (
                <ConnectionHistory
                    isOpen={isHistoryOpen}
                    onClose={() => setIsHistoryOpen(false)}
                    connectionKey={`${selectedConnection.LocalAddr}:${selectedConnection.LocalPort} → ${selectedConnection.RemoteAddr}:${selectedConnection.RemotePort}`}
                    getHistory={async () => {
                        // If viewing a session, get history only from that session
                        if (viewingSnapshotId !== null) {
                            return GetConnectionHistoryForSession(
                                viewingSnapshotId,
                                selectedConnection.LocalAddr,
                                selectedConnection.LocalPort,
                                selectedConnection.RemoteAddr,
                                selectedConnection.RemotePort
                            );
                        }
                        // Live mode - get all history
                        return GetConnectionHistory(
                            selectedConnection.LocalAddr,
                            selectedConnection.LocalPort,
                            selectedConnection.RemoteAddr,
                            selectedConnection.RemotePort
                        );
                    }}
                    viewingHistorical={viewingSnapshotId !== null}
                />
            )}
        </div>
    );
}

export default App;
