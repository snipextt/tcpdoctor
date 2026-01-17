//go:build windows
// +build windows

package tcpmonitor

import (
	"context"
	"fmt"
	"math"
	"sort"
	"time"

	"tcpdoctor/internal/llm"
)

// =====================================================
// Temporal Analysis Helpers for Session Intelligence
// =====================================================

// detectTrend analyzes a time series and classifies the trend
func (s *Service) detectTrend(values []float64) string {
	if len(values) < 10 {
		return "insufficient_data"
	}

	// Compare first third to last third
	n := len(values)
	firstThird := avgFloat64(values[:n/3])
	lastThird := avgFloat64(values[n*2/3:])

	change := (lastThird - firstThird) / firstThird
	cv := stdDevFloat64(values) / avgFloat64(values) // Coefficient of variation

	if cv > 0.5 {
		return "volatile"
	}
	if change > 0.2 {
		return "increasing"
	}
	if change < -0.2 {
		return "decreasing"
	}
	return "stable"
}

// detectTrendUint64 detects trend for uint64 values
func (s *Service) detectTrendUint64(values []uint64) string {
	floats := make([]float64, len(values))
	for i, v := range values {
		floats[i] = float64(v)
	}
	return s.detectTrend(floats)
}

// detectTrendInt64 detects trend for int64 values
func (s *Service) detectTrendInt64(values []int64) string {
	floats := make([]float64, len(values))
	for i, v := range values {
		floats[i] = float64(v)
	}
	return s.detectTrend(floats)
}

// classifyVariability classifies RTT variability based on coefficient of variation
func (s *Service) classifyVariability(stdDev, mean float64) string {
	if mean == 0 {
		return "unknown"
	}
	cv := stdDev / mean
	if cv > 0.5 {
		return "high"
	}
	if cv > 0.2 {
		return "medium"
	}
	return "low"
}

// classifySeverity determines severity based on metric type and value
func (s *Service) classifySeverity(metric string, value float64) string {
	switch metric {
	case "avg_rtt":
		if value > 150 {
			return "high"
		}
		if value > 50 {
			return "medium"
		}
		return "low"
	case "retrans_rate":
		if value > 5.0 {
			return "high"
		}
		if value > 1.0 {
			return "medium"
		}
		return "low"
	case "rtt_variance":
		if value > 50 {
			return "high"
		}
		if value > 20 {
			return "medium"
		}
		return "low"
	default:
		return "medium"
	}
}

// detectSpikes detects values that spike above average
func (s *Service) detectSpikes(values []float64, timestamps []time.Time, metric string, threshold float64) []llm.TemporalEvent {
	if len(values) == 0 {
		return nil
	}

	avgValue := avgFloat64(values)
	var events []llm.TemporalEvent

	for i, value := range values {
		if value > avgValue*threshold {
			severity := "medium"
			if value > avgValue*3.0 {
				severity = "high"
			}

			events = append(events, llm.TemporalEvent{
				Timestamp: timestamps[i],
				Metric:    metric,
				EventType: "spike",
				Value:     value,
				Severity:  severity,
			})
		}
	}

	return events
}

// detectDrops detects values that drop below average
func (s *Service) detectDrops(values []float64, timestamps []time.Time, metric string, threshold float64) []llm.TemporalEvent {
	if len(values) == 0 {
		return nil
	}

	avgValue := avgFloat64(values)
	var events []llm.TemporalEvent

	for i, value := range values {
		if value < avgValue*threshold && avgValue > 0 {
			severity := "medium"
			if value < avgValue*0.3 {
				severity = "high"
			}

			events = append(events, llm.TemporalEvent{
				Timestamp: timestamps[i],
				Metric:    metric,
				EventType: "drop",
				Value:     value,
				Severity:  severity,
			})
		}
	}

	return events
}

// =====================================================
// Statistical Helper Functions
// =====================================================

func avgFloat64(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	sum := 0.0
	for _, v := range values {
		sum += v
	}
	return sum / float64(len(values))
}

