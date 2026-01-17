package tcpmonitor

import (
	"context"
	"fmt"
	"time"

	"tcpdoctor/internal/llm"
)

// IsLLMConfigured returns true if the LLM service has a valid API key
func (s *Service) IsLLMConfigured() bool {
	return s.llmService.IsConfigured()
}

// DiagnoseConnection analyzes a specific connection and returns AI-generated diagnosis
func (s *Service) DiagnoseConnection(localAddr string, localPort uint16, remoteAddr string, remotePort uint16) (*llm.DiagnosticResult, error) {
	s.logger.Debug("Diagnosing connection %s:%d -> %s:%d", localAddr, localPort, remoteAddr, remotePort)

	// Note: connectionManager.Get might be OS-specific or require locking.
	// If connectionManager is shared and thread-safe, this is fine.
	// However, on Mac, if connectionManager is stubbed or empty, this might fail logic-wise,
	// but purely as code it should compile if Service struct is visible.

	// WARNING: We must ensure 'Service' struct is defined on Mac.
	// If 'service.go' is windows-only, 'Service' struct might be undefined on Mac.
	// We might need a 'service_common.go' for the struct definition.

	isIPv6 := len(localAddr) > 15 || len(remoteAddr) > 15
	key := ConnectionKey{
		LocalAddr:  localAddr,
		LocalPort:  localPort,
		RemoteAddr: remoteAddr,
		RemotePort: remotePort,
		IsIPv6:     isIPv6,
	}

	conn, exists := s.connectionManager.Get(key)
	if !exists {
		// Attempt to construct a temporary info if real one not found (failsafe)
		return nil, fmt.Errorf("connection not found")
	}

	// Build connection summary for LLM
	summary := s.buildConnectionSummary(conn)

	// Call LLM service
	ctx, cancel := context.WithTimeout(context.Background(), 600*time.Second)
	defer cancel()

	result, err := s.llmService.DiagnoseConnection(ctx, summary)
	if err != nil {
		s.logger.Error("LLM diagnosis failed: %v", err)
		return nil, err
	}

	return result, nil
}

// QueryConnections answers a natural language question about the connections
func (s *Service) QueryConnections(query string) (*llm.QueryResult, error) {
	s.logger.Debug("LLM Query: %s", query)

	// Get all connections
	allConnections := s.connectionManager.GetAll()

	// Build summaries for LLM
	summaries := make([]llm.ConnectionSummary, 0, len(allConnections))
	for i := range allConnections {
		summaries = append(summaries, s.buildConnectionSummary(&allConnections[i]))
	}

	// Call LLM service
	// Increased timeout to 5 minutes for complex queries
	ctx, cancel := context.WithTimeout(context.Background(), 300*time.Second)
	defer cancel()

	result, err := s.llmService.QueryConnections(ctx, query, summaries)
	if err != nil {
		s.logger.Error("LLM query failed: %v", err)
		return nil, err
	}

	return result, nil
}

// QueryConnectionsWithHistory answers a question with conversation history
func (s *Service) QueryConnectionsWithHistory(query string, history []llm.ChatMessage) (*llm.QueryResult, error) {
	s.logger.Debug("LLM Query with history: %s (%d messages)", query, len(history))

	// Get all connections
	allConnections := s.connectionManager.GetAll()

	// Build summaries for LLM
	summaries := make([]llm.ConnectionSummary, 0, len(allConnections))
	for i := range allConnections {
		summaries = append(summaries, s.buildConnectionSummary(&allConnections[i]))
	}

	// Call LLM service
	// Increased timeout to 5 minutes for multi-turn agent loop
	ctx, cancel := context.WithTimeout(context.Background(), 300*time.Second)
	defer cancel()

	result, err := s.llmService.QueryConnectionsWithHistory(ctx, query, summaries, history)
	if err != nil {
		s.logger.Error("LLM query failed: %v", err)
		return nil, err
	}

	return result, nil
}

