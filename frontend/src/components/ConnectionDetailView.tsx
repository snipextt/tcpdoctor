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
    const [visibleSections, setVisibleSections] = useState<Set<string>>(() => {
        const saved = localStorage.getItem('stats_visible_sections');
        if (saved) {
            try {
                return new Set(JSON.parse(saved));
            } catch (e) { }
        }
        return new Set(['charts', 'data', 'retrans', 'rtt', 'congestion', 'bandwidth', 'window', 'segments', 'dups']);
    });

    // View menu state
    const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
    const viewMenuRef = React.useRef<HTMLDivElement>(null);
    const [activeTab, setActiveTab] = useState<'live' | 'history'>('live');

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (viewMenuRef.current && !viewMenuRef.current.contains(event.target as Node)) {
                setIsViewMenuOpen(false);
            }
        };
        if (isViewMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isViewMenuOpen]);

    const toggleSection = (id: string) => {
        const newSet = new Set(visibleSections);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setVisibleSections(newSet);
        localStorage.setItem('stats_visible_sections', JSON.stringify(Array.from(newSet)));
    };

    const ALL_SECTIONS = [
        { id: 'charts', label: 'Live Performance Charts' },
        { id: 'data', label: 'Data Transfer' },
        { id: 'retrans', label: 'Retransmissions' },
        { id: 'rtt', label: 'Round Trip Time (RTT)' },
        { id: 'congestion', label: 'Congestion Control' },
        { id: 'bandwidth', label: 'Bandwidth & Throughput' },
        { id: 'window', label: 'Window & Scaling' },
        { id: 'segments', label: 'Segment Info & MSS' },
        { id: 'dups', label: 'Duplicate ACKs & SACKs' },
    ];

    return (
        <div className="connection-detail-view">
            {/* Header */}
            <div className="detail-header">
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button className="btn-back" onClick={onBack} title="Return to Table">
                        ↩
                    </button>

                    {/* View Options */}
                    <div className="view-menu-container" ref={viewMenuRef} style={{ position: 'relative' }}>
                        <button
                            className="btn-view-options"
                            onClick={() => setIsViewMenuOpen(!isViewMenuOpen)}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                                <circle cx="12" cy="12" r="3" />
                            </svg>
                            View Options
                        </button>

                        {isViewMenuOpen && (
                            <div className="view-dropdown animate-fade" style={{ top: '120%', left: 0, right: 'auto' }}>
                                <div className="dropdown-header">Visible Sections</div>
                                {ALL_SECTIONS.map(section => (
                                    <label key={section.id} className="view-option">
                                        <input
                                            type="checkbox"
                                            checked={visibleSections.has(section.id)}
                                            onChange={() => toggleSection(section.id)}
                                        />
                                        {section.label}
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

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
                            onViewHistory={undefined}
                            hasHistory={false}
                            visibleSections={visibleSections}
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
