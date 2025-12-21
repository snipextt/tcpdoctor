import React from 'react';
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

const ConnectionFilters: React.FC<ConnectionFiltersProps> = ({
    filters,
    onFiltersChange,
}) => {
    const removeFilter = (key: keyof FilterState) => {
        if (typeof filters[key] === 'boolean') {
            onFiltersChange({ ...filters, [key]: false });
        } else {
            onFiltersChange({ ...filters, [key]: '' });
        }
    };

    // Check if any filter is active
    const hasActiveFilters = filters.hideInternal || filters.hideLocalhost || filters.showOnlyRetrans ||
        filters.stateFilter || filters.rtt || filters.bytesIn || filters.bytesOut || filters.bandwidth;

    if (!hasActiveFilters) {
        return null; // Don't render anything if no filters active
    }

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
            </div>
        </div>
    );
};

export default ConnectionFilters;