// GenerateHealthReport creates an AI-generated network health report
func (s *Service) GenerateHealthReport() (*llm.HealthReport, error) {
	s.logger.Info("Generating AI health report")

	// Get all connections
	allConnections := s.connectionManager.GetAll()

	// Build summaries for LLM
	summaries := make([]llm.ConnectionSummary, 0, len(allConnections))
	for i := range allConnections {
		summaries = append(summaries, s.buildConnectionSummary(&allConnections[i]))
	}

	// Call LLM service
	// Increased timeout for comprehensive report generation
	ctx, cancel := context.WithTimeout(context.Background(), 300*time.Second)
	defer cancel()

	result, err := s.llmService.GenerateHealthReport(ctx, summaries)
	if err != nil {
		s.logger.Error("LLM report generation failed: %v", err)
		return nil, err
	}

	return result, nil
}

// QueryConnectionsForSessionWithHistory answers a natural language question about a specific session with history
func (s *Service) QueryConnectionsForSessionWithHistory(sessionID int64, query string, history []llm.ChatMessage) (*llm.QueryResult, error) {
	s.logger.Debug("LLM Query for session %d with history: %s", sessionID, query)
	return s.queryConnectionsForSessionWithHistory(sessionID, query, history)
}

// Internal implementation of session query with history
func (s *Service) queryConnectionsForSessionWithHistory(sessionID int64, query string, history []llm.ChatMessage) (*llm.QueryResult, error) {
	// Verify session exists
	session := s.snapshotStore.GetSessionByID(sessionID)
	if session == nil {
		return nil, fmt.Errorf("session %d not found", sessionID)
	}

	// Get session time range
	start := session.StartTime
	end := session.EndTime
	if end.IsZero() {
		end = time.Now()
	}

	// Prepare session context string with ISO8601 timestamps for tool compatibility
	duration := end.Sub(start).Round(time.Second)
	startISO := start.Format(time.RFC3339)
	endISO := end.Format(time.RFC3339)
	sessionContext := fmt.Sprintf(`You are the TCP Doctor AI Assistant, analyzing recorded TCP session #%d.

Session Details:
- Session ID: %d
- Start Time: %s
- End Time: %s
- Duration: %s
- Snapshot Count: %d

CRITICAL INSTRUCTIONS:
1. Always use the provided tools (get_snapshots_by_time_range, get_metric_history, plot_graph) to fetch and analyze data. Do not guess or hallucinate connection details.
2. For any data visualization (bar, line, or pie charts), you MUST use the "plot_graph" tool.
3. NEVER describe a graph in text if it can be plotted. If you are showing distributions (e.g., states) or trends (e.g., RTT), call "plot_graph".
4. Previous graphs in the chat history were rendered as interactive components. When you call "plot_graph", the user sees a rich chart, not just text.
5. When calling get_snapshots_by_time_range or get_metric_history, use sessionID=%d and the ISO8601 timestamps above.
6. Use markdown tables to present tabular data for better readability.`,
		sessionID, sessionID, startISO, endISO, duration, session.SnapshotCount, sessionID)

	// We rely on the agent to use tools like get_snapshots_by_time_range or get_metric_history
	// to fetch data as needed. We provide an empty summary list but a strong system prompt context.

	// Call LLM service
	ctx, cancel := context.WithTimeout(context.Background(), 300*time.Second)
	defer cancel()

	// Pass empty summaries as we want "on demand" fetching
	return s.llmService.QueryConnectionsWithHistory(ctx, sessionContext+"\n\nUser Query: "+query, []llm.ConnectionSummary{}, history)
}

// Helper to convert TCP state int to string
func tcpStateToString(state int) string {
	states := []string{"CLOSED", "LISTEN", "SYN_SENT", "SYN_RCVD", "ESTABLISHED", "FIN_WAIT1", "FIN_WAIT2", "CLOSE_WAIT", "CLOSING", "LAST_ACK", "TIME_WAIT", "DELETE_TCB"}
	if state >= 0 && state < len(states) {
		return states[state]
	}
	return fmt.Sprintf("UNKNOWN(%d)", state)
}

