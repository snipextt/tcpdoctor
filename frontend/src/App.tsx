import { useState, useEffect, useCallback } from 'react';
import {
    GetConnections,
    GetConnectionCount,
    IsAdministrator,
    GetUpdateInterval,
    ExportToCSV,
    ConfigureLLM,
    IsLLMConfigured,
    DiagnoseConnection,
    QueryConnections,
    GenerateHealthReport
} from "../wailsjs/go/main/App";
import { tcpmonitor } from "../wailsjs/go/models";
import ConnectionTable from './components/ConnectionTable';
import FilterControls from './components/FilterControls';
import StatsPanel from './components/StatsPanel';
import AIAssistant from './components/AIAssistant';
import SettingsModal from './components/SettingsModal';
import './App.css';

function App() {
    const [connectionCount, setConnectionCount] = useState(0);
    const [isAdmin, setIsAdmin] = useState(false);
    const [updateInterval, setUpdateInterval] = useState(1000);
    const [connections, setConnections] = useState<tcpmonitor.ConnectionInfo[]>([]);
    const [selectedConnection, setSelectedConnection] = useState<tcpmonitor.ConnectionInfo | null>(null);
    const [filter, setFilter] = useState<tcpmonitor.FilterOptions>(new tcpmonitor.FilterOptions({
        IPv4Only: false,
        IPv6Only: false,
        SearchText: ""
    }));
    const [isLoading, setIsLoading] = useState(true);

    // AI State
    const [isAIOpen, setIsAIOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isAIConfigured, setIsAIConfigured] = useState(false);

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

    // Polling effect
    useEffect(() => {
        refreshConnections();
        const intervalId = setInterval(refreshConnections, updateInterval);
        return () => clearInterval(intervalId);
    }, [refreshConnections, updateInterval]);

    const handleFilterChange = (newFilter: tcpmonitor.FilterOptions) => {
        setFilter(newFilter);
    };

    // AI Handlers
    const handleSaveAPIKey = async (apiKey: string) => {
        await ConfigureLLM(apiKey);
        setIsAIConfigured(true);
    };

    const handleQueryConnections = async (query: string) => {
        const result = await QueryConnections(query);
        return {
            answer: result?.Answer || "No response",
            success: result?.Success || false
        };
    };

    const handleGenerateReport = async () => {
        const result = await GenerateHealthReport();
        return {
            summary: result?.Summary || "",
            highlights: result?.Highlights || [],
            concerns: result?.Concerns || [],
            suggestions: result?.Suggestions || [],
            score: result?.Score || 0
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
            summary: result?.Summary || "",
            issues: result?.Issues || [],
            possibleCauses: result?.PossibleCauses || [],
            recommendations: result?.Recommendations || [],
            severity: result?.Severity || "warning"
        };
    };

    const selectedConnectionInfo = selectedConnection
        ? `${selectedConnection.LocalAddr}:${selectedConnection.LocalPort}${selectedConnection.RemoteAddr}:${selectedConnection.RemotePort}`
        : undefined;

    return (
        <div className="app-container">
            <header className="app-header">
                <div className="logo">
                    <h1>TCP Doctor</h1>
                </div>
                <div className="header-actions">
                    <button className="btn-export" onClick={handleExport}>
                        Export CSV
                    </button>
                    <button
                        className={`btn-ai ${isAIConfigured ? 'configured' : ''}`}
                        onClick={() => setIsAIOpen(true)}
                        title={isAIConfigured ? "Open AI Assistant" : "Configure AI to enable"}
                    >
                        🤖 AI Assistant
                    </button>
                    <div className="header-stats">
                        <div className="stat-badge">
                            <span className="label">Connections</span>
                            <span className="value">{connectionCount}</span>
                        </div>
                        <div className="stat-badge">
                            <span className="label">Update Rate</span>
                            <span className="value">{updateInterval}ms</span>
                        </div>
                        <div className={`stat-badge ${isAdmin ? 'admin' : 'user'}`}>
                            <span className="label">Mode</span>
                            <span className="value">{isAdmin ? 'Administrator' : 'User'}</span>
                        </div>
                    </div>
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
                    />
                </div>
            </main>

            {/* AI Assistant Panel */}
            <AIAssistant
                isOpen={isAIOpen}
                onClose={() => setIsAIOpen(false)}
                onConfigureAPI={() => {
                    setIsAIOpen(false);
                    setIsSettingsOpen(true);
                }}
                isConfigured={isAIConfigured}
                queryConnections={handleQueryConnections}
                generateHealthReport={handleGenerateReport}
                onDiagnose={selectedConnection ? handleDiagnose : undefined}
                selectedConnectionInfo={selectedConnectionInfo}
            />

            {/* Settings Modal */}
            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                onSaveAPIKey={handleSaveAPIKey}
            />
        </div>
    );
}

export default App;

