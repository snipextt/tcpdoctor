//go:build windows
// +build windows

package tcpmonitor

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"tcpdoctor/internal/llm"
	"tcpdoctor/internal/tcpmonitor/winapi"
)

// NewService creates a new TCP monitoring service
func NewService(config ServiceConfig) (*Service, error) {
	logger := GetLogger()

	// Validate configuration
	if config.UpdateInterval < 100*time.Millisecond {
		return nil, ErrInvalidInterval
	}
	if config.UpdateInterval > 10*time.Second {
		return nil, ErrInvalidInterval
	}

	// Create Windows API layer
	apiLayer := winapi.NewWindowsAPILayer()

	// Check administrator privileges
	isAdmin := apiLayer.IsAdministrator()
	if isAdmin {
		logger.Info("Running with Administrator privileges - extended statistics available")
	} else {
		logger.Info("Running without Administrator privileges - extended statistics unavailable")
	}

	// Create components
	connectionManager := NewConnectionManager()
	statsCollector := NewStatsCollector(apiLayer, isAdmin)
	filterEngine := NewFilterEngine()

	// Create context for polling control
	ctx, cancel := context.WithCancel(context.Background())

	service := &Service{
		connectionManager: connectionManager,
		statsCollector:    statsCollector,
		filterEngine:      filterEngine,
		apiLayer:          apiLayer,
		llmService:        llm.NewGeminiService(),
		snapshotStore:     NewSnapshotStore(20000), // ~20k snapshots for high-freq recording
		updateInterval:    config.UpdateInterval,
		isAdmin:           isAdmin,
		healthThresholds:  DefaultHealthThresholds(),
		ctx:               ctx,
		cancel:            cancel,
		logger:            logger,
	}

	// Start recording by default
	service.snapshotStore.StartRecording()

	// Register AI tool handlers
	service.registerAIHandlers()

	return service, nil
}

func (s *Service) registerAIHandlers() {
	s.llmService.RegisterTool("get_snapshots_by_time_range", s.handleGetSnapshotsByTimeRange)
	s.llmService.RegisterTool("get_metric_history", s.handleGetMetricHistory)
	s.llmService.RegisterTool("plot_graph", s.handlePlotGraph)
}

func (s *Service) handleGetSnapshotsByTimeRange(ctx context.Context, args map[string]interface{}) (interface{}, error) {
	sessionID, ok := args["sessionID"].(float64)
	if !ok {
		return nil, fmt.Errorf("sessionID must be a number")
	}

	startStr, _ := args["startTime"].(string)
	endStr, _ := args["endTime"].(string)

	startTime, err := time.Parse(time.RFC3339, startStr)
	if err != nil {
		return nil, fmt.Errorf("invalid startTime: %v", err)
	}
	endTime, err := time.Parse(time.RFC3339, endStr)
	if err != nil {
		return nil, fmt.Errorf("invalid endTime: %v", err)
	}

	// Parsing optional connection filters
	filter := &llm.ConnectionFilter{}
	hasFilter := false

	if laddr, ok := args["localAddr"].(string); ok && laddr != "" {
		filter.LocalAddr = &laddr
		hasFilter = true
	}
	if raddr, ok := args["remoteAddr"].(string); ok && raddr != "" {
		filter.RemoteAddr = &raddr
		hasFilter = true
	}
	if lport, ok := args["localPort"].(float64); ok && lport != 0 {
		p := int(lport)
		filter.LocalPort = &p
		hasFilter = true
	}
	if rport, ok := args["remotePort"].(float64); ok && rport != 0 {
		p := int(rport)
		filter.RemotePort = &p
		hasFilter = true
	}

	var f *llm.ConnectionFilter
	if hasFilter {
		f = filter
	}

	return s.GetSnapshotsByTimeRange(int64(sessionID), startTime, endTime, f)
}

// handlePlotGraph is a local handler for the plot_graph tool
// It doesn't actually do anything on the backend side as the graphing logic
// is handled within the AI loop in query_connections.go, but it needs to be registered
// so that the tool Registry doesn't error out.
func (s *Service) handlePlotGraph(ctx context.Context, args map[string]interface{}) (interface{}, error) {
	return "Acknowledged", nil
}

