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
      } catch (e) {}
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
          
          {/* View/Sections Dropdown */}
          <div className="view-menu-container" ref={viewMenuRef} style={{ position: 'relative' }}>
            <button 
              className="btn-action" 
              onClick={() => setIsViewMenuOpen(!isViewMenuOpen)} 
              title="Toggle Sections"
            >
              👁️
            </button>
            {isViewMenuOpen && (
              <div className="view-dropdown">
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
        <div className="admin-warning">
          <span className="icon">⚠️</span>
          <span>
            Run as Administrator to view extended TCP statistics (RTT, Retransmissions, Congestion Control).
          </span>
        </div>
      )}

      <div className="stats-content">
        {/* Basic Stats (Always Available) */}
        {visibleSections.has('data') && (
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
        )}

        {/* Extended Stats */}
        {hasExtended && ExtendedStats ? (
          <>
            {/* Charts Section */}
            {visibleSections.has('charts') && (
            <div className="stats-section charts-section">
              <h3>Live Performance</h3>

              {/* RTT Chart - Own Row */}
              <div className="chart-container" style={{ background: 'var(--color-bg-secondary)', borderRadius: '6px', padding: '10px', marginBottom: '1rem', height: '150px' }}>
                <div className="chart-title" style={{ fontSize: '0.8rem', color: 'var(--color-text-dim)', marginBottom: '5px' }}>RTT History (ms)</div>
                <div style={{ width: '100%', height: '85%' }}>
                  <Line data={chartData.rtt} options={chartOptions} />
                </div>
              </div>

              {/* Bandwidth Chart - Own Row */}
              <div className="chart-container" style={{ background: 'var(--color-bg-secondary)', borderRadius: '6px', padding: '10px', height: '150px' }}>
                <div className="chart-title" style={{ fontSize: '0.8rem', color: 'var(--color-text-dim)', marginBottom: '5px' }}>Bandwidth (bps)</div>
                <div style={{ width: '100%', height: '85%' }}>
                  <Line data={chartData.bandwidth} options={chartOptions} />
                </div>
              </div>
            </div>
            )}

            {visibleSections.has('retrans') && (
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
            )}

            {visibleSections.has('rtt') && (
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
            )}

            {visibleSections.has('congestion') && (
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
            )}

            {visibleSections.has('bandwidth') && (
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
            )}

            {visibleSections.has('window') && (
            <Section title="Window & Scaling">
              <StatItem
                label="Send Window Scale"
                value={ExtendedStats.WinScaleSent?.toString() || '0'}
              />
              <StatItem
                label="Rcv Window Scale"
                value={ExtendedStats.WinScaleRcvd?.toString() || '0'}
              />
              <StatItem
                label="Current Send Window"
                value={formatBytes(ExtendedStats.CurRwinSent).formatted}
              />
               <StatItem
                label="Max Send Window"
                value={formatBytes(ExtendedStats.MaxRwinSent).formatted}
              />
               <StatItem
                label="Current Rcv Window"
                value={formatBytes(ExtendedStats.CurRwinRcvd).formatted}
              />
               <StatItem
                label="Max Rcv Window"
                value={formatBytes(ExtendedStats.MaxRwinRcvd).formatted}
              />
            </Section>
            )}

            {visibleSections.has('segments') && (
            <Section title="Segment Info & MSS">
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
             <Section title="Duplicate ACKs & SACKs">
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
