import React, { useState } from 'react';
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
    { value: '', label: 'All States' },
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

const ConnectionFilters: React.FC<ConnectionFiltersProps> = ({
    filters,
    onFiltersChange,
    isExpanded,
    onToggleExpand,
}) => {
    const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
        onFiltersChange({ ...filters, [key]: value });
    };

    const clearFilters = () => {
        onFiltersChange({
            hideInternal: false,
            hideLocalhost: false,
            stateFilter: '',
            rtt: '',
            bytesIn: '',
            bytesOut: '',
            bandwidth: '',
            showOnlyRetrans: false,
        });
    };

    const hasActiveFilters =
        filters.hideInternal ||
        filters.hideLocalhost ||
        filters.stateFilter ||
        filters.rtt ||
        filters.bytesIn ||
        filters.bytesOut ||
        filters.bandwidth ||
        filters.showOnlyRetrans;

    return (
        <div className="connection-filters">
            <div className="filters-header">
                <button
                    className={`filter-toggle ${isExpanded ? 'expanded' : ''} ${hasActiveFilters ? 'active' : ''}`}
                    onClick={onToggleExpand}
                >
                    <span className="filter-icon">⚙</span>
                    Filters
                    {hasActiveFilters && <span className="filter-badge">●</span>}
                </button>
                {hasActiveFilters && (
                    <button className="clear-filters" onClick={clearFilters}>
                        Clear
                    </button>
                )}
            </div>

            {isExpanded && (
                <div className="filters-panel">
                    {/* Quick Filters Row */}
                    <div className="filter-row quick-filters">
                        <label className="checkbox-filter">
                            <input
                                type="checkbox"
                                checked={filters.hideInternal}
                                onChange={e => updateFilter('hideInternal', e.target.checked)}
                            />
                            Hide Internal
                        </label>
                        <label className="checkbox-filter">
                            <input
                                type="checkbox"
                                checked={filters.hideLocalhost}
                                onChange={e => updateFilter('hideLocalhost', e.target.checked)}
                            />
                            Hide Localhost
                        </label>
                        <label className="checkbox-filter">
                            <input
                                type="checkbox"
                                checked={filters.showOnlyRetrans}
                                onChange={e => updateFilter('showOnlyRetrans', e.target.checked)}
                            />
                            Retransmissions Only
                        </label>
                    </div>

                    {/* State & Metrics Row */}
                    <div className="filter-row metrics-filters">
                        <div className="filter-group">
                            <label>State</label>
                            <select
                                value={filters.stateFilter}
                                onChange={e => updateFilter('stateFilter', e.target.value)}
                            >
                                {TCP_STATES.map(s => (
                                    <option key={s.value} value={s.value}>{s.label}</option>
                                ))}
                            </select>
                        </div>

                        <div className="filter-group">
                            <label>RTT (ms)</label>
                            <input
                                type="text"
                                placeholder="e.g. > 50"
                                value={filters.rtt}
                                onChange={e => updateFilter('rtt', e.target.value)}
                            />
                        </div>

                        <div className="filter-group">
                            <label>Bytes In</label>
                            <input
                                type="text"
                                placeholder="e.g. > 1000"
                                value={filters.bytesIn}
                                onChange={e => updateFilter('bytesIn', e.target.value)}
                            />
                        </div>

                        <div className="filter-group">
                            <label>Bytes Out</label>
                            <input
                                type="text"
                                placeholder="e.g. > 1000"
                                value={filters.bytesOut}
                                onChange={e => updateFilter('bytesOut', e.target.value)}
                            />
                        </div>

                        <div className="filter-group">
                            <label>Bandwidth (bps)</label>
                            <input
                                type="text"
                                placeholder="e.g. > 1M"
                                value={filters.bandwidth}
                                onChange={e => updateFilter('bandwidth', e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ConnectionFilters;
