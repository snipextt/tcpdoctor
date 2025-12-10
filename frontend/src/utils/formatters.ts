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
 * Format bandwidth (bits per second) with appropriate units
 * Windows API returns bandwidth in bits per second
 */
export function formatBandwidth(bitsPerSecond: number | undefined | null): FormattedValue {
  // Sanity check: if null, undefined, NaN, negative, or unreasonably high (> 100 Gbps), treat as unavailable
  // Windows API sometimes returns garbage values for bandwidth estimates
  const MAX_REASONABLE_BPS = 100_000_000_000; // 100 Gbps - max reasonable for typical connections

  if (bitsPerSecond === null || bitsPerSecond === undefined || isNaN(bitsPerSecond) ||
    bitsPerSecond <= 0 || bitsPerSecond > MAX_REASONABLE_BPS) {
    return { value: 0, unit: 'bps', formatted: 'N/A' };
  }

  const units = ['bps', 'Kbps', 'Mbps', 'Gbps'];
  const k = 1000; // Use 1000 for bits (standard network convention)

  const i = Math.min(Math.floor(Math.log(bitsPerSecond) / Math.log(k)), units.length - 1);
  const value = bitsPerSecond / Math.pow(k, i);
  const unit = units[i] || 'bps';

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
