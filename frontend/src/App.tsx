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
// import AIAssistant from './components/AIAssistant'; // Disabled
// import SettingsModal from './components/SettingsModal'; // Not used in this view?
// import HealthReportModal from './components/HealthReportModal'; // Disabled
import SnapshotControls from './components/SnapshotControls';
import Sidebar from './components/Sidebar';
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
    // const [isAIDocked, setIsAIDocked] = useState(false);
    const [statsVisible, setStatsVisible] = useState(true); // Control visibility of bottom panel
    const [isLoading, setIsLoading] = useState(true);

    // AI State (Disabled)
    // const [isHealthReportOpen, setIsHealthReportOpen] = useState(false);
    // const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    // const [isAIConfigured, setIsAIConfigured] = useState(false);

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
    useEffect(() => {
        const checkAIConfig = async () => {
            try {
                // AI Check Disabled
                // const configured = await IsLLMConfigured();
                // setIsAIConfigured(configured);
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

                // Sync recording state
                const recording = await IsRecording();
                setIsRecording(recording);
                if (recording) {
                    const count = await GetSessionCount();
                    setSnapshotCount(count);
                }
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

            // Update selected connection if it still exists
            setSelectedConnection(prevSelected => {
                if (!prevSelected) return null;
                const found = conns.find(c =>
                    c.LocalAddr === prevSelected.LocalAddr &&
                    c.LocalPort === prevSelected.LocalPort &&
                    c.RemoteAddr === prevSelected.RemoteAddr &&
                    c.RemotePort === prevSelected.RemotePort
                );
                return found || null;
            });
        } catch (error) {
            console.error("Failed to refresh connections:", error);
        } finally {
            setIsLoading(false);
        }
    }, [filter]);

    // Polling effect
    useEffect(() => {
        if (viewingSnapshotId !== null) return; // Viewing history, don't poll

        refreshConnections();
        const intervalId = setInterval(() => {
            refreshConnections();
            if (isRecording) {
                TakeSnapshot(filter);
                GetSessionCount().then(setSnapshotCount);
            }
        }, updateInterval);
        return () => clearInterval(intervalId);
    }, [refreshConnections, updateInterval, isRecording, viewingSnapshotId]);

    const handleFilterChange = (newFilter: tcpmonitor.FilterOptions) => {
        setFilter(newFilter);
    };

    // Client-side filtering
    const filteredConnections = useMemo(() => {
        let result = connections;

        // Apply basic filter first (backend already does this in live mode for text search)
        if (viewingSnapshotId !== null) {
            result = result.filter(conn => {
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
                if (filter.IPv4Only && conn.LocalAddr?.includes(':')) return false;
                if (filter.IPv6Only && !conn.LocalAddr?.includes(':')) return false;
                if (filter.State && filter.State > 0 && conn.State !== filter.State) return false;
                return true;
            });
        }

        // Apply advanced filters
        return result.filter(conn => {
            if (advancedFilters.hideLocalhost) {
                if (conn.LocalAddr === '127.0.0.1' || conn.RemoteAddr === '127.0.0.1' ||
                    conn.LocalAddr === '::1' || conn.RemoteAddr === '::1') return false;
            }
            if (advancedFilters.hideInternal) {
                const isPrivate = (ip: string) => {
                    if (!ip) return false;
                    return ip.startsWith('10.') || ip.startsWith('192.168.') || ip.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./) || ip.startsWith('127.') || ip === '::1';
                };
                if (isPrivate(conn.RemoteAddr)) return false;
            }
            if (advancedFilters.stateFilter && conn.State !== parseInt(advancedFilters.stateFilter)) return false;

            // Simplified metric checks...
            if (advancedFilters.showOnlyRetrans) {
                if ((conn.ExtendedStats?.BytesRetrans || 0) === 0 && (conn.ExtendedStats?.SegsRetrans || 0) === 0) return false;
            }
            return true;
        });
    }, [connections, filter, viewingSnapshotId, advancedFilters]);

    // AI Handlers
    const handleSaveAPIKey = async (apiKey: string) => {
        // AI Disabled
        // await ConfigureLLM(apiKey);
        // setIsAIConfigured(true);
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
        setViewingSnapshotId(null);
    };

    const handleLoadSession = (sessionId: number, timeline: any[]) => {
        const uniqueConnections = new Map<string, any>();
        timeline.forEach(item => {
            const key = `${item.connection.localAddr}:${item.connection.localPort}-${item.connection.remoteAddr}:${item.connection.remotePort}`;
            uniqueConnections.set(key, item);
        });

        const convertedConnections = Array.from(uniqueConnections.values()).map((item) => ({
            Timestamp: item.timestamp,
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
                SampleRTT: item.connection.sampleRTT || 0,
                SmoothedRTT: item.connection.rtt || 0,
                RTTVariance: item.connection.rttVariance || 0,
                MinRTT: item.connection.minRtt || 0,
                MaxRTT: item.connection.maxRtt || 0,
                BytesRetrans: item.connection.retrans || 0,
                SegsRetrans: item.connection.segsRetrans || 0,
                TotalSegsOut: item.connection.totalSegsOut || 0,
                TotalSegsIn: item.connection.totalSegsIn || 0,
                FastRetrans: item.connection.fastRetrans || 0,
                TimeoutEpisodes: item.connection.timeoutEpisodes || 0,
                CurrentCwnd: item.connection.congestionWin || 0,
                InboundBandwidth: item.connection.inBandwidth || 0,
                OutboundBandwidth: item.connection.outBandwidth || 0,
                ThruBytesAcked: item.connection.thruBytesAcked || 0,
                ThruBytesReceived: item.connection.thruBytesReceived || 0,
                CurrentSsthresh: item.connection.currentSsthresh || 0,
                SlowStartCount: item.connection.slowStartCount || 0,
                CongAvoidCount: item.connection.congAvoidCount || 0,
                CurRetxQueue: item.connection.curRetxQueue || 0,
                MaxRetxQueue: item.connection.maxRetxQueue || 0,
                CurAppWQueue: item.connection.curAppWQueue || 0,
                MaxAppWQueue: item.connection.maxAppWQueue || 0,
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
        setSessionTimeline(timeline);
        viewingSnapshotRef.current = sessionId;
        setViewingSnapshotId(sessionId);
        setSelectedConnection(null);
    };

    const handleBackToLive = () => {
        viewingSnapshotRef.current = null;
        setViewingSnapshotId(null);
        setSessionTimeline([]);
    };

    // NAV LOGIC: If connection selected, show detail. Otherwise table.
    if (selectedConnection) {
        return (
            <ConnectionDetailView
                connection={selectedConnection}
                onBack={() => setSelectedConnection(null)}
                isAdmin={isAdmin}
                isAIConfigured={false}
                onDiagnose={async () => null} // AI Disabled
                onConfigureAPI={() => { }} // AI Disabled
                getHistory={async () => {
                    if (viewingSnapshotId !== null) {
                        return GetConnectionHistoryForSession(
                            viewingSnapshotId,
                            selectedConnection.LocalAddr,
                            selectedConnection.LocalPort,
                            selectedConnection.RemoteAddr,
                            selectedConnection.RemotePort
                        );
                    }
                    return GetConnectionHistory(
                        selectedConnection.LocalAddr,
                        selectedConnection.LocalPort,
                        selectedConnection.RemoteAddr,
                        selectedConnection.RemotePort
                    );
                }}
            />
        );
    }

    return (
        <div className="app-shell">
            <Sidebar
                activeTab={activeTab}
                onTabChange={setActiveTab}
                isAdmin={isAdmin}
            />

            <main className="main-content">
                {activeTab === 'dashboard' && (
                    <div className="dashboard-view animate-fade">
                        <header className="view-header">
                            <div className="view-title">
                                <h2>Network Dashboard</h2>
                                <p>Monitoring {connectionCount} active connections</p>
                            </div>
                            <div className="view-actions">
                                <SnapshotControls
                                    isRecording={isRecording}
                                    sessionCount={snapshotCount}
                                    onStartRecording={handleStartRecording}
                                    onStopRecording={handleStopRecording}
                                    getSessions={GetSessions}
                                    getSessionTimeline={GetSessionTimeline}
                                    onLoadSession={handleLoadSession}
                                    onClear={handleClearSnapshots}
                                    onExportSession={() => { }} // Todo
                                    onImportSession={() => { }} // Todo
                                />
                                {viewingSnapshotId !== null ? (
                                    <button className="btn-back-live" onClick={handleBackToLive}>
                                        ← Return to Live
                                    </button>
                                ) : null}
                            </div>
                        </header>

                        <div className="dashboard-grid">
                            <div className="filters-section panel shadow-sm">
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
                            </div>

                            <div className="table-section">
                                <ConnectionTable
                                    connections={filteredConnections}
                                    selectedConnection={selectedConnection}
                                    onSelectConnection={setSelectedConnection}
                                    isLoading={isLoading}
                                    viewingSnapshot={viewingSnapshotId !== null}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'recordings' && (
                    <div className="recordings-view animate-fade">
                        <header className="view-header">
                            <div className="view-title">
                                <h2>Traffic Recordings</h2>
                                <p>Analyze historical network activity</p>
                            </div>
                        </header>
                        <div className="recordings-content panel shadow-sm">
                            <SnapshotControls
                                isRecording={isRecording}
                                sessionCount={snapshotCount}
                                onStartRecording={handleStartRecording}
                                onStopRecording={handleStopRecording}
                                getSessions={GetSessions}
                                getSessionTimeline={GetSessionTimeline}
                                onLoadSession={(id, timeline) => {
                                    handleLoadSession(id, timeline);
                                    setActiveTab('dashboard');
                                }}
                                onClear={handleClearSnapshots}
                                onExportSession={() => { }}
                                onImportSession={() => { }}
                            />
                        </div>
                    </div>
                )}

                {
                    activeTab === 'settings' && (
                        <div className="settings-view animate-fade">
                            <header className="view-header">
                                <div className="view-title">
                                    <h2>Application Settings</h2>
                                    <p>Configure preferences and API integrations</p>
                                </div>
                            </header>
                            <div className="settings-content-inner panel shadow-sm">
                                <div className="settings-card">
                                    {/* AI Config Disabled */}
                                    {/* 
                                <h3>AI Configuration</h3>
                                <p className="text-dim">Enter your Google Gemini API key to enable AI-powered network diagnostics.</p>
                                <div className="setting-item">
                                    <label>Gemini API Key</label>
                                    <input
                                        type="password"
                                        className="filter-input"
                                        placeholder="Enter key..."
                                        onBlur={(e) => handleSaveAPIKey(e.target.value)}
                                        defaultValue={localStorage.getItem('gemini_api_key') || ''}
                                    />
                                </div>
                                */}

                                    <h3 style={{ marginTop: '0' }}>Polling Interval</h3>
                                    <p className="text-dim">Control how frequently the dashboard updates connection metrics.</p>
                                    <div className="setting-item">
                                        <label>Update Every (ms)</label>
                                        <input
                                            type="number"
                                            className="filter-input"
                                            value={updateInterval}
                                            onChange={(e) => setUpdateInterval(parseInt(e.target.value))}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }
            </main >

        </div >
    );
}

export default App;