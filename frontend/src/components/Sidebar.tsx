import React from 'react';
import './Sidebar.css';

interface SidebarProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
    isAdmin: boolean;
    isAIDocked: boolean;
    onToggleAIDock: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, isAdmin, isAIDocked, onToggleAIDock }) => {
    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <div className="sidebar-logo">
                    <div className="logo-icon">🩺</div>
                    <div className="logo-text">
                        <span className="logo-title">TCP DOCTOR</span>
                        <span className="logo-subtitle">Real-time Diagnostics</span>
                    </div>
                </div>
            </div>

            <nav className="sidebar-nav">
                <button
                    className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
                    onClick={() => onTabChange('dashboard')}
                >
                    <span className="nav-icon">📊</span>
                    <span className="nav-label">Dashboard</span>
                </button>
                <button
                    className={`nav-item ${activeTab === 'recordings' ? 'active' : ''}`}
                    onClick={() => onTabChange('recordings')}
                >
                    <span className="nav-icon">🎬</span>
                    <span className="nav-label">Recordings</span>
                </button>
                <button
                    className={`nav-item ${activeTab === 'ai-assistant' ? 'active' : ''}`}
                    onClick={() => onTabChange('ai-assistant')}
                >
                    <span className="nav-icon">✨</span>
                    <span className="nav-label">AI Assistant</span>
                </button>
            </nav>

            <div className="sidebar-footer">
                {!isAdmin && (
                    <div className="sidebar-alert">
                        <span className="alert-icon">⚠️</span>
                        <div className="alert-content">
                            <span className="alert-title">Limited Privileges</span>
                            <span className="alert-desc">Run as Admin for deep stats</span>
                        </div>
                    </div>
                )}

                <button
                    className={`nav-item ai-toggle-item ${isAIDocked ? 'docked' : ''}`}
                    onClick={onToggleAIDock}
                    title={isAIDocked ? "Undock AI Assistant" : "Dock AI Assistant"}
                >
                    <span className="nav-icon">{isAIDocked ? '🔓' : '📌'}</span>
                    <span className="nav-label">{isAIDocked ? "Undock AI" : "Dock AI"}</span>
                </button>

                <button
                    className={`nav-item settings-item ${activeTab === 'settings' ? 'active' : ''}`}
                    onClick={() => onTabChange('settings')}
                >
                    <span className="nav-icon">⚙️</span>
                    <span className="nav-label">Settings</span>
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
