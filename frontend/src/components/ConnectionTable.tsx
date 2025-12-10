import React, { useState, useMemo, useCallback } from 'react';
import { FixedSizeList as List } from 'react-window';
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
}

type SortColumn = 'localAddr' | 'localPort' | 'remoteAddr' | 'remotePort' | 'state' | 'pid' | 'bytesIn' | 'bytesOut';
type SortDirection = 'asc' | 'desc';

interface ColumnDefinition {
  key: SortColumn;
  label: string;
  width: number;
  align?: 'left' | 'center' | 'right';
}

const COLUMNS: ColumnDefinition[] = [
  { key: 'localAddr', label: 'Local Address', width: 180, align: 'left' },
  { key: 'localPort', label: 'Local Port', width: 100, align: 'right' },
  { key: 'remoteAddr', label: 'Remote Address', width: 180, align: 'left' },
  { key: 'remotePort', label: 'Remote Port', width: 100, align: 'right' },
  { key: 'state', label: 'State', width: 120, align: 'center' },
  { key: 'pid', label: 'PID', width: 80, align: 'right' },
  { key: 'bytesIn', label: 'Bytes In', width: 120, align: 'right' },
  { key: 'bytesOut', label: 'Bytes Out', width: 120, align: 'right' },
];

const ROW_HEIGHT = 48;
const HEADER_HEIGHT = 44;

function ConnectionTable({ connections, selectedConnection, onSelectConnection, isLoading = false }: ConnectionTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>('localPort');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Handle column header click for sorting
  const handleSort = useCallback((column: SortColumn) => {
    if (sortColumn === column) {
      // Toggle direction if clicking the same column
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new column with ascending direction
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
    return (
      conn.LocalAddr === selectedConnection.LocalAddr &&
      conn.LocalPort === selectedConnection.LocalPort &&
      conn.RemoteAddr === selectedConnection.RemoteAddr &&
      conn.RemotePort === selectedConnection.RemotePort
    );
  }, [selectedConnection]);

  // Render a single row
  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const conn = sortedConnections[index];
    const selected = isSelected(conn);
    const hasWarning = conn.HighRetransmissionWarning || conn.HighRTTWarning;
    const healthColor = getHealthColor(hasWarning, false);

    return (
      <div
        style={style}
        className={`connection-row ${selected ? 'selected' : ''}`}
        onClick={() => onSelectConnection(conn)}
      >
        {/* Health Indicator */}
        <div className="health-indicator" style={{ backgroundColor: healthColor }} />

        {/* Local Address */}
        <div className="cell" style={{ width: COLUMNS[0].width, textAlign: COLUMNS[0].align }}>
          {conn.LocalAddr}
        </div>

        {/* Local Port */}
        <div className="cell" style={{ width: COLUMNS[1].width, textAlign: COLUMNS[1].align }}>
          {conn.LocalPort}
        </div>

        {/* Remote Address */}
        <div className="cell" style={{ width: COLUMNS[2].width, textAlign: COLUMNS[2].align }}>
          {conn.RemoteAddr}
        </div>

        {/* Remote Port */}
        <div className="cell" style={{ width: COLUMNS[3].width, textAlign: COLUMNS[3].align }}>
          {conn.RemotePort}
        </div>

        {/* State */}
        <div className="cell state-cell" style={{ width: COLUMNS[4].width, textAlign: COLUMNS[4].align }}>
          <span
            className="state-badge"
            style={{
              backgroundColor: getTCPStateColor(conn.State),
              color: '#ffffff'
            }}
          >
            {TCPStateNames[conn.State as TCPState] || 'UNKNOWN'}
          </span>
        </div>

        {/* PID */}
        <div className="cell" style={{ width: COLUMNS[5].width, textAlign: COLUMNS[5].align }}>
          {formatCount(conn.PID)}
        </div>

        {/* Bytes In */}
        <div className="cell" style={{ width: COLUMNS[6].width, textAlign: COLUMNS[6].align }}>
          {conn.BasicStats ? formatBytes(conn.BasicStats.DataBytesIn).formatted : '—'}
        </div>

        {/* Bytes Out */}
        <div className="cell" style={{ width: COLUMNS[7].width, textAlign: COLUMNS[7].align }}>
          {conn.BasicStats ? formatBytes(conn.BasicStats.DataBytesOut).formatted : '—'}
        </div>
      </div>
    );
  }, [sortedConnections, isSelected, onSelectConnection]);

  // Calculate total width for the table
  const totalWidth = COLUMNS.reduce((sum, col) => sum + col.width, 0) + 8; // +8 for health indicator

  return (
    <div className="connection-table-container">
      {/* Header */}
      <div className="connection-table-header" style={{ width: totalWidth }}>
        <div className="health-indicator-header" />
        {COLUMNS.map(column => (
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
          <List
            height={600}
            itemCount={sortedConnections.length}
            itemSize={ROW_HEIGHT}
            width={totalWidth}
            overscanCount={5}
          >
            {Row}
          </List>
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
