import { useState, useEffect, useCallback } from 'react';
import {
    GetConnections,
    GetConnectionCount,
    IsAdministrator,
    GetUpdateInterval,
    ExportToCSV
} from "../wailsjs/go/main/App";
import { tcpmonitor } from "../wailsjs/go/models";
import ConnectionTable from './components/ConnectionTable';
import FilterControls from './components/FilterControls';
import StatsPanel from './components/StatsPanel';
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
    }, [filter]); // Removed selectedConnection from deps

    const handleExport = async () => {
        try {
            // Call ExportToCSV with empty string to trigger backend dialoag
            await ExportToCSV("");
            console.log("Export initiated");
        } catch (e) {
            console.error("Export failed:", e);
        }
    };

    // Polling effect
    useEffect(() => {
        // Immediate refresh on mount or filter change
        refreshConnections();

        const intervalId = setInterval(refreshConnections, updateInterval);
        return () => clearInterval(intervalId);
    }, [refreshConnections, updateInterval]);

    const handleFilterChange = (newFilter: tcpmonitor.FilterOptions) => {
        setFilter(newFilter);
        // Effect will trigger refresh
    };

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
        </div>
    );
}

export default App;
