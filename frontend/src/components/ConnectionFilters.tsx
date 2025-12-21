import React, { useState, useRef, useEffect } from 'react';
import './ConnectionFilters.css';

export interface FilterState {
    hideInternal: boolean;
    hideLocalhost: boolean;
    stateFilter: string;
    rtt: string;
    bytesIn: string;
    bytesOut: string;
    bandwidth: string;
    showOnlyRetrans: boolean;
}

interface ConnectionFiltersProps {
    filters: FilterState;
    onFiltersChange: (filters: FilterState) => void;
    isExpanded: boolean;
    onToggleExpand: () => void;
}

const TCP_STATES = [
    { value: '5', label: 'Established' },
    { value: '4', label: 'SYN Sent' },
    { value: '3', label: 'SYN Received' },
    { value: '6', label: 'FIN Wait 1' },
    { value: '7', label: 'FIN Wait 2' },
    { value: '8', label: 'Time Wait' },
    { value: '9', label: 'Close Wait' },
    { value: '11', label: 'Closing' },
    { value: '12', label: 'Last ACK' },
    { value: '1', label: 'Closed' },
    { value: '2', label: 'Listen' },
];

const METRIC_FILTERS = [
    { key: 'rtt', label: 'RTT' },
    { key: 'bytesIn', label: 'Bytes In' },
    { key: 'bytesOut', label: 'Bytes Out' },
    { key: 'bandwidth', label: 'Bandwidth' },
];

const ConnectionFilters: React.FC<ConnectionFiltersProps> = ({
    filters,
    onFiltersChange,
}) => {
    const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
    const [editingMetric, setEditingMetric] = useState<{ key: keyof FilterState, label: string } | null>(null);
    const [metricValue, setMetricValue] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
        onFiltersChange({ ...filters, [key]: value });
    };

    const removeFilter = (key: keyof FilterState) => {
        if (typeof filters[key] === 'boolean') {
            onFiltersChange({ ...filters, [key]: false });
        } else {
            onFiltersChange({ ...filters, [key]: '' });
        }
    };

    const handleMetricSubmit = () => {
        if (editingMetric && metricValue) {
            updateFilter(editingMetric.key, metricValue);
            setEditingMetric(null);
            setMetricValue('');
            setIsAddMenuOpen(false);
        }
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsAddMenuOpen(false);
                setEditingMetric(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="connection-filters-container">
            {/* Active Filter Tags */}
            <div className="active-filters-list">
                {filters.hideInternal && (
                    <div className="filter-tag">
                        <span>Hide Internal</span>
                        <button onClick={() => removeFilter('hideInternal')}>×</button>
                    </div>
                )}
                {filters.hideLocalhost && (
                    <div className="filter-tag">
                        <span>Hide Localhost</span>
                        <button onClick={() => removeFilter('hideLocalhost')}>×</button>
                    </div>
                )}
                {filters.showOnlyRetrans && (
                    <div className="filter-tag">
                        <span>Retrans Only</span>
                        <button onClick={() => removeFilter('showOnlyRetrans')}>×</button>
                    </div>
                )}
                {filters.stateFilter && (
                    <div className="filter-tag">
                        <span>State: {TCP_STATES.find(s => s.value === filters.stateFilter)?.label || filters.stateFilter}</span>
                        <button onClick={() => removeFilter('stateFilter')}>×</button>
                    </div>
                )}
                {filters.rtt && (
                    <div className="filter-tag">
                        <span>RTT: {filters.rtt}</span>
                        <button onClick={() => removeFilter('rtt')}>×</button>
                    </div>
                )}
                {filters.bytesIn && (
                    <div className="filter-tag">
                        <span>In: {filters.bytesIn}</span>
                        <button onClick={() => removeFilter('bytesIn')}>×</button>
                    </div>
                )}
                {filters.bytesOut && (
                    <div className="filter-tag">
                        <span>Out: {filters.bytesOut}</span>
                        <button onClick={() => removeFilter('bytesOut')}>×</button>
                    </div>
                )}
                {filters.bandwidth && (
                    <div className="filter-tag">
                        <span>BW: {filters.bandwidth}</span>
                        <button onClick={() => removeFilter('bandwidth')}>×</button>
                    </div>
                )}

                {/* Add Filter Button & Dropdown */}
                <div className="add-filter-wrapper" ref={dropdownRef}>
                    <button
                        className={`btn-add-filter ${isAddMenuOpen ? 'active' : ''}`}
                        onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
                    >
                        + Add Filter
                    </button>

                    {isAddMenuOpen && !editingMetric && (
                        <div className="filter-dropdown-menu">
                            <div className="menu-section">
                                <span className="menu-header">Toggles</span>
                                <button className="menu-item" onClick={() => updateFilter('hideInternal', !filters.hideInternal)}>
                                    {filters.hideInternal ? '✓ ' : ''}Hide Internal
                                </button>
                                <button className="menu-item" onClick={() => updateFilter('hideLocalhost', !filters.hideLocalhost)}>
                                    {filters.hideLocalhost ? '✓ ' : ''}Hide Localhost
                                </button>
                                <button className="menu-item" onClick={() => updateFilter('showOnlyRetrans', !filters.showOnlyRetrans)}>
                                    {filters.showOnlyRetrans ? '✓ ' : ''}Retransmissions Only
                                </button>
                            </div>

                            <div className="menu-section">
                                <span className="menu-header">State</span>
                                {TCP_STATES.map(state => (
                                    <button
                                        key={state.value}
                                        className="menu-item"
                                        onClick={() => {
                                            updateFilter('stateFilter', state.value);
                                            setIsAddMenuOpen(false);
                                        }}
                                    >
                                        {filters.stateFilter === state.value ? '✓ ' : ''}{state.label}
                                    </button>
                                ))}
                            </div>

                            <div className="menu-section">
                                <span className="menu-header">Metrics</span>
                                {METRIC_FILTERS.map(m => (
                                    <button
                                        key={m.key}
                                        className="menu-item"
                                        onClick={() => {
                                            setEditingMetric({ key: m.key as keyof FilterState, label: m.label });
                                            setMetricValue('');
                                        }}
                                    >
                                        {m.label}...
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Metric Input Popover */}
                    {isAddMenuOpen && editingMetric && (
                        <div className="metric-input-popover">
                            <div className="popover-header">
                                <span>Filter by {editingMetric.label}</span>
                                <button className="btn-close-popover" onClick={() => setEditingMetric(null)}>×</button>
                            </div>
                            <input
                                autoFocus
                                type="text"
                                placeholder={editingMetric.key === 'rtt' ? 'e.g. > 50 (ms)' : 'e.g. > 1M, < 500K'}
                                value={metricValue}
                                onChange={e => setMetricValue(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleMetricSubmit()}
                            />
                            <div className="popover-actions">
                                <button className="btn-cancel" onClick={() => setEditingMetric(null)}>Back</button>
                                <button className="btn-apply" onClick={handleMetricSubmit}>Apply</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ConnectionFilters;
