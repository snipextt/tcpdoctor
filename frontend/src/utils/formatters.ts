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
 * Format bandwidth (bytes per second) with appropriate units
 */
export function formatBandwidth(bytesPerSecond: number): FormattedValue {
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const k = 1024;

  if (bytesPerSecond === 0) {
    return { value: 0, unit: 'B/s', formatted: '0 B/s' };
  }

  const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));
  const value = bytesPerSecond / Math.pow(k, i);
  const unit = units[i];

  return {
    value,
    unit,
    formatted: `${value.toFixed(2)} ${unit}`,
  };
}

/**
 * Format a count with thousands separators
 */
export function formatCount(count: number): string {
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
 * Format RTT (Round Trip Time) in microseconds to milliseconds
 */
export function formatRTT(microseconds: number): FormattedValue {
  const ms = microseconds / 1000;
  return {
    value: ms,
    unit: 'ms',
    formatted: `${ms.toFixed(2)} ms`,
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
