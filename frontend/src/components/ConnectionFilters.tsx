import React, { useState } from 'react';
import './ConnectionFilters.css';

export interface FilterState {
    hideInternal: boolean;
    hideLocalhost: boolean;
    stateFilter: string;
    minRtt: string;
    maxRtt: string;
    minBytesIn: string;
    minBytesOut: string;
    minBandwidth: string;
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
            minRtt: '',
            maxRtt: '',
            minBytesIn: '',
            minBytesOut: '',
            minBandwidth: '',
            showOnlyRetrans: false,
        });
    };

    const hasActiveFilters =
        filters.hideInternal ||
        filters.hideLocalhost ||
        filters.stateFilter ||
        filters.minRtt ||
        filters.maxRtt ||
        filters.minBytesIn ||
        filters.minBytesOut ||
        filters.minBandwidth ||
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
                            Hide Internal (10.x, 192.168.x, 172.16-31.x)
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
                            <label>Min RTT (ms)</label>
                            <input
                                type="number"
                                placeholder="e.g. 50"
                                value={filters.minRtt}
                                onChange={e => updateFilter('minRtt', e.target.value)}
                            />
                        </div>

                        <div className="filter-group">
                            <label>Max RTT (ms)</label>
                            <input
                                type="number"
                                placeholder="e.g. 200"
                                value={filters.maxRtt}
                                onChange={e => updateFilter('maxRtt', e.target.value)}
                            />
                        </div>

                        <div className="filter-group">
                            <label>Min Bytes In</label>
                            <input
                                type="number"
                                placeholder="e.g. 1000"
                                value={filters.minBytesIn}
                                onChange={e => updateFilter('minBytesIn', e.target.value)}
                            />
                        </div>

                        <div className="filter-group">
                            <label>Min Bytes Out</label>
                            <input
                                type="number"
                                placeholder="e.g. 1000"
                                value={filters.minBytesOut}
                                onChange={e => updateFilter('minBytesOut', e.target.value)}
                            />
                        </div>

                        <div className="filter-group">
                            <label>Min Bandwidth (bps)</label>
                            <input
                                type="number"
                                placeholder="e.g. 1000000"
                                value={filters.minBandwidth}
                                onChange={e => updateFilter('minBandwidth', e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ConnectionFilters;
