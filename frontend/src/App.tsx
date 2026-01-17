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
    QueryConnections,
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
import ConnectionDetailView from './components/ConnectionDetailView';
// import AIAssistant from './components/AIAssistant'; // Replaced by dedicated View
import SettingsModal from './components/SettingsModal';
// import HealthReportModal from './components/HealthReportModal'; // Disabled
import SnapshotControls from './components/SnapshotControls';
import Sidebar from './components/Sidebar';
import AIAgentView from './components/AIAgentView';
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
    const [activeTab, setActiveTab] = useState('dashboard');
    const [statsVisible, setStatsVisible] = useState(true); // Control visibility of bottom panel
    const [isLoading, setIsLoading] = useState(true);

    // AI Config State
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isAIConfigured, setIsAIConfigured] = useState(false);

    // Snapshot State
    const [isRecording, setIsRecording] = useState(false);
    const [snapshotCount, setSnapshotCount] = useState(0);
    const [viewingSnapshotId, setViewingSnapshotId] = useState<number | null>(null);
    const viewingSnapshotRef = useRef<number | null>(null); // Ref to check in async callbacks
    const [sessionTimeline, setSessionTimeline] = useState<any[]>([]); // Store timeline for session mode

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

    // Check if AI is configured on mount
    const checkAIConfig = async () => {
        try {
            const configured = await IsLLMConfigured();
            setIsAIConfigured(configured);
        } catch (e) {
            console.error("Failed to check AI config:", e);
        }
    };

    useEffect(() => {
        checkAIConfig();
    }, []);

    // Initial setup
    useEffect(() => {
        const init = async () => {
            try {
                const admin = await IsAdministrator();
                setIsAdmin(admin);

                const recording = await IsRecording();
                setIsRecording(recording);

                const count = await GetSessionCount();
                setSnapshotCount(count);
            } catch (e) {
                console.error("Failed to initialize:", e);
            }
        };
        init();
    }, []);

    // Data polling
    useEffect(() => {
        let isMounted = true;
        let intervalId: any = null;

        const fetchData = async () => {
            // Check ref to see if we are in snapshot mode
            if (viewingSnapshotRef.current !== null) return;

            try {
                // Construct filter
                const filterOpts = new tcpmonitor.FilterOptions({
                    IPv4Only: filter.IPv4Only,
                    IPv6Only: filter.IPv6Only,
                    SearchText: filter.SearchText
                });

                // Add advanced filters manually (since they aren't in the struct binding yet or we handle clientside)
                // For now, let's fetch all and filter client side if needed, BUT
                // standard practice: use QueryConnections if you rely on backend filtering.
                // Here we stick to GetConnections for polling loop
                const result = await GetConnections(filterOpts);

                if (isMounted && viewingSnapshotRef.current === null) {
                    // Apply advanced filters client-side
                    let filtered = result || [];

                    if (advancedFilters.hideInternal) {
                        filtered = filtered.filter(c => !c.RemoteAddr.startsWith('10.') && !c.RemoteAddr.startsWith('192.168.'));
                    }
                    if (advancedFilters.hideLocalhost) {
                        filtered = filtered.filter(c => !c.RemoteAddr.startsWith('127.') && c.RemoteAddr !== '::1');
                    }
                    if (advancedFilters.stateFilter) {
                        filtered = filtered.filter(c => c.State === parseInt(advancedFilters.stateFilter));
                    }
                    if (advancedFilters.showOnlyRetrans) {
                        filtered = filtered.filter(c => (c.ExtendedStats?.SegsRetrans || 0) > 0);
                    }

                    // Numeric filters
                    if (advancedFilters.rtt) {
                        const val = parseInt(advancedFilters.rtt);
                        if (!isNaN(val)) filtered = filtered.filter(c => (c.ExtendedStats?.SmoothedRTT || 0) > val);
                    }
                    if (advancedFilters.bandwidth) {
                        // const val = parseInt(advancedFilters.bandwidth);
                        // Bandwidth check skipped for now
                        // if (!isNaN(val)) filtered = filtered.filter(c => (c.ExtendedStats?.InboundBandwidth || 0) > val);
                    }


                    setConnections(filtered);
                    setConnectionCount(filtered.length);
                    setIsLoading(false);

                    // Update selected connection if it exists and is still in the list
                    if (selectedConnection) {
                        const updated = filtered.find(c =>
                            c.LocalAddr === selectedConnection.LocalAddr &&
                            c.LocalPort === selectedConnection.LocalPort &&
                            c.RemoteAddr === selectedConnection.RemoteAddr &&
                            c.RemotePort === selectedConnection.RemotePort
                        );
                        if (updated) {
                            setSelectedConnection(updated);
                        }
                    }
                }
            } catch (err) {
                console.error("Failed to fetch connections:", err);
                if (isMounted) setIsLoading(false);
            }
        };

        fetchData();
        intervalId = setInterval(fetchData, updateInterval);

        return () => {
            isMounted = false;
            if (intervalId) clearInterval(intervalId);
        };
    }, [updateInterval, filter, advancedFilters, selectedConnection]); // Re-run when filters change


    const handleSaveAPIKey = async (key: string) => {
        try {
            // ConfigureLLM expects a single string (the API key) based on wailsjs definition
            await ConfigureLLM(key);
            setIsAIConfigured(true);
            checkAIConfig();
        } catch (e) {
            console.error("Failed to save API key:", e);
            throw e;
        }
    };

    const handleRefreshRateChange = useCallback(async (rate: number) => {
        setUpdateInterval(rate);
    }, []);

    const handleBack = () => {
        setSelectedConnection(null);
    };

    // --- Session / Snapshot Handling ---

    const handleStartRecording = async () => {
        try {
            await StartRecording();
            setIsRecording(true);
            // Update session count
            const count = await GetSessionCount();
            setSnapshotCount(count);
        } catch (e) {
            console.error("Failed to start recording:", e);
        }
    };

    const handleStopRecording = async () => {
        try {
            await StopRecording();
            setIsRecording(false);
            const count = await GetSessionCount();
            setSnapshotCount(count);
        } catch (e) {
            console.error("Failed to stop recording:", e);
        }
    };

    const handleClearSnapshots = async () => {
        try {
            await ClearSnapshots();
            setSnapshotCount(0);
        } catch (e) {
            console.error("Failed to clear snapshots:", e);
        }
    };

    const handleExportSession = async (sessionId: number) => {
        // Not implemented in backend yet? Or we use ExportToCSV?
        // Let's assume generic export or placeholder
        alert("Export started for session " + sessionId);
    };

    const handleImportSession = () => {
        alert("Import not implemented yet");
    };

    // Load a historic session
    const handleLoadSession = useCallback(async (sessionId: number, timeline: any[]) => {
        setViewingSnapshotId(sessionId);
        viewingSnapshotRef.current = sessionId;
        setSessionTimeline(timeline);
        // Note: We do NOT set isRecording to false here - recording continues in background

        // Transform timeline to ConnectionInfo[] for the table
        // Note: timeline contains CompactConnection (camelCase) but table expects ConnectionInfo (PascalCase)
        if (timeline && timeline.length > 0) {
            const uniqueConns = new Map<string, tcpmonitor.ConnectionInfo>();
            timeline.forEach(t => {
                const conn = t.connection;
                // Use camelCase properties from CompactConnection
                const key = `${conn.localAddr}:${conn.localPort}-${conn.remoteAddr}:${conn.remotePort}`;
                if (!uniqueConns.has(key)) {
                    // Transform CompactConnection to ConnectionInfo-like object
                    const connectionInfo = new tcpmonitor.ConnectionInfo({
                        LocalAddr: conn.localAddr,
                        LocalPort: conn.localPort,
                        RemoteAddr: conn.remoteAddr,
                        RemotePort: conn.remotePort,
                        State: conn.state,
                        PID: conn.pid,
                        IsIPv6: conn.localAddr?.includes(':') || false,
                        BasicStats: {
                            DataBytesIn: conn.bytesIn || 0,
                            DataBytesOut: conn.bytesOut || 0,
                            DataSegsIn: conn.segmentsIn || 0,
                            DataSegsOut: conn.segmentsOut || 0,
                        },
                        ExtendedStats: {
                            SmoothedRTT: conn.rtt || 0,
                            RTTVariance: conn.rttVariance || 0,
                            MinRTT: conn.minRtt || 0,
                            MaxRTT: conn.maxRtt || 0,
                            SegsRetrans: conn.segsRetrans || 0,
                            BytesRetrans: conn.retrans || 0,
                            CurrentCwnd: conn.congestionWin || 0,
                            InboundBandwidth: conn.inBandwidth || 0,
                            OutboundBandwidth: conn.outBandwidth || 0,
                            TotalSegsIn: conn.segmentsIn || 0,
                            TotalSegsOut: conn.segmentsOut || 0,
                            ThruBytesAcked: 0,
                            ThruBytesReceived: 0,
                            FastRetrans: 0,
                            TimeoutEpisodes: 0,
                            SampleRTT: conn.rtt || 0,
                            CurrentSsthresh: 0,
                            SlowStartCount: 0,
                            CongAvoidCount: 0,
                            CurRetxQueue: 0,
                            MaxRetxQueue: 0,
                            CurAppWQueue: 0,
                            MaxAppWQueue: 0,
                        },
                    });
                    uniqueConns.set(key, connectionInfo);
                }
            });
            setConnections(Array.from(uniqueConns.values()));
            setConnectionCount(uniqueConns.size);
        } else {
            setConnections([]);
            setConnectionCount(0);
        }
    }, []);

    const handleExitSession = () => {
        setViewingSnapshotId(null);
        viewingSnapshotRef.current = null;
        setSessionTimeline([]);
        // Clean connections so next poll refreshes
        setConnections([]);
    };

    const getHistoryForConnection = async () => {
        if (viewingSnapshotRef.current !== null && selectedConnection) {
            // We are in session mode
            return await GetConnectionHistoryForSession(
                viewingSnapshotRef.current,
                selectedConnection.LocalAddr,
                selectedConnection.LocalPort,
                selectedConnection.RemoteAddr,
                selectedConnection.RemotePort
            );
        } else if (selectedConnection) {
            // Live mode
            return await GetConnectionHistory(
                selectedConnection.LocalAddr,
                selectedConnection.LocalPort,
                selectedConnection.RemoteAddr,
                selectedConnection.RemotePort
            );
        }
        return [];
    };

    const renderContent = () => {
        if (activeTab === 'ai-agent') {
            return (
                <AIAgentView
                    isConfigured={isAIConfigured}
                    onConfigure={() => setIsSettingsOpen(true)}
                    getSessions={GetSessions}

                    getSessionTimeline={GetSessionTimeline}
                    selectedConnection={selectedConnection}
                    onDiagnoseConnection={async (conn: tcpmonitor.ConnectionInfo | null) => {
                        if (!conn) return null;
                        return await DiagnoseConnection(
                            conn.LocalAddr,
                            conn.LocalPort,
                            conn.RemoteAddr,
                            conn.RemotePort
                        );
                    }}
                />
            );
        }



        if (selectedConnection) {
            return (
                <ConnectionDetailView
                    connection={selectedConnection}
                    onBack={handleBack}
                    isAdmin={isAdmin}
                    isAIConfigured={isAIConfigured}
                    onDiagnose={() => DiagnoseConnection(
                        selectedConnection.LocalAddr,
                        selectedConnection.LocalPort,
                        selectedConnection.RemoteAddr,
                        selectedConnection.RemotePort
                    )}
                    onConfigureAPI={() => setIsSettingsOpen(true)}
                    getHistory={getHistoryForConnection}
                />
            );
        }

        return (
            <>
                <div className="dashboard-header">
                    {/* Left side: Session viewing indicator */}
                    <div className="header-left">
                        {viewingSnapshotId && (
                            <div className="session-viewing-banner">
                                <button className="back-btn" onClick={handleExitSession} title="Back to live view">
                                    ← Back
                                </button>
                                <span className="session-label">Viewing Session {viewingSnapshotId}</span>
                            </div>
                        )}
                    </div>

                    {/* Right side: Sessions control */}
                    <div className="header-right">
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
                    </div>
                </div>

                <FilterControls
                    filter={filter}
                    onFilterChange={setFilter}
                    // @ts-ignore
                    connectionCount={connectionCount}
                    isExpanded={filtersExpanded}
                    onToggleExpand={() => setFiltersExpanded(!filtersExpanded)}
                    advancedFilters={advancedFilters}
                    onAdvancedFiltersChange={setAdvancedFilters}
                />
                <div className="table-section">
                    <ConnectionTable
                        connections={connections}
                        isLoading={isLoading}
                        selectedConnection={selectedConnection}
                        onSelectConnection={setSelectedConnection}
                    />
                </div>
            </>
        );
    };

    return (
        <div className="app-shell">
            <Sidebar
                activeTab={activeTab}
                onTabChange={setActiveTab}
                onOpenSettings={() => setIsSettingsOpen(true)}
                isAdmin={isAdmin}
            />

            <main className="main-content" style={activeTab === 'ai-agent' ? { padding: 0 } : {}}>
                {renderContent()}
            </main>

            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => {
                    setIsSettingsOpen(false);
                    // If we were on settings tab, go back to dashboard
                    if (activeTab === 'settings') setActiveTab('dashboard');
                }}
                onSaveAPIKey={handleSaveAPIKey}
                refreshRate={updateInterval}
                onRefreshRateChange={handleRefreshRateChange}
            />
        </div>
    );
}

export default App;