func (s *Service) handleGetMetricHistory(ctx context.Context, args map[string]interface{}) (interface{}, error) {
	sessionID, _ := args["sessionID"].(float64)
	localAddr, _ := args["localAddr"].(string)
	localPort, _ := args["localPort"].(float64)
	remoteAddr, _ := args["remoteAddr"].(string)
	remotePort, _ := args["remotePort"].(float64)
	metric, _ := args["metric"].(string)

	history := s.GetConnectionHistoryForSession(int64(sessionID), localAddr, int(localPort), remoteAddr, int(remotePort))

	// Simplify history to just the requested metric to save tokens
	type HistoryPoint struct {
		Time  string  `json:"t"`
		Value float64 `json:"v"`
	}
	var result []HistoryPoint
	for _, p := range history {
		val := 0.0
		switch metric {
		case "rtt":
			val = float64(p.RTT)
		case "bandwidth_in":
			val = float64(p.InBandwidth)
		case "bandwidth_out":
			val = float64(p.OutBandwidth)
		}
		result = append(result, HistoryPoint{
			Time:  p.Timestamp.Format("15:04:05"),
			Value: val,
		})
	}
	return result, nil
}

// Start begins the polling loop for connection updates
func (s *Service) Start() {
	s.logger.Info("Starting TCP monitoring service with %v update interval", s.updateInterval)

	s.wg.Add(1)
	go s.pollingLoop()
}

// Stop gracefully shuts down the service
func (s *Service) Stop() {
	s.logger.Info("Stopping TCP monitoring service")

	// Cancel the context to signal shutdown
	s.cancel()

	// Wait for polling loop to finish
	s.wg.Wait()

	s.logger.Info("TCP monitoring service stopped")
}

// pollingLoop continuously updates connection information
func (s *Service) pollingLoop() {
	defer s.wg.Done()

	ticker := time.NewTicker(s.updateInterval)
	defer ticker.Stop()

	// Perform initial update immediately
	s.performUpdate()

	for {
		select {
		case <-s.ctx.Done():
			s.logger.Debug("Polling loop shutting down")
			return
		case <-ticker.C:
			s.performUpdate()
		}
	}
}

// performUpdate executes a single update cycle
func (s *Service) performUpdate() {
	startTime := time.Now()

	// Collect IPv4 connections
	ipv4Connections, err := s.statsCollector.CollectIPv4Connections()
	if err != nil {
		s.logger.Error("Failed to collect IPv4 connections: %v", err)
		ipv4Connections = []ConnectionInfo{}
	}

	// Collect IPv6 connections
	ipv6Connections, err := s.statsCollector.CollectIPv6Connections()
	if err != nil {
		s.logger.Error("Failed to collect IPv6 connections: %v", err)
		ipv6Connections = []ConnectionInfo{}
	}

	// Combine all connections
	allConnections := append(ipv4Connections, ipv6Connections...)

	// Enable extended statistics for new connections (if admin)
	if s.isAdmin {
		for i := range allConnections {
			conn := &allConnections[i]
			// Only enable for established connections to reduce overhead
			if conn.State == StateEstablished {
				if err := s.statsCollector.EnableExtendedStats(conn); err != nil {
					s.logger.Debug("Failed to enable extended stats for connection: %v", err)
				}
			}
		}

		// Retrieve extended statistics for all connections
		for i := range allConnections {
			conn := &allConnections[i]
			if conn.State == StateEstablished {
				if stats, err := s.statsCollector.GetExtendedStats(conn); err == nil {
					conn.ExtendedStats = stats
					// Also populate BasicStats from the data stats
					conn.BasicStats = &BasicStats{
						DataBytesOut: stats.ThruBytesAcked,
						DataBytesIn:  stats.ThruBytesReceived,
						DataSegsOut:  stats.TotalSegsOut,
						DataSegsIn:   stats.TotalSegsIn,
					}
				}
			}
		}
	}

	// Calculate health indicators for all connections
	s.mu.RLock()
	thresholds := s.healthThresholds
	s.mu.RUnlock()

	for i := range allConnections {
		CalculateHealth(&allConnections[i], thresholds)
	}

	// Update connection manager
	events := s.connectionManager.Update(allConnections)

	// Capture snapshot if recording is active
	s.snapshotStore.Take(allConnections)

	// Check if selected connection was closed
	s.mu.Lock()
	if s.selectedConn != nil {
		if _, exists := s.connectionManager.Get(*s.selectedConn); !exists {
			s.logger.Debug("Selected connection closed: %s", s.selectedConn.String())
			s.selectedConn = nil
		}
	}
	s.mu.Unlock()

	duration := time.Since(startTime)
	s.logger.Debug("Update cycle completed in %v, processed %d connections, generated %d events",
		duration, len(allConnections), len(events))
}

