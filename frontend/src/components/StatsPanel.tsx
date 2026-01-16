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
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartOptions
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import './StatsPanel.css';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface TimeSeriesData {
  time: number;
  rtt?: number;
  bwIn?: number;
  bwOut?: number;
}

const ALL_SECTIONS = [
  { id: 'charts', label: 'Live Performance Charts' },
  { id: 'data', label: 'Data Transfer' },
  { id: 'retrans', label: 'Retransmissions' },
  { id: 'rtt', label: 'Round Trip Time (RTT)' },
  { id: 'congestion', label: 'Congestion Control' },
  { id: 'bandwidth', label: 'Bandwidth & Throughput' },
  { id: 'window', label: 'Window & Scaling' },
  { id: 'segments', label: 'Segment Info & MSS' },
  { id: 'dups', label: 'Duplicate ACKs & SACKs' },
];

const StatsPanel: React.FC<StatsPanelProps> = ({
  connection,
  isAdmin,
  onDiagnose,
  isAIConfigured = false,
  onConfigureAPI,
  onViewHistory,
  hasHistory = false,
  initialHistory,
}) => {
  const [history, setHistory] = useState<TimeSeriesData[]>([]);

  // View options state
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const viewMenuRef = React.useRef<HTMLDivElement>(null);
  const [visibleSections, setVisibleSections] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('stats_visible_sections');
    if (saved) {
      try {
        return new Set(JSON.parse(saved));
      } catch (e) { }
    }
    return new Set(ALL_SECTIONS.map(s => s.id));
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (viewMenuRef.current && !viewMenuRef.current.contains(event.target as Node)) {
        setIsViewMenuOpen(false);
      }
    };
    if (isViewMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isViewMenuOpen]);

  const toggleSection = (id: string) => {
    const newSet = new Set(visibleSections);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setVisibleSections(newSet);
    localStorage.setItem('stats_visible_sections', JSON.stringify(Array.from(newSet)));
  };

  // Connection key to detect selection changes
  const connectionKey = connection
    ? `${connection.LocalAddr}:${connection.LocalPort}-${connection.RemoteAddr}:${connection.RemotePort}`
    : '';

  useEffect(() => {
    if (initialHistory && initialHistory.length > 0) {
      setHistory(initialHistory);
    } else {
      setHistory([]);
    }
  }, [connectionKey, initialHistory]);

  useEffect(() => {
    if (initialHistory && initialHistory.length > 0) return;
    if (!connection || !connection.ExtendedStats) return;

    const now = Date.now();
    const newPoint: TimeSeriesData = {
      time: now,
      rtt: connection.ExtendedStats.SmoothedRTT,
      bwIn: connection.ExtendedStats.InboundBandwidth,
      bwOut: connection.ExtendedStats.OutboundBandwidth,
    };

    setHistory(prev => {
      const newHistory = [...prev, newPoint];
      if (newHistory.length > 60) return newHistory.slice(newHistory.length - 60);
      return newHistory;
    });
  }, [connection, initialHistory]);

  // Chart Data Preparation
  const chartData = useMemo(() => {
    const labels = history.map(d => ''); // Empty labels for cleaner look or timestamp if needed
    return {
      rtt: {
        labels,
        datasets: [
          {
            label: 'RTT (ms)',
            data: history.map(d => d.rtt),
            borderColor: '#8884d8',
            backgroundColor: 'rgba(136, 132, 216, 0.1)',
            tension: 0.4,
            pointRadius: 0,
            borderWidth: 2,
            fill: true,
          }
        ]
      },
      bandwidth: {
        labels,
        datasets: [
          {
            label: 'Inbound',
            data: history.map(d => d.bwIn),
            borderColor: '#82ca9d',
            backgroundColor: 'rgba(130, 202, 157, 0.2)',
            tension: 0.4,
            pointRadius: 0,
            borderWidth: 1.5,
            fill: true,
          },
          {
            label: 'Outbound',
            data: history.map(d => d.bwOut),
            borderColor: '#ffc658',
            backgroundColor: 'rgba(255, 198, 88, 0.2)',
            tension: 0.4,
            pointRadius: 0,
            borderWidth: 1.5,
            fill: true,
          }
        ]
      }
    };
  }, [history]);

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: 'index',
        intersect: false,
      }
    },
    scales: {
      x: { display: false },
      y: {
        display: true,
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: {
          color: '#6c757d',
          font: { size: 9 }
        }
      }
    }
  };

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

  const Section = ({ title, icon, children, delay }: { title: string, icon?: string, children: React.ReactNode, delay?: string }) => (
    <div className="stats-section" style={{ animationDelay: delay }}>
      <h3>{icon && <span className="section-icon">{icon}</span>}{title}</h3>
      {children}
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

        {/* Quick Actions */}
        <div className="header-actions">
          {onViewHistory && hasHistory && (
            <button className="btn-action" onClick={onViewHistory} title="View History">
              📈
            </button>
          )}

          <div className="view-menu-container" ref={viewMenuRef} style={{ position: 'relative' }}>
            <button
              className="btn-action"
              onClick={() => setIsViewMenuOpen(!isViewMenuOpen)}
              title="Customize View"
            >
              👁️
            </button>
            {isViewMenuOpen && (
              <div className="view-dropdown animate-fade">
                <div className="dropdown-header">Visible Sections</div>
                {ALL_SECTIONS.map(section => (
                  <label key={section.id} className="view-option">
                    <input
                      type="checkbox"
                      checked={visibleSections.has(section.id)}
                      onChange={() => toggleSection(section.id)}
                    />
                    {section.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Admin Warning */}
      {!isAdmin && (
        <div className="admin-warning animate-fade">
          <span className="icon">⚠️</span>
          <span>
            Elevated privileges required for extended TCP metrics (RTT, Retransmissions, Congestion Control).
          </span>
        </div>
      )}

      <div className="stats-content">
        {/* Charts Section */}
        {hasExtended && ExtendedStats && visibleSections.has('charts') && (
          <div className="stats-section charts-section" style={{ animationDelay: '0.05s' }}>
            <div className="chart-wrapper">
              <h3><span className="section-icon">📈</span>RTT History (ms)</h3>
              <div className="chart-container">
                <Line data={chartData.rtt} options={chartOptions} />
              </div>
            </div>
            <div className="chart-wrapper">
              <h3><span className="section-icon">📊</span>Throughput (bps)</h3>
              <div className="chart-container">
                <Line data={chartData.bandwidth} options={chartOptions} />
              </div>
            </div>
          </div>
        )}

        {visibleSections.has('data') && (
          <Section title="Data Transfer" icon="💾" delay="0.1s">
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
        )}

        {hasExtended && ExtendedStats ? (
          <>
            {visibleSections.has('retrans') && (
              <Section title="Retransmissions" icon="🔄" delay="0.15s">
                <StatItem
                  label="Retrans Segments"
                  value={formatCount(ExtendedStats.SegsRetrans)}
                  subValue={ExtendedStats.TotalSegsOut > 0
                    ? `${((ExtendedStats.SegsRetrans / ExtendedStats.TotalSegsOut) * 100).toFixed(2)}% loss`
                    : '0% loss'}
                />
                <StatItem
                  label="Retrans Bytes"
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
            )}

            {visibleSections.has('rtt') && (
              <Section title="Performance (RTT)" icon="⏱️" delay="0.2s">
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
            )}

            {visibleSections.has('congestion') && (
              <Section title="Congestion Control" icon="🚦" delay="0.25s">
                <StatItem
                  label="CWND"
                  value={formatCount(ExtendedStats.CurrentCwnd)}
                  subValue="Bytes"
                />
                <StatItem
                  label="SSTHRESH"
                  value={formatCount(ExtendedStats.CurrentSsthresh)}
                  subValue="Bytes"
                />
                <StatItem
                  label="Slow Start"
                  value={formatCount(ExtendedStats.SlowStartCount)}
                />
                <StatItem
                  label="Avoidance"
                  value={formatCount(ExtendedStats.CongAvoidCount)}
                />
              </Section>
            )}

            {visibleSections.has('bandwidth') && (
              <Section title="Bandwidth" icon="⚡" delay="0.3s">
                <StatItem
                  label="Inbound BW"
                  value={formatBandwidth(ExtendedStats.InboundBandwidth).formatted}
                />
                <StatItem
                  label="Outbound BW"
                  value={formatBandwidth(ExtendedStats.OutboundBandwidth).formatted}
                />
                <StatItem
                  label="Thru Acked"
                  value={formatBytes(ExtendedStats.ThruBytesAcked).formatted}
                />
                <StatItem
                  label="Thru Rcvd"
                  value={formatBytes(ExtendedStats.ThruBytesReceived).formatted}
                />
              </Section>
            )}

            {visibleSections.has('window') && (
              <Section title="Window Scaling" icon="🪟" delay="0.35s">
                <StatItem
                  label="Snd Scale"
                  value={ExtendedStats.WinScaleSent?.toString() || '0'}
                />
                <StatItem
                  label="Rcv Scale"
                  value={ExtendedStats.WinScaleRcvd?.toString() || '0'}
                />
                <StatItem
                  label="Cur Snd Win"
                  value={formatBytes(ExtendedStats.CurRwinSent).formatted}
                />
                <StatItem
                  label="Cur Rcv Win"
                  value={formatBytes(ExtendedStats.CurRwinRcvd).formatted}
                />
              </Section>
            )}

            {visibleSections.has('segments') && (
              <Section title="Segment Info & MSS" icon="📦" delay="0.4s">
                <StatItem
                  label="Current MSS"
                  value={ExtendedStats.CurMss?.toString() || '-'}
                  subValue="Bytes"
                />
                <StatItem
                  label="Max MSS"
                  value={ExtendedStats.MaxMss?.toString() || '-'}
                  subValue="Bytes"
                />
                <StatItem
                  label="Min MSS"
                  value={ExtendedStats.MinMss?.toString() || '-'}
                  subValue="Bytes"
                />
              </Section>
            )}

            {visibleSections.has('dups') && (
              <Section title="Duplicate ACKs & SACKs" icon="🔂" delay="0.45s">
                <StatItem
                  label="Dup ACKs In"
                  value={formatCount(ExtendedStats.DupAcksIn)}
                />
                <StatItem
                  label="Dup ACKs Out"
                  value={formatCount(ExtendedStats.DupAcksOut)}
                />
                <StatItem
                  label="SACKs Rcvd"
                  value={formatCount(ExtendedStats.SacksRcvd)}
                />
                <StatItem
                  label="SACK Blocks Rcvd"
                  value={formatCount(ExtendedStats.SackBlocksRcvd)}
                />
                <StatItem
                  label="DSACK Dups"
                  value={formatCount(ExtendedStats.DsackDups)}
                />
              </Section>
            )}
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
