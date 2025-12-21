import React, { useState, useEffect, useRef } from 'react';
import { FilterControlsProps, TCPState, TCPStateNames } from '../types';
import { tcpmonitor } from '../../wailsjs/go/models';
import { FilterState } from './ConnectionFilters';
import './ConnectionFilters.css';

interface ExtendedFilterControlsProps extends FilterControlsProps {
  advancedFilters: FilterState;
  onAdvancedFiltersChange: (filters: FilterState) => void;
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

const FilterControls: React.FC<ExtendedFilterControlsProps> = ({
  filter,
  onFilterChange,
  advancedFilters,
  onAdvancedFiltersChange,
}) => {
  // Local state for inputs to allow debouncing
  const [pidInput, setPidInput] = useState<string>(filter.PID ? filter.PID.toString() : '');
  const [portInput, setPortInput] = useState<string>(filter.Port ? filter.Port.toString() : '');
  const [searchInput, setSearchInput] = useState<string>(filter.SearchText || '');

  // Add Filter dropdown state
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [editingMetric, setEditingMetric] = useState<{ key: keyof FilterState, label: string } | null>(null);
  const [metricValue, setMetricValue] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounce logic for text/number inputs
  useEffect(() => {
    const timer = setTimeout(() => {
      const newPid = pidInput ? parseInt(pidInput, 10) : undefined;
      const newPort = portInput ? parseInt(portInput, 10) : undefined;

      // Only update if values actually changed
      if (
        newPid !== filter.PID ||
        newPort !== filter.Port ||
        searchInput !== filter.SearchText
      ) {
        onFilterChange(new tcpmonitor.FilterOptions({
          ...filter,
          PID: newPid,
          Port: newPort,
          SearchText: searchInput,
        }));
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [pidInput, portInput, searchInput, filter, onFilterChange]);

  // Close dropdown on outside click
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

  const updateAdvancedFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    onAdvancedFiltersChange({ ...advancedFilters, [key]: value });
  };

  const handleMetricSubmit = () => {
    if (editingMetric && metricValue) {
      updateAdvancedFilter(editingMetric.key, metricValue);
      setEditingMetric(null);
      setMetricValue('');
      setIsAddMenuOpen(false);
    }
  };

  const toggleIPv4 = () => {
    onFilterChange(new tcpmonitor.FilterOptions({
      ...filter,
      IPv4Only: !filter.IPv4Only,
      IPv6Only: !filter.IPv4Only ? false : filter.IPv6Only
    }));
  };

  const toggleIPv6 = () => {
    onFilterChange(new tcpmonitor.FilterOptions({
      ...filter,
      IPv6Only: !filter.IPv6Only,
      IPv4Only: !filter.IPv6Only ? false : filter.IPv4Only
    }));
  };

  return (
    <div className="filter-controls">
      {/* Search By Address */}
      <div className="filter-group">
        <label>Search</label>
        <input
          type="text"
          placeholder="IP Address..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="filter-input"
        />
      </div>

      {/* PID Filter */}
      <div className="filter-group">
        <label>PID</label>
        <input
          type="number"
          placeholder="PID"
          value={pidInput}
          onChange={(e) => setPidInput(e.target.value)}
          className="filter-input short"
        />
      </div>

      {/* Port Filter */}
      <div className="filter-group">
        <label>Port</label>
        <input
          type="number"
          placeholder="Port"
          value={portInput}
          onChange={(e) => setPortInput(e.target.value)}
          className="filter-input short"
        />
      </div>

      {/* Add Filter Button & Dropdown (replaces State dropdown) */}
      <div className="filter-group add-filter-wrapper" ref={dropdownRef}>
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
              <button className="menu-item" onClick={() => updateAdvancedFilter('hideInternal', !advancedFilters.hideInternal)}>
                {advancedFilters.hideInternal ? '✓ ' : ''}Hide Internal
              </button>
              <button className="menu-item" onClick={() => updateAdvancedFilter('hideLocalhost', !advancedFilters.hideLocalhost)}>
                {advancedFilters.hideLocalhost ? '✓ ' : ''}Hide Localhost
              </button>
              <button className="menu-item" onClick={() => updateAdvancedFilter('showOnlyRetrans', !advancedFilters.showOnlyRetrans)}>
                {advancedFilters.showOnlyRetrans ? '✓ ' : ''}Retransmissions Only
              </button>
            </div>

            <div className="menu-section">
              <span className="menu-header">State</span>
              {TCP_STATES.map(state => (
                <button
                  key={state.value}
                  className="menu-item"
                  onClick={() => {
                    updateAdvancedFilter('stateFilter', state.value);
                    setIsAddMenuOpen(false);
                  }}
                >
                  {advancedFilters.stateFilter === state.value ? '✓ ' : ''}{state.label}
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

      {/* Protocol Toggles */}
      <div className="filter-group checkbox-group">
        <label className={`checkbox-label ${filter.IPv4Only ? 'active' : ''}`}>
          <input
            type="checkbox"
            checked={filter.IPv4Only}
            onChange={toggleIPv4}
          />
          IPv4 Only
        </label>
        <label className={`checkbox-label ${filter.IPv6Only ? 'active' : ''}`}>
          <input
            type="checkbox"
            checked={filter.IPv6Only}
            onChange={toggleIPv6}
          />
          IPv6 Only
        </label>
      </div>
    </div>
  );
};

export default FilterControls;
