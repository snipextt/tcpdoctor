import { useState, useEffect, useCallback } from 'react';
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
    GetSnapshotCount,
    GetSnapshotMeta,
    GetSnapshot,
    CompareSnapshots,
    ClearSnapshots,
    TakeSnapshot,
    GetConnectionHistory
} from "../wailsjs/go/main/App";
import { tcpmonitor } from "../wailsjs/go/models";
import ConnectionTable from './components/ConnectionTable';
import FilterControls from './components/FilterControls';
import StatsPanel from './components/StatsPanel';
import SettingsModal from './components/SettingsModal';
import HealthReportModal from './components/HealthReportModal';
import SnapshotControls from './components/SnapshotControls';
import SnapshotTimeline from './components/SnapshotTimeline';
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
                GetSnapshotCount().then(setSnapshotCount);
            }
        }, updateInterval);
        return () => clearInterval(intervalId);
    }, [refreshConnections, updateInterval, isRecording, viewingSnapshotId]);

    const handleFilterChange = (newFilter: tcpmonitor.FilterOptions) => {
        setFilter(newFilter);
    };

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
        const count = await GetSnapshotCount();
        setSnapshotCount(count);
    };

    const handleClearSnapshots = async () => {
        await ClearSnapshots();
        setSnapshotCount(0);
        setViewingSnapshotId(null); // Go back to live if viewing was active
    };

    // Load a snapshot's connections into the view
    const handleLoadSnapshot = (snapshot: any) => {
        // Convert compact connections to display format
        // Add all fields that StatsPanel might access with defaults
        const convertedConnections = snapshot.connections.map((c: any) => ({
            LocalAddr: c.localAddr,
            LocalPort: c.localPort,
            RemoteAddr: c.remoteAddr,
            RemotePort: c.remotePort,
            State: c.state,
            PID: c.pid,
            BasicStats: {
                DataBytesIn: c.bytesIn || 0,
                DataBytesOut: c.bytesOut || 0,
                DataSegsIn: c.segmentsIn || 0,
                DataSegsOut: c.segmentsOut || 0,
            },
            ExtendedStats: {
                SmoothedRTT: c.rtt || 0,
                RTTVariance: c.rttVariance || 0,
                MinRTT: c.minRtt || 0,
                MaxRTT: c.maxRtt || 0,
                BytesRetrans: c.retrans || 0,
                SegsRetrans: c.segsRetrans || 0,
                FastRetrans: 0, // Not captured in snapshot
                TimeoutEpisodes: 0, // Not captured in snapshot
                CurrentCwnd: c.congestionWin || 0,
                InboundBandwidth: c.inBandwidth || 0,
                OutboundBandwidth: c.outBandwidth || 0,
                // Add other fields StatsPanel might use
                MaxCwnd: 0,
                MaxSsthresh: 0,
            },
        }));
        setConnections(convertedConnections);
        setViewingSnapshotId(snapshot.id);
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
                            <span className="snapshot-badge">📷 Viewing Snapshot #{viewingSnapshotId}</span>
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

            <main className="app-content">
                <div className="left-panel">
                    <FilterControls
                        filter={filter}
                        onFilterChange={handleFilterChange}
                    />
                    <ConnectionTable
                        connections={connections}
                        selectedConnection={selectedConnection}
                        onSelectConnection={setSelectedConnection}
                        isLoading={isLoading}
                    />
                </div>

                <div className="right-panel">
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

            {/* Snapshot Timeline Modal */}
            <SnapshotTimeline
                isOpen={isTimelineOpen}
                onClose={() => setIsTimelineOpen(false)}
                getMeta={GetSnapshotMeta}
                getSnapshot={GetSnapshot}
                compareSnapshots={CompareSnapshots}
                onLoadSnapshot={handleLoadSnapshot}
                onClear={handleClearSnapshots}
            />

            {/* Connection History Modal */}
            {selectedConnection && (
                <ConnectionHistory
                    isOpen={isHistoryOpen}
                    onClose={() => setIsHistoryOpen(false)}
                    connectionKey={`${selectedConnection.LocalAddr}:${selectedConnection.LocalPort} → ${selectedConnection.RemoteAddr}:${selectedConnection.RemotePort}`}
                    getHistory={() => GetConnectionHistory(
                        selectedConnection.LocalAddr,
                        selectedConnection.LocalPort,
                        selectedConnection.RemoteAddr,
                        selectedConnection.RemotePort
                    )}
                />
            )}
        </div>
    );
}

export default App;
