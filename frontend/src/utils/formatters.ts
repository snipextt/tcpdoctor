import { FormattedValue } from '../types';

/**
 * Format bytes with appropriate units (B, KB, MB, GB)
 */
export function formatBytes(bytes: number | undefined | null): FormattedValue {
  if (bytes === null || bytes === undefined || isNaN(bytes)) {
    return { value: 0, unit: 'B', formatted: '0 B' };
  }
  if (bytes === 0) {
    return { value: 0, unit: 'B', formatted: '0 B' };
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  const unit = units[i];

  return {
    value,
    unit,
    formatted: `${value.toFixed(2)} ${unit}`,
  };
}

/**
 * Format milliseconds with appropriate units (ms, s, m)
 */
export function formatMilliseconds(ms: number): FormattedValue {
  if (ms < 1000) {
    return { value: ms, unit: 'ms', formatted: `${ms.toFixed(0)} ms` };
  }

  if (ms < 60000) {
    const seconds = ms / 1000;
    return { value: seconds, unit: 's', formatted: `${seconds.toFixed(2)} s` };
  }

  const minutes = ms / 60000;
  return { value: minutes, unit: 'm', formatted: `${minutes.toFixed(2)} m` };
}

/**
 * Format bandwidth (bits per second from Windows API) to Bytes per second display
 * Windows API returns bandwidth in bits per second, we convert to bytes/second
 */
export function formatBandwidth(bitsPerSecond: number | undefined | null): FormattedValue {
  // Only reject null, undefined, NaN, or zero/negative values
  if (bitsPerSecond === null || bitsPerSecond === undefined || isNaN(bitsPerSecond) || bitsPerSecond <= 0) {
    return { value: 0, unit: 'B/s', formatted: 'N/A' };
  }

  // Convert bits per second to bytes per second (divide by 8)
  const bytesPerSecond = bitsPerSecond / 8;

  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s', 'TB/s'];
  const k = 1000; // Use 1000 for standard SI units

  const i = Math.min(Math.floor(Math.log(bytesPerSecond) / Math.log(k)), units.length - 1);
  const value = bytesPerSecond / Math.pow(k, i);
  const unit = units[i] || 'B/s';

  return {
    value,
    unit,
    formatted: `${value.toFixed(2)} ${unit}`,
  };
}

/**
 * Format a count with thousands separators
 */
export function formatCount(count: number | undefined | null): string {
  if (count === undefined || count === null) return '0';
  return count.toLocaleString();
}

/**
 * Format a percentage
 */
export function formatPercentage(value: number): string {
  return `${value.toFixed(2)}%`;
}

/**
 * Format an IP address and port combination
 */
export function formatEndpoint(address: string, port: number): string {
  // Handle IPv6 addresses with brackets
  if (address.includes(':') && !address.startsWith('[')) {
    return `[${address}]:${port}`;
  }
  return `${address}:${port}`;
}

/**
 * Format RTT (Round Trip Time)
 * According to Microsoft docs, SmoothedRtt, RttVar, MinRtt, MaxRtt are in milliseconds
 * https://learn.microsoft.com/en-us/windows/win32/api/tcpestats/ns-tcpestats-tcp_estats_path_rod_v0
 */
export function formatRTT(milliseconds: number | undefined | null): FormattedValue {
  if (milliseconds === undefined || milliseconds === null) {
    return { value: 0, unit: 'ms', formatted: '0.00 ms' };
  }
  // Values are already in milliseconds from the Windows API
  return {
    value: milliseconds,
    unit: 'ms',
    formatted: `${milliseconds.toFixed(2)} ms`,
  };
}

/**
 * Calculate and format retransmission rate as percentage
 */
export function calculateRetransmissionRate(
  retransmitted: number,
  total: number
): number {
  if (total === 0) return 0;
  return (retransmitted / total) * 100;
}
