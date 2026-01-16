import React, { useState } from 'react';
import StatsPanel from './StatsPanel';
import ConnectionHistory from './ConnectionHistory';
import { tcpmonitor } from '../../wailsjs/go/models';
import './ConnectionDetailView.css';

interface ConnectionDetailViewProps {
    connection: tcpmonitor.ConnectionInfo;
    onBack: () => void;
    isAdmin: boolean;
    isAIConfigured: boolean;
    onDiagnose: () => Promise<any>;
    onConfigureAPI: () => void;
    // History props
    getHistory: () => Promise<any[]>;
}

const ConnectionDetailView: React.FC<ConnectionDetailViewProps> = ({
    connection,
    onBack,
    isAdmin,
    isAIConfigured,
    onDiagnose,
    onConfigureAPI,
    getHistory
}) => {
    const [activeTab, setActiveTab] = useState<'live' | 'history'>('live');

    return (
        <div className="connection-detail-view">
            {/* Header */}
            <div className="detail-header">
                <button className="btn-back" onClick={onBack} title="Return to Table">
                    ↩
                </button>
                <div className="connection-title">
                    <span className="addr">{connection.LocalAddr}:{connection.LocalPort}</span>
                    <span className="arrow">→</span>
                    <span className="addr">{connection.RemoteAddr}:{connection.RemotePort}</span>
                </div>
                <div className="header-tabs">
                    <button
                        className={`tab-btn ${activeTab === 'live' ? 'active' : ''}`}
                        onClick={() => setActiveTab('live')}
                    >
                        Live Stats
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                        onClick={() => setActiveTab('history')}
                    >
                        History Graphs
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="detail-content">
                {activeTab === 'live' ? (
                    <div className="live-view-container">
                        <StatsPanel
                            connection={connection}
                            isAdmin={isAdmin}
                            onDiagnose={onDiagnose}
                            isAIConfigured={isAIConfigured}
                            onConfigureAPI={onConfigureAPI}
                            // Hide history button since we have tabs now
                            onViewHistory={undefined}
                            hasHistory={false}
                        />
                    </div>
                ) : (
                    <div className="history-view-container">
                        {/* Reuse ConnectionHistory but embedded instead of modal */}
                        <ConnectionHistory
                            isOpen={true}
                            onClose={() => { }} // No-op, use tabs/back button
                            connectionKey={`${connection.LocalAddr}:${connection.LocalPort} → ${connection.RemoteAddr}:${connection.RemotePort}`}
                            getHistory={getHistory}
                            viewingHistorical={true}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default ConnectionDetailView;