// GetConnections returns all connections matching the filter criteria
func (s *Service) GetConnections(filter FilterOptions) ([]ConnectionInfo, error) {
	// Get all connections from the manager
	allConnections := s.connectionManager.GetAll()

	// Apply filters
	filteredConnections := s.filterEngine.Apply(allConnections, filter)

	return filteredConnections, nil
}

// GetConnectionStats retrieves detailed statistics for a specific connection
func (s *Service) GetConnectionStats(localAddr string, localPort uint16, remoteAddr string, remotePort uint16) (*ExtendedStats, error) {
	// Determine if this is an IPv6 address
	isIPv6 := false
	if len(localAddr) > 15 || len(remoteAddr) > 15 {
		isIPv6 = true
	}

	// Create connection key
	key := ConnectionKey{
		LocalAddr:  localAddr,
		LocalPort:  localPort,
		RemoteAddr: remoteAddr,
		RemotePort: remotePort,
		IsIPv6:     isIPv6,
	}

	// Update selected connection
	s.mu.Lock()
	s.selectedConn = &key
	s.mu.Unlock()

	// Get the connection from the manager
	conn, exists := s.connectionManager.Get(key)
	if !exists {
		return nil, ErrConnectionNotFound
	}

	// If we don't have admin privileges, return nil with appropriate error
	if !s.isAdmin {
		return nil, ErrAccessDenied
	}

	// Return the extended stats if available
	if conn.ExtendedStats != nil {
		return conn.ExtendedStats, nil
	}

	// Try to retrieve stats on-demand
	stats, err := s.statsCollector.GetExtendedStats(conn)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve extended statistics: %w", err)
	}

	return stats, nil
}

// IsAdministrator returns whether the service is running with administrator privileges
func (s *Service) IsAdministrator() bool {
	return s.isAdmin
}

// SetUpdateInterval changes the polling interval
func (s *Service) SetUpdateInterval(interval time.Duration) error {
	// Validate interval
	if interval < 100*time.Millisecond {
		return ErrInvalidInterval
	}
	if interval > 10*time.Second {
		return ErrInvalidInterval
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	s.updateInterval = interval
	s.logger.Info("Update interval changed to %v", interval)

	// Note: The change will take effect on the next ticker cycle
	// For immediate effect, we would need to restart the ticker
	// which is more complex and not required by the spec

	return nil
}

// GetUpdateInterval returns the current update interval
func (s *Service) GetUpdateInterval() time.Duration {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.updateInterval
}

// GetConnectionCount returns the total number of tracked connections
func (s *Service) GetConnectionCount() int {
	return s.connectionManager.Count()
}

// ClearSelection clears the currently selected connection
func (s *Service) ClearSelection() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.selectedConn = nil
}

// SetHealthThresholds updates the health indicator thresholds
func (s *Service) SetHealthThresholds(thresholds HealthThresholds) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.healthThresholds = thresholds
	s.logger.Info("Health thresholds updated: retransmission=%.2f%%, RTT=%dms",
		thresholds.RetransmissionRatePercent, thresholds.HighRTTMilliseconds)
}

// GetHealthThresholds returns the current health indicator thresholds
func (s *Service) GetHealthThresholds() HealthThresholds {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.healthThresholds
}

// SetRetransmissionThreshold updates only the retransmission rate threshold
func (s *Service) SetRetransmissionThreshold(percent float64) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.healthThresholds.RetransmissionRatePercent = percent
	s.logger.Info("Retransmission threshold updated to %.2f%%", percent)
}

// SetRTTThreshold updates only the RTT threshold
func (s *Service) SetRTTThreshold(milliseconds uint32) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.healthThresholds.HighRTTMilliseconds = milliseconds
	s.logger.Info("RTT threshold updated to %dms", milliseconds)
}