func avgUint64(values []uint64) uint64 {
	if len(values) == 0 {
		return 0
	}
	sum := uint64(0)
	for _, v := range values {
		sum += v
	}
	return sum / uint64(len(values))
}

func avgInt64(values []int64) int64 {
	if len(values) == 0 {
		return 0
	}
	sum := int64(0)
	for _, v := range values {
		sum += v
	}
	return sum / int64(len(values))
}

func minFloat64(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	min := values[0]
	for _, v := range values {
		if v < min {
			min = v
		}
	}
	return min
}

func maxFloat64(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	max := values[0]
	for _, v := range values {
		if v > max {
			max = v
		}
	}
	return max
}

func minUint64(values []uint64) uint64 {
	if len(values) == 0 {
		return 0
	}
	min := values[0]
	for _, v := range values {
		if v < min {
			min = v
		}
	}
	return min
}

func maxUint64(values []uint64) uint64 {
	if len(values) == 0 {
		return 0
	}
	max := values[0]
	for _, v := range values {
		if v > max {
			max = v
		}
	}
	return max
}

func stdDevFloat64(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	mean := avgFloat64(values)
	variance := 0.0
	for _, v := range values {
		diff := v - mean
		variance += diff * diff
	}
	variance /= float64(len(values))
	return math.Sqrt(variance)
}

// rankConnectionsByMetric ranks connections by a specific metric
func (s *Service) rankConnectionsByMetric(conns []SessionConnectionSummary, metric string, limit int) []llm.ConnectionRanking {
	rankings := make([]llm.ConnectionRanking, 0, len(conns))

	for _, conn := range conns {
		var score float64
		switch metric {
		case "avg_rtt":
			score = conn.AvgRTT
		case "retrans_rate":
			if conn.TotalSegmentsOut > 0 {
				score = float64(conn.TotalRetransmissions) / float64(conn.TotalSegmentsOut) * 100
			}
		case "rtt_variance":
			score = conn.StdDevRTT
		}

		rankings = append(rankings, llm.ConnectionRanking{
			LocalAddr:  conn.LocalAddr,
			RemoteAddr: conn.RemoteAddr,
			LocalPort:  conn.LocalPort,
			RemotePort: conn.RemotePort,
			Score:      score,
			Severity:   s.classifySeverity(metric, score),
		})
	}

	// Sort descending
	sort.Slice(rankings, func(i, j int) bool {
		return rankings[i].Score > rankings[j].Score
	})

	if len(rankings) > limit {
		rankings = rankings[:limit]
	}

	return rankings
}

// extractMajorEvents identifies significant events affecting multiple connections
func (s *Service) extractMajorEvents(conns []SessionConnectionSummary) []llm.MajorEvent {
	var events []llm.MajorEvent

	// Group events by time window (1 minute)
	eventMap := make(map[time.Time][]llm.TemporalEvent)
	for _, conn := range conns {
		for _, event := range conn.Events {
			window := event.Timestamp.Truncate(1 * time.Minute)
			eventMap[window] = append(eventMap[window], event)
		}
	}

	// Identify windows with multiple high-severity events
	for window, evts := range eventMap {
		highSevCount := 0
		for _, evt := range evts {
			if evt.Severity == "high" {
				highSevCount++
			}
		}

		// Major event = 3+ connections affected simultaneously
		if len(evts) >= 3 || highSevCount >= 2 {
			eventType := "mass_degradation"
			if evts[0].EventType == "burst" {
				eventType = "retransmission_storm"
			}

			events = append(events, llm.MajorEvent{
				Timestamp:   window,
				Type:        eventType,
				Description: fmt.Sprintf("%d connections experienced %s issues", len(evts), evts[0].Metric),
				Affected:    len(evts),
				Severity:    "high",
			})
		}
	}

	// Sort by timestamp
	sort.Slice(events, func(i, j int) bool {
		return events[i].Timestamp.Before(events[j].Timestamp)
	})

	return events
}

