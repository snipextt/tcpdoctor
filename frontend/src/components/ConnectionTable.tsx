import React, { useState, useMemo, useCallback } from 'react';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { tcpmonitor } from '../../wailsjs/go/models';
import { TCPStateNames, TCPState } from '../types';
import { formatBytes, formatEndpoint, formatCount } from '../utils/formatters';
import { theme, getTCPStateColor, getHealthColor } from '../theme';
import './ConnectionTable.css';

interface ConnectionTableProps {
  connections: tcpmonitor.ConnectionInfo[];
  selectedConnection: tcpmonitor.ConnectionInfo | null;
  onSelectConnection: (conn: tcpmonitor.ConnectionInfo) => void;
  isLoading?: boolean;
  viewingSnapshot?: boolean;
}

type SortColumn = 'localAddr' | 'localPort' | 'remoteAddr' | 'remotePort' | 'state' | 'pid' | 'bytesIn' | 'bytesOut';
type SortDirection = 'asc' | 'desc';

interface ColumnDefinition {
  key: SortColumn;
  label: string;
  width: number;
  align?: 'left' | 'center' | 'right';
  defaultVisible: boolean;
}

const ALL_COLUMNS: ColumnDefinition[] = [
  { key: 'localAddr', label: 'Local Address', width: 170, align: 'left', defaultVisible: true },
  { key: 'localPort', label: 'Local Port', width: 90, align: 'left', defaultVisible: true },
  { key: 'remoteAddr', label: 'Remote Address', width: 170, align: 'left', defaultVisible: true },
  { key: 'remotePort', label: 'Remote Port', width: 90, align: 'left', defaultVisible: true },
  { key: 'state', label: 'State', width: 110, align: 'left', defaultVisible: true },
  { key: 'pid', label: 'PID', width: 70, align: 'left', defaultVisible: true },
  { key: 'bytesIn', label: 'Bytes In', width: 110, align: 'left', defaultVisible: true },
  { key: 'bytesOut', label: 'Bytes Out', width: 110, align: 'left', defaultVisible: true },
];

const ROW_HEIGHT = 48;
const HEADER_HEIGHT = 44;