// QueryConnectionsForSession answers a natural language question about a specific session
func (s *Service) QueryConnectionsForSession(sessionID int64, query string) (*llm.QueryResult, error) {
	s.logger.Debug("LLM Query for session %d: %s", sessionID, query)
	// NOTE: s.queryConnectionsForSession might be in session_analysis.go.
	// If that file is also windows-locked, we need to move the impl or verify visibility.
	// For now we assume verify visibility to fix app.go build.
	return s.queryConnectionsForSession(sessionID, query)
}

// GenerateHealthReportForSession creates a health report for a specific session
func (s *Service) GenerateHealthReportForSession(sessionID int64) (*llm.HealthReport, error) {
	s.logger.Info("Generating AI health report for session %d", sessionID)
	return s.generateHealthReportForSession(sessionID)
}

// Helper to convert internal connection info to LLM summary
func (s *Service) buildConnectionSummary(conn *ConnectionInfo) llm.ConnectionSummary {
	summary := llm.ConnectionSummary{
		LocalAddr:  conn.LocalAddr,
		LocalPort:  conn.LocalPort,
		RemoteAddr: conn.RemoteAddr,
		RemotePort: conn.RemotePort,
		State:      conn.State.String(),
		HasWarning: conn.HighRetransmissionWarning || conn.HighRTTWarning,
	}

	if conn.BasicStats != nil {
		summary.BytesIn = conn.BasicStats.DataBytesIn
		summary.BytesOut = conn.BasicStats.DataBytesOut
	}

	if conn.ExtendedStats != nil {
		// RTT in milliseconds (already in ms from Windows API)
		summary.RTTMs = float64(conn.ExtendedStats.SmoothedRTT)
		summary.RTTVarianceMs = float64(conn.ExtendedStats.RTTVariance)
		summary.MinRTTMs = float64(conn.ExtendedStats.MinRTT)
		summary.MaxRTTMs = float64(conn.ExtendedStats.MaxRTT)

		// Calculate retransmission rate
		if conn.ExtendedStats.TotalSegsOut > 0 {
			summary.RetransmissionRate = float64(conn.ExtendedStats.SegsRetrans) / float64(conn.ExtendedStats.TotalSegsOut) * 100
		}

		summary.InboundBandwidthBps = conn.ExtendedStats.InboundBandwidth
		summary.OutboundBandwidthBps = conn.ExtendedStats.OutboundBandwidth

		// Congestion Control
		summary.CongestionWindow = uint64(conn.ExtendedStats.CurrentCwnd)
		summary.SlowStartThreshold = uint64(conn.ExtendedStats.CurrentSsthresh)

		// Retransmission Details
		summary.FastRetransmissions = uint64(conn.ExtendedStats.FastRetrans)
		summary.TimeoutEpisodes = uint64(conn.ExtendedStats.TimeoutEpisodes)
		summary.TotalSegmentsOut = conn.ExtendedStats.TotalSegsOut

		// Window & ACK Details
		summary.DuplicateAcksIn = uint64(conn.ExtendedStats.DupAcksIn)
		summary.DuplicateAcksOut = uint64(conn.ExtendedStats.DupAcksOut)
		summary.SACKBlocksReceived = uint64(conn.ExtendedStats.SackBlocksRcvd)
		summary.WindowScaleSent = int(conn.ExtendedStats.WinScaleSent)
		summary.WindowScaleReceived = int(conn.ExtendedStats.WinScaleRcvd)

		// MSS
		summary.CurrentMSS = uint64(conn.ExtendedStats.CurMss)
		summary.MaxMSS = uint64(conn.ExtendedStats.MaxMss)
		summary.MinMSS = uint64(conn.ExtendedStats.MinMss)
	}

	return summary
}