// ExportToCSV exports all current connections to a CSV file
func (s *Service) ExportToCSV(path string) error {
	s.logger.Info("Exporting connections to CSV: %s", path)

	// Get all connections
	allConnections := s.connectionManager.GetAll()

	if len(allConnections) == 0 {
		s.logger.Warn("No connections to export")
		return fmt.Errorf("no connections to export")
	}

	// Generate CSV content
	csvContent, err := s.generateCSV(allConnections)
	if err != nil {
		s.logger.Error("Failed to generate CSV content: %v", err)
		return fmt.Errorf("failed to generate CSV content: %w", err)
	}

	// Write to file
	if err := s.writeCSVFile(path, csvContent); err != nil {
		s.logger.Error("Failed to write CSV file: %v", err)
		return fmt.Errorf("failed to write CSV file: %w", err)
	}

	s.logger.Info("Successfully exported %d connections to %s", len(allConnections), path)
	return nil
}

// generateCSV creates CSV content from connection data
func (s *Service) generateCSV(connections []ConnectionInfo) (string, error) {
	var builder strings.Builder

	// Write CSV header
	header := s.getCSVHeader()
	builder.WriteString(header)
	builder.WriteString("\n")

	// Write data rows
	for _, conn := range connections {
		row := s.formatConnectionAsCSVRow(&conn)
		builder.WriteString(row)
		builder.WriteString("\n")
	}

	return builder.String(), nil
}

// getCSVHeader returns the CSV header with all field names
func (s *Service) getCSVHeader() string {
	fields := []string{
		// Basic connection info
		"LocalAddr",
		"LocalPort",
		"RemoteAddr",
		"RemotePort",
		"State",
		"PID",
		"IsIPv6",
		"LastSeen",

		// Basic stats
		"DataBytesOut",
		"DataBytesIn",
		"DataSegsOut",
		"DataSegsIn",

		// Extended stats - Data Transfer
		"TotalSegsOut",
		"TotalSegsIn",
		"ThruBytesAcked",
		"ThruBytesReceived",

		// Extended stats - Retransmissions
		"SegsRetrans",
		"BytesRetrans",
		"FastRetrans",
		"TimeoutEpisodes",

		// Extended stats - RTT Metrics
		"SampleRTT",
		"SmoothedRTT",
		"RTTVariance",
		"MinRTT",
		"MaxRTT",

		// Extended stats - Congestion Control
		"CurrentCwnd",
		"CurrentSsthresh",
		"SlowStartCount",
		"CongAvoidCount",

		// Extended stats - Buffers
		"CurRetxQueue",
		"MaxRetxQueue",
		"CurAppWQueue",
		"MaxAppWQueue",

		// Extended stats - Bandwidth
		"OutboundBandwidth",
		"InboundBandwidth",
	}

	return strings.Join(fields, ",")
}