// SessionConnectionSummary extends ConnectionSummary with temporal analysis
type SessionConnectionSummary struct {
	llm.ConnectionSummary

	// Timeline
	FirstSeen time.Time `json:"firstSeen"`
	LastSeen  time.Time `json:"lastSeen"`
	Duration  float64   `json:"duration"` // seconds

	// Aggregated values
	AvgRTT          float64 `json:"avgRtt"`
	StdDevRTT       float64 `json:"stdDevRtt"`
	AvgBandwidthIn  uint64  `json:"avgBandwidthIn"`
	AvgBandwidthOut uint64  `json:"avgBandwidthOut"`

	// Temporal analysis
	RTTTrend         string                  `json:"rttTrend"`
	RTTVariability   string                  `json:"rttVariability"`
	BandwidthTrend   string                  `json:"bandwidthTrend"`
	Events           []llm.TemporalEvent     `json:"events,omitempty"`
	StateTransitions []llm.StateTransition   `json:"stateTransitions,omitempty"`
	Periods          []llm.PerformancePeriod `json:"periods,omitempty"`

	// Totals
	TotalRetransmissions int64 `json:"totalRetransmissions"`
	TotalSegmentsOut     int64 `json:"totalSegmentsOut"`
}

// =====================================================
// Session Aggregation & Preprocessing
// =====================================================

// GenerateSessionHighlights creates preprocessed session analysis
func (s *Service) GenerateSessionHighlights(sessionID int64) (*llm.SessionHighlights, error) {
	timeline := s.snapshotStore.GetSessionTimeline(sessionID)
	if len(timeline) == 0 {
		return nil, fmt.Errorf("session not found or empty")
	}

	// Aggregate all connections
	aggregated := s.aggregateSessionConnections(timeline)

	// Get timestamps
	firstTime := timeline[0].Timestamp
	lastTime := timeline[len(timeline)-1].Timestamp

	highlights := &llm.SessionHighlights{
		SessionID:         sessionID,
		Duration:          lastTime.Sub(firstTime).Seconds(),
		TotalSnapshots:    len(timeline),
		UniqueConnections: len(aggregated),
	}

	// Rank connections by different metrics
	highlights.WorstRTTConnections = s.rankConnectionsByMetric(aggregated, "avg_rtt", 10)
	highlights.HighestRetransConnections = s.rankConnectionsByMetric(aggregated, "retrans_rate", 10)
	highlights.MostVolatileConnections = s.rankConnectionsByMetric(aggregated, "rtt_variance", 10)

	// Extract major events
	highlights.MajorEvents = s.extractMajorEvents(aggregated)

	// Compute overall health
	highlights.OverallHealth, highlights.HealthScore = s.computeSessionHealth(aggregated)
	highlights.PrimaryIssues = s.identifyPrimaryIssues(aggregated)

	// Count anomalies
	for _, conn := range aggregated {
		highlights.AnomalyCount += len(conn.Events)
		highlights.DegradationPeriods += len(conn.Periods)
	}

	// Find worst/best performance times
	highlights.TimeOfWorstPerformance, highlights.TimeOfBestPerformance = s.findPerformanceExtremes(aggregated)

	return highlights, nil
}

// aggregateSessionConnections groups snapshots by connection and aggregates metrics
func (s *Service) aggregateSessionConnections(timeline []TimelineConnection) []SessionConnectionSummary {
	// Group by connection key
	connMap := make(map[string][]TimelineConnection)
	for _, tc := range timeline {
		key := fmt.Sprintf("%s:%d->%s:%d",
			tc.Connection.LocalAddr, tc.Connection.LocalPort,
			tc.Connection.RemoteAddr, tc.Connection.RemotePort)
		connMap[key] = append(connMap[key], tc)
	}

	// Aggregate each connection
	summaries := make([]SessionConnectionSummary, 0, len(connMap))
	for _, snapshots := range connMap {
		if len(snapshots) > 0 {
			summary := s.buildSessionConnectionSummary(snapshots)
			summaries = append(summaries, summary)
		}
	}

	return summaries
}