function ConnectionTable({ connections, selectedConnection, onSelectConnection, isLoading = false, viewingSnapshot = false }: ConnectionTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>('localPort');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  // State for visible columns
  const [visibleColumns, setVisibleColumns] = useState<Set<SortColumn>>(() => {
    // Load saved preferences or default
    const saved = localStorage.getItem('visible_columns');
    if (saved) {
      try {
        return new Set(JSON.parse(saved) as SortColumn[]);
      } catch (e) {
        // Fallback if parse fails
      }
    }
    return new Set(ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.key));
  });

  const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);
  const columnMenuRef = React.useRef<HTMLDivElement>(null);

  // Close column menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (columnMenuRef.current && !columnMenuRef.current.contains(event.target as Node)) {
        setIsColumnMenuOpen(false);
      }
    };
    if (isColumnMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isColumnMenuOpen]);

  const toggleColumn = (key: SortColumn) => {
    const newSet = new Set(visibleColumns);
    if (newSet.has(key)) {
      if (newSet.size > 1) { // Prevent hiding all columns
        newSet.delete(key);
      }
    } else {
      newSet.add(key);
    }
    setVisibleColumns(newSet);
    localStorage.setItem('visible_columns', JSON.stringify(Array.from(newSet)));
  };

  const columns = useMemo(() => {
    return ALL_COLUMNS.filter(col => visibleColumns.has(col.key));
  }, [visibleColumns]);

  // Handle column header click for sorting
  const handleSort = useCallback((column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  }, [sortColumn]);

  // Sort connections based on current sort column and direction
  const sortedConnections = useMemo(() => {
    const sorted = [...connections].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortColumn) {
        case 'localAddr':
          aValue = a.LocalAddr;
          bValue = b.LocalAddr;
          break;
        case 'localPort':
          aValue = a.LocalPort;
          bValue = b.LocalPort;
          break;
        case 'remoteAddr':
          aValue = a.RemoteAddr;
          bValue = b.RemoteAddr;
          break;
        case 'remotePort':
          aValue = a.RemotePort;
          bValue = b.RemotePort;
          break;
        case 'state':
          aValue = a.State;
          bValue = b.State;
          break;
        case 'pid':
          aValue = a.PID;
          bValue = b.PID;
          break;
        case 'bytesIn':
          aValue = a.BasicStats?.DataBytesIn || 0;
          bValue = b.BasicStats?.DataBytesIn || 0;
          break;
        case 'bytesOut':
          aValue = a.BasicStats?.DataBytesOut || 0;
          bValue = b.BasicStats?.DataBytesOut || 0;
          break;
        default:
          return 0;
      }

      // Handle string comparison
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      // Handle numeric comparison
      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return bValue < aValue ? -1 : bValue > aValue ? 1 : 0;
      }
    });

    return sorted;
  }, [connections, sortColumn, sortDirection]);

  // Check if a connection is selected
  const isSelected = useCallback((conn: tcpmonitor.ConnectionInfo) => {
    if (!selectedConnection) return false;
    // Use local + remote addr/port + PID for uniqueness if possible, 
    // or just local/remote pair if that's what we have.
    // Assuming Local+Remote tuple is unique enough for now.
    return (
      conn.LocalAddr === selectedConnection.LocalAddr &&
      conn.LocalPort === selectedConnection.LocalPort &&
      conn.RemoteAddr === selectedConnection.RemoteAddr &&
      conn.RemotePort === selectedConnection.RemotePort
    );
  }, [selectedConnection]);

  // Create a custom ItemData type for the list
  const itemData = useMemo(() => ({
    connections: sortedConnections,
    columns, // Pass columns definition to the Row
    selectedConnection,
    onSelectConnection
  }), [sortedConnections, columns, selectedConnection, onSelectConnection]);

  // Render a single row
  const Row = useCallback(({ index, style, data }: any) => {
    const conn = data.connections[index];
    const cols = data.columns as ColumnDefinition[];
    const selected = data.selectedConnection &&
      data.selectedConnection.LocalAddr === conn.LocalAddr &&
      data.selectedConnection.LocalPort === conn.LocalPort &&
      data.selectedConnection.RemoteAddr === conn.RemoteAddr &&
      data.selectedConnection.RemotePort === conn.RemotePort;

    // Just a basic check to prevent crashes if health is missing
    const healthColor = getHealthColor(false, false);

    return (
      <div
        style={style}
        className={`connection-row ${selected ? 'selected' : ''}`}
        onMouseDown={() => data.onSelectConnection(conn)}
      >
        {/* Health Indicator */}
        <div className="health-indicator" style={{ backgroundColor: healthColor }} />

        {cols.map((col: ColumnDefinition) => {
          let content: React.ReactNode = null;
          switch (col.key) {
            case 'localAddr':
              content = conn.LocalAddr;
              break;
            case 'localPort':
              content = conn.LocalPort;
              break;
            case 'remoteAddr':
              content = conn.RemoteAddr;
              break;
            case 'remotePort':
              content = conn.RemotePort;
              break;
            case 'state':
              content = (
                <span
                  className="state-badge"
                  style={{
                    backgroundColor: getTCPStateColor(conn.State),
                    color: '#ffffff'
                  }}
                >
                  {TCPStateNames[conn.State as TCPState] || 'UNKNOWN'}
                </span>
              );
              break;
            case 'pid':
              content = formatCount(conn.PID);
              break;
            case 'bytesIn':
              content = conn.BasicStats ? formatBytes(conn.BasicStats.DataBytesIn).formatted : '—';
              break;
            case 'bytesOut':
              content = conn.BasicStats ? formatBytes(conn.BasicStats.DataBytesOut).formatted : '—';
              break;
          }

          return (
            <div
              key={col.key}
              className={`cell ${col.key === 'state' ? 'state-cell' : ''}`}
              style={{ width: col.width, textAlign: col.align }}
            >
              {content}
            </div>
          );
        })}
      </div>
    );
  }, []); // Dependencies are handled via data prop

  // Calculate total width for the table
  const totalWidth = columns.reduce((sum, col) => sum + col.width, 0) + 8; // +8 for health indicator

  return (
    <div className="connection-table-container">
      {/* Column Selector Menu */}
      <div className="table-actions">
        <div className="column-selector" ref={columnMenuRef}>
          <button 
            className="btn-columns"
            onClick={() => setIsColumnMenuOpen(!isColumnMenuOpen)}
            title="Select Columns"
          >
            📋 Columns
          </button>
          
          {isColumnMenuOpen && (
            <div className="column-dropdown">
              <div className="dropdown-header">Visible Columns</div>
              {ALL_COLUMNS.map(col => (
                <label key={col.key} className="column-option">
                  <input
                    type="checkbox"
                    checked={visibleColumns.has(col.key)}
                    onChange={() => toggleColumn(col.key)}
                    disabled={visibleColumns.has(col.key) && visibleColumns.size === 1}
                  />
                  {col.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="connection-table-header">
        <div className="health-indicator-header" />
        {columns.map(column => (
          <div
            key={column.key}
            className={`header-cell ${sortColumn === column.key ? 'sorted' : ''}`}
            style={{ width: column.width, textAlign: column.align }}
            onClick={() => handleSort(column.key)}
          >
            <span>{column.label}</span>
            {sortColumn === column.key && (
              <span className="sort-indicator">
                {sortDirection === 'asc' ? '▲' : '▼'}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Table Body */}
      <div className="connection-table-body">
        {isLoading ? (
          <div className="table-message">Loading connections...</div>
        ) : connections.length === 0 ? (
          <div className="table-message">No connections found</div>
        ) : (
          <AutoSizer>
            {({ height, width }: { height: number; width: number }) => (
              <List
                height={height}
                itemCount={sortedConnections.length}
                itemSize={ROW_HEIGHT}
                width={Math.max(width, totalWidth)}
                overscanCount={5}
                itemData={itemData}
              >
                {Row}
              </List>
            )}
          </AutoSizer>
        )}
      </div>

      {/* Footer with connection count */}
      <div className="connection-table-footer">
        <span>{formatCount(connections.length)} connection{connections.length !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );
}

export default ConnectionTable;
