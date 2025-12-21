// Re-export backend types for convenience
export type { tcpmonitor } from '../../wailsjs/go/models';

// TCP State enum matching the Go backend
export enum TCPState {
  Closed = 1,
  Listen = 2,
  SynSent = 3,
  SynRcvd = 4,
  Established = 5,
  FinWait1 = 6,
  FinWait2 = 7,
  CloseWait = 8,
  Closing = 9,
  LastAck = 10,
  TimeWait = 11,
  DeleteTCB = 12,
}

// Human-readable state names
export const TCPStateNames: Record<TCPState, string> = {
  [TCPState.Closed]: 'CLOSED',
  [TCPState.Listen]: 'LISTEN',
  [TCPState.SynSent]: 'SYN_SENT',
  [TCPState.SynRcvd]: 'SYN_RCVD',
  [TCPState.Established]: 'ESTABLISHED',
  [TCPState.FinWait1]: 'FIN_WAIT_1',
  [TCPState.FinWait2]: 'FIN_WAIT_2',
  [TCPState.CloseWait]: 'CLOSE_WAIT',
  [TCPState.Closing]: 'CLOSING',
  [TCPState.LastAck]: 'LAST_ACK',
  [TCPState.TimeWait]: 'TIME_WAIT',
  [TCPState.DeleteTCB]: 'DELETE_TCB',
};

// Application state types
export interface AppState {
  connections: any[]; // tcpmonitor.ConnectionInfo[]
  selectedConnection: any | null; // tcpmonitor.ConnectionInfo | null
  filter: any; // tcpmonitor.FilterOptions
  isAdmin: boolean;
  updateInterval: number;
  isLoading: boolean;
  error: string | null;
}

// Component prop types
export interface ConnectionTableProps {
  connections: any[]; // tcpmonitor.ConnectionInfo[]
  selectedConnection: any | null; // tcpmonitor.ConnectionInfo | null
  onSelectConnection: (conn: any) => void;
  isLoading?: boolean;
}

export interface StatsPanelProps {
  connection: any | null; // tcpmonitor.ConnectionInfo | null
  isAdmin: boolean;
  onDiagnose?: () => Promise<any>;
  isAIConfigured?: boolean;
  onConfigureAPI?: () => void;
  onViewHistory?: () => void;
  hasHistory?: boolean;
  initialHistory?: Array<{ time: number; rtt?: number; bwIn?: number; bwOut?: number }>; // For session mode
}

export interface FilterControlsProps {
  filter: any; // tcpmonitor.FilterOptions
  onFilterChange: (filter: any) => void;
}

// Utility types for formatting
export interface FormattedValue {
  value: number;
  unit: string;
  formatted: string;
}