// buildSessionConnectionSummary aggregates multiple snapshots for one connection
func (s *Service) buildSessionConnectionSummary(snapshots []TimelineConnection) SessionConnectionSummary {
	first := snapshots[0]
	last := snapshots[len(snapshots)-1]

	// Extract time series data
	n := len(snapshots)
	rtts := make([]float64, n)
	bwIns := make([]int64, n)
	bwOuts := make([]int64, n)
	timestamps := make([]time.Time, n)

	for i, snap := range snapshots {
		rtts[i] = float64(snap.Connection.RTT)
		bwIns[i] = snap.Connection.InBandwidth
		bwOuts[i] = snap.Connection.OutBandwidth
		timestamps[i] = snap.Timestamp
	}

	// Build base summary from last snapshot
	summary := SessionConnectionSummary{
		ConnectionSummary: llm.ConnectionSummary{
			LocalAddr:            last.Connection.LocalAddr,
			LocalPort:            uint16(last.Connection.LocalPort),
			RemoteAddr:           last.Connection.RemoteAddr,
			RemotePort:           uint16(last.Connection.RemotePort),
			State:                TCPState(last.Connection.State).String(),
			BytesIn:              uint64(last.Connection.BytesIn),
			BytesOut:             uint64(last.Connection.BytesOut),
			RTTMs:                float64(last.Connection.RTT),
			InboundBandwidthBps:  uint64(last.Connection.InBandwidth),
			OutboundBandwidthBps: uint64(last.Connection.OutBandwidth),
			CongestionWindow:     uint64(last.Connection.CongestionWin),
			SlowStartThreshold:   uint64(last.Connection.CurrentSsthresh),
			FastRetransmissions:  uint64(last.Connection.FastRetrans),
			TimeoutEpisodes:      uint64(last.Connection.TimeoutEpisodes),
			TotalSegmentsOut:     uint64(last.Connection.TotalSegsOut),
			CurrentMSS:           uint64(last.Connection.CurMss),
			MinRTTMs:             minFloat64(rtts),
			MaxRTTMs:             maxFloat64(rtts),
		},
		FirstSeen:            first.Timestamp,
		LastSeen:             last.Timestamp,
		Duration:             last.Timestamp.Sub(first.Timestamp).Seconds(),
		AvgRTT:               avgFloat64(rtts),
		StdDevRTT:            stdDevFloat64(rtts),
		AvgBandwidthIn:       uint64(avgInt64(bwIns)),
		AvgBandwidthOut:      uint64(avgInt64(bwOuts)),
		TotalRetransmissions: last.Connection.Retrans,
		TotalSegmentsOut:     last.Connection.TotalSegsOut,
	}

	// Temporal analysis
	summary.RTTTrend = s.detectTrend(rtts)
	summary.RTTVariability = s.classifyVariability(summary.StdDevRTT, summary.AvgRTT)
	summary.BandwidthTrend = s.detectTrendInt64(bwIns)

	// Detect events
	summary.Events = append(summary.Events, s.detectSpikes(rtts, timestamps, "rtt", 2.0)...)
	summary.Events = append(summary.Events, s.detectDrops(rtts, timestamps, "rtt", 0.5)...)

	// Detect retransmission bursts
	for i := 1; i < len(snapshots); i++ {
		delta := snapshots[i].Connection.Retrans - snapshots[i-1].Connection.Retrans
		if delta > 10 {
			severity := "medium"
			if delta > 50 {
				severity = "high"
			}
			summary.Events = append(summary.Events, llm.TemporalEvent{
				Timestamp: snapshots[i].Timestamp,
				Metric:    "retransmissions",
				EventType: "burst",
				Value:     delta,
				Severity:  severity,
			})
		}
	}

	// Detect state transitions
	for i := 1; i < len(snapshots); i++ {
		if snapshots[i].Connection.State != snapshots[i-1].Connection.State {
			summary.StateTransitions = append(summary.StateTransitions, llm.StateTransition{
				Timestamp: snapshots[i].Timestamp,
				FromState: TCPState(snapshots[i-1].Connection.State).String(),
				ToState:   TCPState(snapshots[i].Connection.State).String(),
			})
		}
	}

	return summary
}

