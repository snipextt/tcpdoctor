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

type SortColumn = 'localAddr' | 'localPort' | 'remoteAddr' | 'remotePort' | 'state' | 'pid' | 'bytesIn' | 'bytesOut' | 'timestamp';
type SortDirection = 'asc' | 'desc';

interface ColumnDefinition {
  key: SortColumn;
  label: string;
  width: number;
  align?: 'left' | 'center' | 'right';
}

const BASE_COLUMNS: ColumnDefinition[] = [
  { key: 'localAddr', label: 'Local Address', width: 170, align: 'left' },
  { key: 'localPort', label: 'Local Port', width: 90, align: 'left' },
  { key: 'remoteAddr', label: 'Remote Address', width: 170, align: 'left' },
  { key: 'remotePort', label: 'Remote Port', width: 90, align: 'left' },
  { key: 'state', label: 'State', width: 110, align: 'left' },
  { key: 'pid', label: 'PID', width: 70, align: 'left' },
  { key: 'bytesIn', label: 'Bytes In', width: 110, align: 'left' },
  { key: 'bytesOut', label: 'Bytes Out', width: 110, align: 'left' },
];

const TIME_COLUMN: ColumnDefinition = {
  key: 'timestamp', label: 'Time', width: 100, align: 'left'
};

const ROW_HEIGHT = 48;
const HEADER_HEIGHT = 44;

function ConnectionTable({ connections, selectedConnection, onSelectConnection, isLoading = false, viewingSnapshot = false }: ConnectionTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>(viewingSnapshot ? 'timestamp' : 'localPort');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const columns = useMemo(() => {
    return viewingSnapshot ? [TIME_COLUMN, ...BASE_COLUMNS] : BASE_COLUMNS;
  }, [viewingSnapshot]);

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
        case 'timestamp':
          aValue = (a as any).Timestamp || '';
          bValue = (b as any).Timestamp || '';
          break;
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
    const healthColor = getHealthColor(100);

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
            case 'timestamp':
              content = (conn as any).Timestamp || '-';
              break;
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

      /* Footer with connection count */
      <div className="connection-table-footer">
        <span>{formatCount(connections.length)} connection{connections.length !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );
}

export default ConnectionTable;
