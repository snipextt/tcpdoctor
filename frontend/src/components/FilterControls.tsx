import React, { useState, useEffect } from 'react';
import { FilterControlsProps, TCPState, TCPStateNames } from '../types';
import { tcpmonitor } from '../../wailsjs/go/models';

const FilterControls: React.FC<FilterControlsProps> = ({
  filter,
  onFilterChange,
}) => {
  // Local state for inputs to allow debouncing
  const [pidInput, setPidInput] = useState<string>(filter.PID ? filter.PID.toString() : '');
  const [portInput, setPortInput] = useState<string>(filter.Port ? filter.Port.toString() : '');
  const [searchInput, setSearchInput] = useState<string>(filter.SearchText || '');

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

  const handleStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value ? parseInt(e.target.value, 10) : undefined;
    onFilterChange(new tcpmonitor.FilterOptions({
      ...filter,
      State: value,
    }));
  };

  const toggleIPv4 = () => {
    onFilterChange(new tcpmonitor.FilterOptions({
      ...filter,
      IPv4Only: !filter.IPv4Only,
      // If we enable IPv4 only, we must disable IPv6 only if it was enabled (mutual exclusion logic if desired,
      // but usually these are independent filters: "Show IPv4" AND "Show IPv6". 
      // However, the backend logic implies "IPv4Only" means "Show ONLY IPv4".
      // If both are true -> Show nothing? Or typically these work as toggles.
      // Let's assume they are "Show IPv4" and "Show IPv6" toggles in the UI, 
      // but the model is "IPv4Only" and "IPv6Only".
      // If the user wants to see everything: IPv4Only=false, IPv6Only=false.
      // If the user wants to see only IPv4: IPv4Only=true.
      // If the user clicks "IPv4 Only", we set IPv4Only=true.
      // If we simple toggle flags:
      IPv6Only: !filter.IPv4Only ? false : filter.IPv6Only // If enabling v4-only, disable v6-only to avoid empty set
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

      {/* State Filter */}
      <div className="filter-group">
        <label>State</label>
        <select
          value={filter.State || ''}
          onChange={handleStateChange}
          className="filter-select"
        >
          <option value="">All States</option>
          {Object.entries(TCPStateNames).map(([value, name]) => (
            <option key={value} value={value}>
              {name}
            </option>
          ))}
        </select>
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
        <label className={`checkbox-label ${filter.ExcludeInternal ? 'active' : ''}`}>
          <input
            type="checkbox"
            checked={filter.ExcludeInternal || false}
            onChange={() => onFilterChange(new tcpmonitor.FilterOptions({
              ...filter,
              ExcludeInternal: !filter.ExcludeInternal,
            }))}
          />
          Hide Internal
        </label>
      </div>
    </div>
  );
};

export default FilterControls;