// computeSessionHealth calculates overall health score
func (s *Service) computeSessionHealth(conns []SessionConnectionSummary) (string, int) {
	if len(conns) == 0 {
		return "unknown", 0
	}

	totalScore := 0
	for _, conn := range conns {
		connScore := 100

		// Penalize high RTT
		if conn.AvgRTT > 150 {
			connScore -= 30
		} else if conn.AvgRTT > 50 {
			connScore -= 15
		}

		// Penalize high variability
		if conn.RTTVariability == "high" {
			connScore -= 20
		} else if conn.RTTVariability == "medium" {
			connScore -= 10
		}

		// Penalize retransmissions
		if conn.TotalSegmentsOut > 0 {
			retransRate := float64(conn.TotalRetransmissions) / float64(conn.TotalSegmentsOut) * 100
			if retransRate > 5 {
				connScore -= 30
			} else if retransRate > 1 {
				connScore -= 15
			}
		}

		// Penalize events
		highSevEvents := 0
		for _, evt := range conn.Events {
			if evt.Severity == "high" {
				highSevEvents++
			}
		}
		connScore -= highSevEvents * 5

		if connScore < 0 {
			connScore = 0
		}
		totalScore += connScore
	}

	avgScore := totalScore / len(conns)

	health := "healthy"
	if avgScore < 50 {
		health = "critical"
	} else if avgScore < 75 {
		health = "degraded"
	}

	return health, avgScore
}

// identifyPrimaryIssues extracts main problems from session
func (s *Service) identifyPrimaryIssues(conns []SessionConnectionSummary) []string {
	var issues []string

	highRTTCount := 0
	highRetransCount := 0
	volatileCount := 0

	for _, conn := range conns {
		if conn.AvgRTT > 100 {
			highRTTCount++
		}
		if conn.TotalSegmentsOut > 0 {
			rate := float64(conn.TotalRetransmissions) / float64(conn.TotalSegmentsOut) * 100
			if rate > 2 {
				highRetransCount++
			}
		}
		if conn.RTTVariability == "high" {
			volatileCount++
		}
	}

	if highRTTCount > 0 {
		issues = append(issues, fmt.Sprintf("High RTT on %d connections (>100ms)", highRTTCount))
	}
	if highRetransCount > 0 {
		issues = append(issues, fmt.Sprintf("High retransmission rate on %d connections (>2%%)", highRetransCount))
	}
	if volatileCount > 0 {
		issues = append(issues, fmt.Sprintf("Volatile latency on %d connections", volatileCount))
	}

	return issues
}

// findPerformanceExtremes finds times of worst and best performance
func (s *Service) findPerformanceExtremes(conns []SessionConnectionSummary) (worst, best time.Time) {
	worstRTT := 0.0
	bestRTT := math.MaxFloat64

	for _, conn := range conns {
		for _, evt := range conn.Events {
			if evt.Metric == "rtt" && evt.EventType == "spike" {
				if val, ok := evt.Value.(float64); ok && val > worstRTT {
					worstRTT = val
					worst = evt.Timestamp
				}
			}
		}
		if conn.MinRTTMs < bestRTT && conn.MinRTTMs > 0 {
			bestRTT = conn.MinRTTMs
			best = conn.FirstSeen
		}
	}

	return worst, best
}

// =====================================================
// Session Query Methods
// =====================================================

