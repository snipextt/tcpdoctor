import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { tcpmonitor } from '../../wailsjs/go/models';
import { TCPStateNames, TCPState } from '../types';
import { formatBytes, formatEndpoint, formatCount, formatRTT, formatBandwidth } from '../utils/formatters';
import { theme, getTCPStateColor, getHealthColor } from '../theme';
import './ConnectionTable.css';

interface ConnectionTableProps {
  connections: tcpmonitor.ConnectionInfo[];
  selectedConnection: tcpmonitor.ConnectionInfo | null;
  onSelectConnection: (conn: tcpmonitor.ConnectionInfo) => void;
  isLoading?: boolean;
  viewingSnapshot?: boolean;
}

type SortColumn =
  | 'localAddr' | 'localPort' | 'remoteAddr' | 'remotePort' | 'state' | 'pid' | 'bytesIn' | 'bytesOut'
  | 'totalSegsOut' | 'totalSegsIn'
  | 'segsRetrans' | 'bytesRetrans' | 'fastRetrans' | 'timeoutEpisodes'
  | 'sampleRTT' | 'smoothedRTT' | 'rttVariance' | 'minRTT' | 'maxRTT'
  | 'currentCwnd' | 'currentSsthresh' | 'slowStartCount' | 'congAvoidCount'
  | 'inboundBandwidth' | 'outboundBandwidth'
  | 'thruBytesAcked' | 'thruBytesReceived'
  | 'curRetxQueue' | 'maxRetxQueue' | 'curAppWQueue' | 'maxAppWQueue'
  | 'winScaleSent' | 'winScaleRcvd' | 'curRwinSent' | 'maxRwinSent' | 'curRwinRcvd' | 'maxRwinRcvd'
  | 'curMss' | 'maxMss' | 'minMss'
  | 'dupAcksIn' | 'dupAcksOut' | 'sacksRcvd' | 'sackBlocksRcvd' | 'dsackDups';

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

  // Data Transfer
  { key: 'totalSegsOut', label: 'Segs Out', width: 100, align: 'left', defaultVisible: false },
  { key: 'totalSegsIn', label: 'Segs In', width: 100, align: 'left', defaultVisible: false },

  // Retransmissions
  { key: 'segsRetrans', label: 'Retrans Segs', width: 110, align: 'left', defaultVisible: false },
  { key: 'bytesRetrans', label: 'Retrans Bytes', width: 110, align: 'left', defaultVisible: false },
  { key: 'fastRetrans', label: 'Fast Retrans', width: 100, align: 'left', defaultVisible: false },
  { key: 'timeoutEpisodes', label: 'Timeouts', width: 90, align: 'left', defaultVisible: false },

  // RTT
  { key: 'sampleRTT', label: 'Sample RTT', width: 100, align: 'left', defaultVisible: false },
  { key: 'smoothedRTT', label: 'RTT (ms)', width: 100, align: 'left', defaultVisible: false },
  { key: 'rttVariance', label: 'RTT Var', width: 90, align: 'left', defaultVisible: false },
  { key: 'minRTT', label: 'Min RTT', width: 90, align: 'left', defaultVisible: false },
  { key: 'maxRTT', label: 'Max RTT', width: 90, align: 'left', defaultVisible: false },

  // Congestion Control
  { key: 'currentCwnd', label: 'Cwnd', width: 100, align: 'left', defaultVisible: false },
  { key: 'currentSsthresh', label: 'Ssthresh', width: 100, align: 'left', defaultVisible: false },
  { key: 'slowStartCount', label: 'SS Count', width: 90, align: 'left', defaultVisible: false },
  { key: 'congAvoidCount', label: 'CA Count', width: 90, align: 'left', defaultVisible: false },

  // Bandwidth & Throughput
  { key: 'inboundBandwidth', label: 'In Bandwidth', width: 120, align: 'left', defaultVisible: false },
  { key: 'outboundBandwidth', label: 'Out Bandwidth', width: 120, align: 'left', defaultVisible: false },
  { key: 'thruBytesAcked', label: 'Thru Acked', width: 120, align: 'left', defaultVisible: false },
  { key: 'thruBytesReceived', label: 'Thru Rcvd', width: 120, align: 'left', defaultVisible: false },

  // Buffers
  { key: 'curRetxQueue', label: 'Cur Retx Q', width: 100, align: 'left', defaultVisible: false },
  { key: 'maxRetxQueue', label: 'Max Retx Q', width: 100, align: 'left', defaultVisible: false },
  { key: 'curAppWQueue', label: 'Cur App Q', width: 100, align: 'left', defaultVisible: false },
  { key: 'maxAppWQueue', label: 'Max App Q', width: 100, align: 'left', defaultVisible: false },

  // Window & Scaling
  { key: 'winScaleSent', label: 'Snd Scale', width: 90, align: 'left', defaultVisible: false },
  { key: 'winScaleRcvd', label: 'Rcv Scale', width: 90, align: 'left', defaultVisible: false },
  { key: 'curRwinSent', label: 'Cur Snd Win', width: 120, align: 'left', defaultVisible: false },
  { key: 'maxRwinSent', label: 'Max Snd Win', width: 120, align: 'left', defaultVisible: false },
  { key: 'curRwinRcvd', label: 'Cur Rcv Win', width: 120, align: 'left', defaultVisible: false },
  { key: 'maxRwinRcvd', label: 'Max Rcv Win', width: 120, align: 'left', defaultVisible: false },

  // MSS
  { key: 'curMss', label: 'Cur MSS', width: 100, align: 'left', defaultVisible: false },
  { key: 'maxMss', label: 'Max MSS', width: 100, align: 'left', defaultVisible: false },
  { key: 'minMss', label: 'Min MSS', width: 100, align: 'left', defaultVisible: false },

  // SACKs & Duplicates
  { key: 'dupAcksIn', label: 'Dup ACKs In', width: 110, align: 'left', defaultVisible: false },
  { key: 'dupAcksOut', label: 'Dup ACKs Out', width: 110, align: 'left', defaultVisible: false },
  { key: 'sacksRcvd', label: 'SACKs Rcvd', width: 110, align: 'left', defaultVisible: false },
  { key: 'sackBlocksRcvd', label: 'SACK Blocks', width: 110, align: 'left', defaultVisible: false },
  { key: 'dsackDups', label: 'DSACK Dups', width: 110, align: 'left', defaultVisible: false },
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
        case 'totalSegsOut':
          aValue = a.ExtendedStats?.TotalSegsOut || 0;
          bValue = b.ExtendedStats?.TotalSegsOut || 0;
          break;
        case 'totalSegsIn':
          aValue = a.ExtendedStats?.TotalSegsIn || 0;
          bValue = b.ExtendedStats?.TotalSegsIn || 0;
          break;
        case 'segsRetrans':
          aValue = a.ExtendedStats?.SegsRetrans || 0;
          bValue = b.ExtendedStats?.SegsRetrans || 0;
          break;
        case 'bytesRetrans':
          aValue = a.ExtendedStats?.BytesRetrans || 0;
          bValue = b.ExtendedStats?.BytesRetrans || 0;
          break;
        case 'fastRetrans':
          aValue = a.ExtendedStats?.FastRetrans || 0;
          bValue = b.ExtendedStats?.FastRetrans || 0;
          break;
        case 'timeoutEpisodes':
          aValue = a.ExtendedStats?.TimeoutEpisodes || 0;
          bValue = b.ExtendedStats?.TimeoutEpisodes || 0;
          break;
        case 'sampleRTT':
          aValue = a.ExtendedStats?.SampleRTT || 0;
          bValue = b.ExtendedStats?.SampleRTT || 0;
          break;
        case 'smoothedRTT':
          aValue = a.ExtendedStats?.SmoothedRTT || 0;
          bValue = b.ExtendedStats?.SmoothedRTT || 0;
          break;
        case 'rttVariance':
          aValue = a.ExtendedStats?.RTTVariance || 0;
          bValue = b.ExtendedStats?.RTTVariance || 0;
          break;
        case 'minRTT':
          aValue = a.ExtendedStats?.MinRTT || 0;
          bValue = b.ExtendedStats?.MinRTT || 0;
          break;
        case 'maxRTT':
          aValue = a.ExtendedStats?.MaxRTT || 0;
          bValue = b.ExtendedStats?.MaxRTT || 0;
          break;
        case 'currentCwnd':
          aValue = a.ExtendedStats?.CurrentCwnd || 0;
          bValue = b.ExtendedStats?.CurrentCwnd || 0;
          break;
        case 'currentSsthresh':
          aValue = a.ExtendedStats?.CurrentSsthresh || 0;
          bValue = b.ExtendedStats?.CurrentSsthresh || 0;
          break;
        case 'slowStartCount':
          aValue = a.ExtendedStats?.SlowStartCount || 0;
          bValue = b.ExtendedStats?.SlowStartCount || 0;
          break;
        case 'congAvoidCount':
          aValue = a.ExtendedStats?.CongAvoidCount || 0;
          bValue = b.ExtendedStats?.CongAvoidCount || 0;
          break;
        case 'inboundBandwidth':
          aValue = a.ExtendedStats?.InboundBandwidth || 0;
          bValue = b.ExtendedStats?.InboundBandwidth || 0;
          break;
        case 'outboundBandwidth':
          aValue = a.ExtendedStats?.OutboundBandwidth || 0;
          bValue = b.ExtendedStats?.OutboundBandwidth || 0;
          break;
        case 'thruBytesAcked':
          aValue = a.ExtendedStats?.ThruBytesAcked || 0;
          bValue = b.ExtendedStats?.ThruBytesAcked || 0;
          break;
        case 'thruBytesReceived':
          aValue = a.ExtendedStats?.ThruBytesReceived || 0;
          bValue = b.ExtendedStats?.ThruBytesReceived || 0;
          break;
        case 'curRetxQueue':
          aValue = a.ExtendedStats?.CurRetxQueue || 0;
          bValue = b.ExtendedStats?.CurRetxQueue || 0;
          break;
        case 'maxRetxQueue':
          aValue = a.ExtendedStats?.MaxRetxQueue || 0;
          bValue = b.ExtendedStats?.MaxRetxQueue || 0;
          break;
        case 'curAppWQueue':
          aValue = a.ExtendedStats?.CurAppWQueue || 0;
          bValue = b.ExtendedStats?.CurAppWQueue || 0;
          break;
        case 'maxAppWQueue':
          aValue = a.ExtendedStats?.MaxAppWQueue || 0;
          bValue = b.ExtendedStats?.MaxAppWQueue || 0;
          break;
        case 'winScaleSent':
          aValue = a.ExtendedStats?.WinScaleSent || 0;
          bValue = b.ExtendedStats?.WinScaleSent || 0;
          break;
        case 'winScaleRcvd':
          aValue = a.ExtendedStats?.WinScaleRcvd || 0;
          bValue = b.ExtendedStats?.WinScaleRcvd || 0;
          break;
        case 'curRwinSent':
          aValue = a.ExtendedStats?.CurRwinSent || 0;
          bValue = b.ExtendedStats?.CurRwinSent || 0;
          break;
        case 'maxRwinSent':
          aValue = a.ExtendedStats?.MaxRwinSent || 0;
          bValue = b.ExtendedStats?.MaxRwinSent || 0;
          break;
        case 'curRwinRcvd':
          aValue = a.ExtendedStats?.CurRwinRcvd || 0;
          bValue = b.ExtendedStats?.CurRwinRcvd || 0;
          break;
        case 'maxRwinRcvd':
          aValue = a.ExtendedStats?.MaxRwinRcvd || 0;
          bValue = b.ExtendedStats?.MaxRwinRcvd || 0;
          break;
        case 'curMss':
          aValue = a.ExtendedStats?.CurMss || 0;
          bValue = b.ExtendedStats?.CurMss || 0;
          break;
        case 'maxMss':
          aValue = a.ExtendedStats?.MaxMss || 0;
          bValue = b.ExtendedStats?.MaxMss || 0;
          break;
        case 'minMss':
          aValue = a.ExtendedStats?.MinMss || 0;
          bValue = b.ExtendedStats?.MinMss || 0;
          break;
        case 'dupAcksIn':
          aValue = a.ExtendedStats?.DupAcksIn || 0;
          bValue = b.ExtendedStats?.DupAcksIn || 0;
          break;
        case 'dupAcksOut':
          aValue = a.ExtendedStats?.DupAcksOut || 0;
          bValue = b.ExtendedStats?.DupAcksOut || 0;
          break;
        case 'sacksRcvd':
          aValue = a.ExtendedStats?.SacksRcvd || 0;
          bValue = b.ExtendedStats?.SacksRcvd || 0;
          break;
        case 'sackBlocksRcvd':
          aValue = a.ExtendedStats?.SackBlocksRcvd || 0;
          bValue = b.ExtendedStats?.SackBlocksRcvd || 0;
          break;
        case 'dsackDups':
          aValue = a.ExtendedStats?.DsackDups || 0;
          bValue = b.ExtendedStats?.DsackDups || 0;
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
            case 'totalSegsOut':
              content = conn.ExtendedStats ? formatCount(conn.ExtendedStats.TotalSegsOut) : '—';
              break;
            case 'totalSegsIn':
              content = conn.ExtendedStats ? formatCount(conn.ExtendedStats.TotalSegsIn) : '—';
              break;
            case 'segsRetrans':
              content = conn.ExtendedStats ? formatCount(conn.ExtendedStats.SegsRetrans) : '—';
              break;
            case 'bytesRetrans':
              content = conn.ExtendedStats ? formatBytes(conn.ExtendedStats.BytesRetrans).formatted : '—';
              break;
            case 'fastRetrans':
              content = conn.ExtendedStats ? formatCount(conn.ExtendedStats.FastRetrans) : '—';
              break;
            case 'timeoutEpisodes':
              content = conn.ExtendedStats ? formatCount(conn.ExtendedStats.TimeoutEpisodes) : '—';
              break;
            case 'sampleRTT':
              content = conn.ExtendedStats ? formatRTT(conn.ExtendedStats.SampleRTT).formatted : '—';
              break;
            case 'smoothedRTT':
              content = conn.ExtendedStats ? formatRTT(conn.ExtendedStats.SmoothedRTT).formatted : '—';
              break;
            case 'rttVariance':
              content = conn.ExtendedStats ? formatRTT(conn.ExtendedStats.RTTVariance).formatted : '—';
              break;
            case 'minRTT':
              content = conn.ExtendedStats ? formatRTT(conn.ExtendedStats.MinRTT).formatted : '—';
              break;
            case 'maxRTT':
              content = conn.ExtendedStats ? formatRTT(conn.ExtendedStats.MaxRTT).formatted : '—';
              break;
            case 'currentCwnd':
              content = conn.ExtendedStats ? formatCount(conn.ExtendedStats.CurrentCwnd) : '—';
              break;
            case 'currentSsthresh':
              content = conn.ExtendedStats ? formatCount(conn.ExtendedStats.CurrentSsthresh) : '—';
              break;
            case 'slowStartCount':
              content = conn.ExtendedStats ? formatCount(conn.ExtendedStats.SlowStartCount) : '—';
              break;
            case 'congAvoidCount':
              content = conn.ExtendedStats ? formatCount(conn.ExtendedStats.CongAvoidCount) : '—';
              break;
            case 'inboundBandwidth':
              content = conn.ExtendedStats ? formatBandwidth(conn.ExtendedStats.InboundBandwidth).formatted : '—';
              break;
            case 'outboundBandwidth':
              content = conn.ExtendedStats ? formatBandwidth(conn.ExtendedStats.OutboundBandwidth).formatted : '—';
              break;
            case 'thruBytesAcked':
              content = conn.ExtendedStats ? formatBytes(conn.ExtendedStats.ThruBytesAcked).formatted : '—';
              break;
            case 'thruBytesReceived':
              content = conn.ExtendedStats ? formatBytes(conn.ExtendedStats.ThruBytesReceived).formatted : '—';
              break;
            case 'curRetxQueue':
              content = conn.ExtendedStats ? formatCount(conn.ExtendedStats.CurRetxQueue) : '—';
              break;
            case 'maxRetxQueue':
              content = conn.ExtendedStats ? formatCount(conn.ExtendedStats.MaxRetxQueue) : '—';
              break;
            case 'curAppWQueue':
              content = conn.ExtendedStats ? formatCount(conn.ExtendedStats.CurAppWQueue) : '—';
              break;
            case 'maxAppWQueue':
              content = conn.ExtendedStats ? formatCount(conn.ExtendedStats.MaxAppWQueue) : '—';
              break;
            case 'winScaleSent':
              content = conn.ExtendedStats ? formatCount(conn.ExtendedStats.WinScaleSent) : '—';
              break;
            case 'winScaleRcvd':
              content = conn.ExtendedStats ? formatCount(conn.ExtendedStats.WinScaleRcvd) : '—';
              break;
            case 'curRwinSent':
              content = conn.ExtendedStats ? formatBytes(conn.ExtendedStats.CurRwinSent).formatted : '—';
              break;
            case 'maxRwinSent':
              content = conn.ExtendedStats ? formatBytes(conn.ExtendedStats.MaxRwinSent).formatted : '—';
              break;
            case 'curRwinRcvd':
              content = conn.ExtendedStats ? formatBytes(conn.ExtendedStats.CurRwinRcvd).formatted : '—';
              break;
            case 'maxRwinRcvd':
              content = conn.ExtendedStats ? formatBytes(conn.ExtendedStats.MaxRwinRcvd).formatted : '—';
              break;
            case 'curMss':
              content = conn.ExtendedStats ? formatCount(conn.ExtendedStats.CurMss) : '—';
              break;
            case 'maxMss':
              content = conn.ExtendedStats ? formatCount(conn.ExtendedStats.MaxMss) : '—';
              break;
            case 'minMss':
              content = conn.ExtendedStats ? formatCount(conn.ExtendedStats.MinMss) : '—';
              break;
            case 'dupAcksIn':
              content = conn.ExtendedStats ? formatCount(conn.ExtendedStats.DupAcksIn) : '—';
              break;
            case 'dupAcksOut':
              content = conn.ExtendedStats ? formatCount(conn.ExtendedStats.DupAcksOut) : '—';
              break;
            case 'sacksRcvd':
              content = conn.ExtendedStats ? formatCount(conn.ExtendedStats.SacksRcvd) : '—';
              break;
            case 'sackBlocksRcvd':
              content = conn.ExtendedStats ? formatCount(conn.ExtendedStats.SackBlocksRcvd) : '—';
              break;
            case 'dsackDups':
              content = conn.ExtendedStats ? formatCount(conn.ExtendedStats.DsackDups) : '—';
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
