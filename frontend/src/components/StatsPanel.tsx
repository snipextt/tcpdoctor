import React, { useState, useEffect, useMemo } from 'react';
import { StatsPanelProps, TCPStateNames, TCPState } from '../types';
import {
  formatBytes,
  formatCount,
  formatRTT,
  formatBandwidth,
  formatEndpoint
} from '../utils/formatters';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

interface TimeSeriesData {
  time: number;
  rtt?: number;
  bwIn?: number;
  bwOut?: number;
}

const StatsPanel: React.FC<StatsPanelProps> = ({
  connection,
  isAdmin,
  onDiagnose,
  isAIConfigured = false,
  onConfigureAPI,
  onViewHistory,
  hasHistory = false,
}) => {
  const [history, setHistory] = useState<TimeSeriesData[]>([]);

  // Connection key to detect selection changes
  const connectionKey = connection
    ? `${connection.LocalAddr}:${connection.LocalPort}-${connection.RemoteAddr}:${connection.RemotePort}`
    : '';

  useEffect(() => {
    // Reset history when connection changes
    setHistory([]);
  }, [connectionKey]);

  useEffect(() => {
    if (!connection || !connection.ExtendedStats) return;

    const now = Date.now();
    const newPoint: TimeSeriesData = {
      time: now,
      rtt: connection.ExtendedStats.SmoothedRTT / 1000, // Convert to ms
      bwIn: connection.ExtendedStats.InboundBandwidth,
      bwOut: connection.ExtendedStats.OutboundBandwidth,
    };

    setHistory(prev => {
      const newHistory = [...prev, newPoint];
      // Keep last 60 points (seconds)
      if (newHistory.length > 60) return newHistory.slice(newHistory.length - 60);
      return newHistory;
    });
  }, [connection]); // Updates whenever connection data updates (polling)

  if (!connection) {
    return (
      <div className="stats-panel empty">
        <div className="empty-state-message">
          <h3>No Connection Selected</h3>
          <p>Select a connection from the table to view detailed statistics.</p>
        </div>
      </div>
    );
  }

  const { BasicStats, ExtendedStats } = connection;
  const hasExtended = !!ExtendedStats;

  const StatItem = ({ label, value, subValue }: { label: string, value: string, subValue?: string }) => (
    <div className="stat-item">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {subValue && <div className="stat-subvalue">{subValue}</div>}
    </div>
  );

  const Section = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <div className="stats-section">
      <h3>{title}</h3>
      <div className="stats-grid">
        {children}
      </div>
    </div>
  );

  return (
    <div className="stats-panel">
      {/* Header Info */}
      <div className="stats-header">
        <div className="connection-summary">
          <div className="endpoints">
            <span className="local">{formatEndpoint(connection.LocalAddr, connection.LocalPort)}</span>
            <span className="arrow">→</span>
            <span className="remote">{formatEndpoint(connection.RemoteAddr, connection.RemotePort)}</span>
          </div>
          <div className="meta-info">
            <span className="badge pid">PID: {connection.PID}</span>
            <span className="badge state" data-state={TCPStateNames[connection.State as TCPState]}>
              {TCPStateNames[connection.State as TCPState]}
            </span>
            {connection.HighRetransmissionWarning && (
              <span className="badge warning">High Retrans</span>
            )}
            {connection.HighRTTWarning && (
              <span className="badge warning">High RTT</span>
            )}
          </div>
        </div>

        {/* Quick Actions - inline buttons */}
        <div className="header-actions">
          {onViewHistory && hasHistory && (
            <button className="btn-action" onClick={onViewHistory} title="View History">
              📈
            </button>
          )}
          {onDiagnose && onConfigureAPI && (
            <button
              className={`btn-action ${!isAIConfigured ? 'setup' : ''}`}
              onClick={() => isAIConfigured ? null : onConfigureAPI()}
              title={isAIConfigured ? 'AI Configured' : 'Setup AI'}
            >
              {isAIConfigured ? '🤖' : '⚙️'}
            </button>
          )}
        </div>
      </div>

      {/* Admin Warning */}
      {!isAdmin && (
        <div className="admin-warning">
          <span className="icon">⚠️</span>
          <span>
            Run as Administrator to view extended TCP statistics (RTT, Retransmissions, Congestion Control).
          </span>
        </div>
      )}

      <div className="stats-content">
        {/* Basic Stats (Always Available) */}
        <Section title="Data Transfer">
          <StatItem
            label="Bytes In"
            value={BasicStats ? formatBytes(BasicStats.DataBytesIn).formatted : '—'}
          />
          <StatItem
            label="Bytes Out"
            value={BasicStats ? formatBytes(BasicStats.DataBytesOut).formatted : '—'}
          />
          <StatItem
            label="Segments In"
            value={BasicStats ? formatCount(BasicStats.DataSegsIn) : '—'}
          />
          <StatItem
            label="Segments Out"
            value={BasicStats ? formatCount(BasicStats.DataSegsOut) : '—'}
          />
        </Section>

        {/* Extended Stats */}
        {hasExtended && ExtendedStats ? (
          <>
            {/* Charts Section */}
            <div className="stats-section charts-section">
              <h3>Live Performance</h3>
              <div className="charts-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', height: '200px' }}>
                <div className="chart-container" style={{ background: 'var(--color-bg-secondary)', borderRadius: '6px', padding: '10px', display: 'flex', flexDirection: 'column' }}>
                  <div className="chart-title" style={{ fontSize: '0.8rem', color: 'var(--color-text-dim)', marginBottom: '5px' }}>RTT History (ms)</div>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={history}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                      <XAxis dataKey="time" hide />
                      <YAxis domain={['auto', 'auto']} style={{ fontSize: '10px' }} stroke="var(--color-text-dim)" />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
                        itemStyle={{ color: 'var(--color-text)' }}
                        formatter={(val: number) => [val.toFixed(2) + ' ms', 'RTT']}
                      />
                      <Line type="monotone" dataKey="rtt" stroke="#8884d8" strokeWidth={2} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="chart-container" style={{ background: 'var(--color-bg-secondary)', borderRadius: '6px', padding: '10px', display: 'flex', flexDirection: 'column' }}>
                  <div className="chart-title" style={{ fontSize: '0.8rem', color: 'var(--color-text-dim)', marginBottom: '5px' }}>Bandwidth (bps)</div>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                      <XAxis dataKey="time" hide />
                      <YAxis style={{ fontSize: '10px' }} stroke="var(--color-text-dim)" tickFormatter={(val) => val != null ? formatBandwidth(val).formatted : 'N/A'} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
                        itemStyle={{ color: 'var(--color-text)' }}
                        formatter={(val) => [typeof val === 'number' ? formatBandwidth(val).formatted : 'N/A', '']}
                      />
                      <Area type="monotone" dataKey="bwIn" stackId="1" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.3} name="In" isAnimationActive={false} />
                      <Area type="monotone" dataKey="bwOut" stackId="1" stroke="#ffc658" fill="#ffc658" fillOpacity={0.3} name="Out" isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <Section title="Retransmissions">
              <StatItem
                label="Segments Retransmitted"
                value={formatCount(ExtendedStats.SegsRetrans)}
                subValue={ExtendedStats.TotalSegsOut > 0
                  ? `${((ExtendedStats.SegsRetrans / ExtendedStats.TotalSegsOut) * 100).toFixed(2)}%`
                  : '0%'}
              />
              <StatItem
                label="Bytes Retransmitted"
                value={formatBytes(ExtendedStats.BytesRetrans).formatted}
              />
              <StatItem
                label="Fast Retransmits"
                value={formatCount(ExtendedStats.FastRetrans)}
              />
              <StatItem
                label="Timeouts"
                value={formatCount(ExtendedStats.TimeoutEpisodes)}
              />
            </Section>

            <Section title="Round Trip Time (RTT)">
              <StatItem
                label="Smoothed RTT"
                value={formatRTT(ExtendedStats.SmoothedRTT).formatted}
              />
              <StatItem
                label="RTT Variance"
                value={formatRTT(ExtendedStats.RTTVariance).formatted}
              />
              <StatItem
                label="Min RTT"
                value={formatRTT(ExtendedStats.MinRTT).formatted}
              />
              <StatItem
                label="Max RTT"
                value={formatRTT(ExtendedStats.MaxRTT).formatted}
              />
            </Section>

            <Section title="Congestion Control">
              <StatItem
                label="Congestion Window"
                value={formatCount(ExtendedStats.CurrentCwnd)}
                subValue="Bytes"
              />
              <StatItem
                label="Slow Start Threshold"
                value={formatCount(ExtendedStats.CurrentSsthresh)}
                subValue="Bytes"
              />
              <StatItem
                label="Slow Start Count"
                value={formatCount(ExtendedStats.SlowStartCount)}
                subValue="Transitions"
              />
              <StatItem
                label="Congestion Avoidance"
                value={formatCount(ExtendedStats.CongAvoidCount)}
                subValue="Transitions"
              />
            </Section>

            <Section title="Bandwidth & Throughput">
              <StatItem
                label="Inbound Bandwidth"
                value={formatBandwidth(ExtendedStats.InboundBandwidth).formatted}
              />
              <StatItem
                label="Outbound Bandwidth"
                value={formatBandwidth(ExtendedStats.OutboundBandwidth).formatted}
              />
              <StatItem
                label="Throughput Bytes Acked"
                value={formatBytes(ExtendedStats.ThruBytesAcked).formatted}
              />
              <StatItem
                label="Throughput Bytes Received"
                value={formatBytes(ExtendedStats.ThruBytesReceived).formatted}
              />
            </Section>
          </>
        ) : isAdmin ? (
          <div className="stats-message">
            <p>Extended statistics not available for this connection.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default StatsPanel;