// QueryConnectionsForSession queries AI about session data
func (s *Service) QueryConnectionsForSession(query string, sessionID int64) (*llm.QueryResult, error) {
	s.logger.Debug("LLM Session Query: %s (session %d)", query, sessionID)

	// Generate highlights for context
	highlights, err := s.GenerateSessionHighlights(sessionID)
	if err != nil {
		return nil, err
	}

	// Get timeline and aggregate
	timeline := s.snapshotStore.GetSessionTimeline(sessionID)
	aggregated := s.aggregateSessionConnections(timeline)

	// Convert to ConnectionSummary for LLM
	summaries := make([]llm.ConnectionSummary, len(aggregated))
	for i, agg := range aggregated {
		summaries[i] = agg.ConnectionSummary
	}

	// Build enriched query with session context
	enrichedQuery := fmt.Sprintf(`SESSION ANALYSIS CONTEXT:
Session ID: %d | Duration: %.1f min | Connections: %d | Health: %s (%d/100)

TOP ISSUES: %s

WORST CONNECTIONS (by RTT):
%s

MAJOR EVENTS:
%s

USER QUESTION: %s`,
		highlights.SessionID,
		highlights.Duration/60,
		highlights.UniqueConnections,
		highlights.OverallHealth,
		highlights.HealthScore,
		formatIssues(highlights.PrimaryIssues),
		formatRankings(highlights.WorstRTTConnections),
		formatMajorEvents(highlights.MajorEvents),
		query,
	)

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	return s.llmService.QueryConnections(ctx, enrichedQuery, summaries)
}

// GenerateHealthReportForSession generates AI health report for session
func (s *Service) GenerateHealthReportForSession(sessionID int64) (*llm.HealthReport, error) {
	s.logger.Info("Generating AI health report for session %d", sessionID)

	timeline := s.snapshotStore.GetSessionTimeline(sessionID)
	aggregated := s.aggregateSessionConnections(timeline)

	// Convert to ConnectionSummary
	summaries := make([]llm.ConnectionSummary, len(aggregated))
	for i, agg := range aggregated {
		summaries[i] = agg.ConnectionSummary
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	return s.llmService.GenerateHealthReport(ctx, summaries)
}

// GetSnapshotsByTimeRange returns aggregated data for a time range
func (s *Service) GetSnapshotsByTimeRange(sessionID int64, startTime, endTime time.Time, filter *llm.ConnectionFilter) ([]SessionConnectionSummary, error) {
	timeline := s.snapshotStore.GetSessionTimeline(sessionID)

	// Filter by time range
	var filtered []TimelineConnection
	for _, tc := range timeline {
		if (tc.Timestamp.Equal(startTime) || tc.Timestamp.After(startTime)) &&
			(tc.Timestamp.Equal(endTime) || tc.Timestamp.Before(endTime)) {

			// Apply connection filter if provided
			if filter != nil {
				if filter.LocalAddr != nil && tc.Connection.LocalAddr != *filter.LocalAddr {
					continue
				}
				if filter.RemoteAddr != nil && tc.Connection.RemoteAddr != *filter.RemoteAddr {
					continue
				}
			}

			filtered = append(filtered, tc)
		}
	}

	return s.aggregateSessionConnections(filtered), nil
}

// Helper formatters
func formatIssues(issues []string) string {
	if len(issues) == 0 {
		return "None"
	}
	result := ""
	for _, issue := range issues {
		result += "• " + issue + "\n"
	}
	return result
}

func formatRankings(rankings []llm.ConnectionRanking) string {
	if len(rankings) == 0 {
		return "No data"
	}
	result := ""
	for i, r := range rankings {
		if i >= 5 {
			break
		}
		result += fmt.Sprintf("%d. %s:%d → %s:%d (%.1f, %s)\n",
			i+1, r.LocalAddr, r.LocalPort, r.RemoteAddr, r.RemotePort, r.Score, r.Severity)
	}
	return result
}

func formatMajorEvents(events []llm.MajorEvent) string {
	if len(events) == 0 {
		return "None detected"
	}
	result := ""
	for _, e := range events {
		result += fmt.Sprintf("• %s: %s (%d affected, %s)\n",
			e.Timestamp.Format("15:04:05"), e.Description, e.Affected, e.Severity)
	}
	return result
}