// formatConnectionAsCSVRow formats a single connection as a CSV row
func (s *Service) formatConnectionAsCSVRow(conn *ConnectionInfo) string {
	fields := make([]string, 0, 42)

	// Basic connection info
	fields = append(fields, s.escapeCSVField(conn.LocalAddr))
	fields = append(fields, fmt.Sprintf("%d", conn.LocalPort))
	fields = append(fields, s.escapeCSVField(conn.RemoteAddr))
	fields = append(fields, fmt.Sprintf("%d", conn.RemotePort))
	fields = append(fields, s.escapeCSVField(conn.State.String()))
	fields = append(fields, fmt.Sprintf("%d", conn.PID))
	fields = append(fields, fmt.Sprintf("%t", conn.IsIPv6))
	fields = append(fields, s.escapeCSVField(conn.LastSeen.Format(time.RFC3339)))

	// Basic stats
	if conn.BasicStats != nil {
		fields = append(fields, fmt.Sprintf("%d", conn.BasicStats.DataBytesOut))
		fields = append(fields, fmt.Sprintf("%d", conn.BasicStats.DataBytesIn))
		fields = append(fields, fmt.Sprintf("%d", conn.BasicStats.DataSegsOut))
		fields = append(fields, fmt.Sprintf("%d", conn.BasicStats.DataSegsIn))
	} else {
		fields = append(fields, "", "", "", "")
	}

	// Extended stats - Data Transfer
	if conn.ExtendedStats != nil {
		fields = append(fields, fmt.Sprintf("%d", conn.ExtendedStats.TotalSegsOut))
		fields = append(fields, fmt.Sprintf("%d", conn.ExtendedStats.TotalSegsIn))
		fields = append(fields, fmt.Sprintf("%d", conn.ExtendedStats.ThruBytesAcked))
		fields = append(fields, fmt.Sprintf("%d", conn.ExtendedStats.ThruBytesReceived))

		// Extended stats - Retransmissions
		fields = append(fields, fmt.Sprintf("%d", conn.ExtendedStats.SegsRetrans))
		fields = append(fields, fmt.Sprintf("%d", conn.ExtendedStats.BytesRetrans))
		fields = append(fields, fmt.Sprintf("%d", conn.ExtendedStats.FastRetrans))
		fields = append(fields, fmt.Sprintf("%d", conn.ExtendedStats.TimeoutEpisodes))

		// Extended stats - RTT Metrics
		fields = append(fields, fmt.Sprintf("%d", conn.ExtendedStats.SampleRTT))
		fields = append(fields, fmt.Sprintf("%d", conn.ExtendedStats.SmoothedRTT))
		fields = append(fields, fmt.Sprintf("%d", conn.ExtendedStats.RTTVariance))
		fields = append(fields, fmt.Sprintf("%d", conn.ExtendedStats.MinRTT))
		fields = append(fields, fmt.Sprintf("%d", conn.ExtendedStats.MaxRTT))

		// Extended stats - Congestion Control
		fields = append(fields, fmt.Sprintf("%d", conn.ExtendedStats.CurrentCwnd))
		fields = append(fields, fmt.Sprintf("%d", conn.ExtendedStats.CurrentSsthresh))
		fields = append(fields, fmt.Sprintf("%d", conn.ExtendedStats.SlowStartCount))
		fields = append(fields, fmt.Sprintf("%d", conn.ExtendedStats.CongAvoidCount))

		// Extended stats - Buffers
		fields = append(fields, fmt.Sprintf("%d", conn.ExtendedStats.CurRetxQueue))
		fields = append(fields, fmt.Sprintf("%d", conn.ExtendedStats.MaxRetxQueue))
		fields = append(fields, fmt.Sprintf("%d", conn.ExtendedStats.CurAppWQueue))
		fields = append(fields, fmt.Sprintf("%d", conn.ExtendedStats.MaxAppWQueue))

		// Extended stats - Bandwidth
		fields = append(fields, fmt.Sprintf("%d", conn.ExtendedStats.OutboundBandwidth))
		fields = append(fields, fmt.Sprintf("%d", conn.ExtendedStats.InboundBandwidth))
	} else {
		// Add empty fields for all extended stats (30 fields)
		for i := 0; i < 30; i++ {
			fields = append(fields, "")
		}
	}

	return strings.Join(fields, ",")
}

// escapeCSVField escapes a field for CSV format
func (s *Service) escapeCSVField(field string) string {
	// If the field contains comma, quote, or newline, wrap it in quotes
	if strings.ContainsAny(field, ",\"\n\r") {
		// Escape quotes by doubling them
		field = strings.ReplaceAll(field, "\"", "\"\"")
		return "\"" + field + "\""
	}
	return field
}

// writeCSVFile writes CSV content to a file
func (s *Service) writeCSVFile(path string, content string) error {
	// Create or truncate the file
	file, err := os.Create(path)
	if err != nil {
		return fmt.Errorf("failed to create file: %w", err)
	}
	defer file.Close()

	// Write the content
	_, err = file.WriteString(content)
	if err != nil {
		return fmt.Errorf("failed to write content: %w", err)
	}

	// Ensure data is flushed to disk
	if err := file.Sync(); err != nil {
		return fmt.Errorf("failed to sync file: %w", err)
	}

	return nil
}

// ============================================================
// LLM (AI) Methods - Exposed to Wails frontend
// ============================================================

// ConfigureLLM sets up the Gemini API with the provided API key
func (s *Service) ConfigureLLM(apiKey string) error {
	s.logger.Info("Configuring LLM service")
	if err := s.llmService.Configure(apiKey); err != nil {
		s.logger.Error("Failed to configure LLM: %v", err)
		return err
	}
	s.logger.Info("LLM service configured successfully")
	return nil
}
