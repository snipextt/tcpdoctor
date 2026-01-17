package main

import (
	"context"
	"fmt"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"tcpdoctor/internal/llm"
	"tcpdoctor/internal/tcpmonitor"
)

// App struct
type App struct {
	ctx     context.Context
	service *tcpmonitor.Service
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// Create and initialize the TCP monitoring service
	config := tcpmonitor.DefaultServiceConfig()
	service, err := tcpmonitor.NewService(config)
	if err != nil {
		fmt.Printf("Failed to create TCP monitoring service: %v\n", err)
		return
	}

	a.service = service

	// Start the monitoring service
	a.service.Start()

	fmt.Println("TCP monitoring service started successfully")
}

// shutdown is called when the app is closing
func (a *App) shutdown(ctx context.Context) {
	if a.service != nil {
		fmt.Println("Shutting down TCP monitoring service...")
		a.service.Stop()
		fmt.Println("TCP monitoring service stopped")
	}
}

// GetConnections returns all connections matching the filter criteria
func (a *App) GetConnections(filter tcpmonitor.FilterOptions) ([]tcpmonitor.ConnectionInfo, error) {
	if a.service == nil {
		return nil, fmt.Errorf("service not initialized")
	}
	return a.service.GetConnections(filter)
}

// GetConnectionStats retrieves detailed statistics for a specific connection
func (a *App) GetConnectionStats(localAddr string, localPort uint16, remoteAddr string, remotePort uint16) (*tcpmonitor.ExtendedStats, error) {
	if a.service == nil {
		return nil, fmt.Errorf("service not initialized")
	}
	return a.service.GetConnectionStats(localAddr, localPort, remoteAddr, remotePort)
}

// IsAdministrator returns whether the service is running with administrator privileges
func (a *App) IsAdministrator() bool {
	if a.service == nil {
		return false
	}
	return a.service.IsAdministrator()
}

// SetUpdateInterval changes the polling interval (in milliseconds)
func (a *App) SetUpdateInterval(ms int) error {
	if a.service == nil {
		return fmt.Errorf("service not initialized")
	}
	interval := time.Duration(ms) * time.Millisecond
	return a.service.SetUpdateInterval(interval)
}

// GetUpdateInterval returns the current update interval in milliseconds
func (a *App) GetUpdateInterval() int {
	if a.service == nil {
		return 0
	}
	interval := a.service.GetUpdateInterval()
	return int(interval.Milliseconds())
}

// GetConnectionCount returns the total number of tracked connections
func (a *App) GetConnectionCount() int {
	if a.service == nil {
		return 0
	}
	return a.service.GetConnectionCount()
}

// ClearSelection clears the currently selected connection
func (a *App) ClearSelection() {
	if a.service != nil {
		a.service.ClearSelection()
	}
}

// ExportToCSV exports all current connections to a CSV file
func (a *App) ExportToCSV(path string) error {
	if a.service == nil {
		return fmt.Errorf("service not initialized")
	}

	if path == "" {
		// Open save dialog using Wails runtime
		var err error
		path, err = runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
			Title:           "Export Connections to CSV",
			DefaultFilename: "tcp_connections.csv",
			Filters: []runtime.FileFilter{
				{DisplayName: "CSV Files (*.csv)", Pattern: "*.csv"},
			},
		})
		if err != nil {
			return fmt.Errorf("dialog error: %w", err)
		}
		if path == "" {
			return nil // User cancelled
		}
	}

	return a.service.ExportToCSV(path)
}

// SetRetransmissionThreshold updates the retransmission rate threshold (percentage)
func (a *App) SetRetransmissionThreshold(percent float64) {
	if a.service != nil {
		a.service.SetRetransmissionThreshold(percent)
	}
}

// SetRTTThreshold updates the RTT threshold (milliseconds)
func (a *App) SetRTTThreshold(milliseconds uint32) {
	if a.service != nil {
		a.service.SetRTTThreshold(milliseconds)
	}
}

// GetHealthThresholds returns the current health indicator thresholds
func (a *App) GetHealthThresholds() tcpmonitor.HealthThresholds {
	if a.service == nil {
		return tcpmonitor.DefaultHealthThresholds()
	}
	return a.service.GetHealthThresholds()
}

// SetHealthThresholds updates the health indicator thresholds
func (a *App) SetHealthThresholds(thresholds tcpmonitor.HealthThresholds) {
	if a.service != nil {
		a.service.SetHealthThresholds(thresholds)
	}
}

// ============================================================
// LLM (AI) Methods - Exposed to Wails frontend
// ============================================================

// ConfigureLLM sets up the Gemini API with the provided API key
func (a *App) ConfigureLLM(apiKey string) error {
	if a.service == nil {
		return fmt.Errorf("service not initialized")
	}
	return a.service.ConfigureLLM(apiKey)
}

// IsLLMConfigured returns true if the LLM service has a valid API key
func (a *App) IsLLMConfigured() bool {
	if a.service == nil {
		return false
	}
	return a.service.IsLLMConfigured()
}

// DiagnoseConnection analyzes a specific connection and returns AI-generated diagnosis
func (a *App) DiagnoseConnection(localAddr string, localPort uint16, remoteAddr string, remotePort uint16) (*llm.DiagnosticResult, error) {
	if a.service == nil {
		return nil, fmt.Errorf("service not initialized")
	}
	return a.service.DiagnoseConnection(localAddr, localPort, remoteAddr, remotePort)
}

// QueryConnections answers a natural language question about the connections
func (a *App) QueryConnections(query string) (*llm.QueryResult, error) {
	if a.service == nil {
		return nil, fmt.Errorf("service not initialized")
	}
	return a.service.QueryConnections(query)
}

// QueryConnectionsWithHistory answers a question with full conversation context
func (a *App) QueryConnectionsWithHistory(query string, history []llm.ChatMessage) (*llm.QueryResult, error) {
	if a.service == nil {
		return nil, fmt.Errorf("service not initialized")
	}
	return a.service.QueryConnectionsWithHistory(query, history)
}

// GenerateHealthReport creates an AI-generated network health report
func (a *App) GenerateHealthReport() (*llm.HealthReport, error) {
	if a.service == nil {
		return nil, fmt.Errorf("service not initialized")
	}
	return a.service.GenerateHealthReport()
}

// === Session-Specific AI Methods ===

// QueryConnectionsForSession queries AI about a specific recorded session
func (a *App) QueryConnectionsForSession(query string, sessionID int64) (*llm.QueryResult, error) {
	if a.service == nil {
		return nil, fmt.Errorf("service not initialized")
	}
	return a.service.QueryConnectionsForSession(sessionID, query)
}

// QueryConnectionsForSessionWithHistory queries AI about a specific recorded session with history
func (a *App) QueryConnectionsForSessionWithHistory(query string, sessionID int64, history []llm.ChatMessage) (*llm.QueryResult, error) {
	if a.service == nil {
		return nil, fmt.Errorf("service not initialized")
	}
	return a.service.QueryConnectionsForSessionWithHistory(sessionID, query, history)
}

// GenerateHealthReportForSession creates an AI-generated health report for a specific session
func (a *App) GenerateHealthReportForSession(sessionID int64) (*llm.HealthReport, error) {
	if a.service == nil {
		return nil, fmt.Errorf("service not initialized")
	}
	return a.service.GenerateHealthReportForSession(sessionID)
}

// === Snapshot Methods ===

// StartRecording begins snapshot capture
func (a *App) StartRecording() {
	if a.service != nil {
		a.service.StartRecording()
	}
}

// StopRecording stops snapshot capture
func (a *App) StopRecording() {
	if a.service != nil {
		a.service.StopRecording()
	}
}

// IsRecording returns current recording state
func (a *App) IsRecording() bool {
	if a.service == nil {
		return false
	}
	return a.service.IsRecording()
}

// GetSnapshotCount returns number of stored snapshots
func (a *App) GetSnapshotCount() int {
	if a.service == nil {
		return 0
	}
	return a.service.GetSnapshotCount()
}

// GetSnapshotMeta returns lightweight metadata for timeline
func (a *App) GetSnapshotMeta() []tcpmonitor.SnapshotMeta {
	if a.service == nil {
		return nil
	}
	return a.service.GetSnapshotMeta()
}

// GetSnapshot returns a specific snapshot by ID
func (a *App) GetSnapshot(id int64) *tcpmonitor.Snapshot {
	if a.service == nil {
		return nil
	}
	return a.service.GetSnapshot(id)
}

// CompareSnapshots compares two snapshots
func (a *App) CompareSnapshots(id1, id2 int64) *tcpmonitor.ComparisonResult {
	if a.service == nil {
		return nil
	}
	return a.service.CompareSnapshots(id1, id2)
}

// ClearSnapshots removes all stored snapshots
func (a *App) ClearSnapshots() {
	if a.service != nil {
		a.service.ClearSnapshots()
	}
}

// TakeSnapshot manually captures current state
func (a *App) TakeSnapshot(filter tcpmonitor.FilterOptions) {
	if a.service != nil {
		a.service.TakeSnapshot(filter)
	}
}

// GetConnectionHistory returns historical data for a specific connection
func (a *App) GetConnectionHistory(localAddr string, localPort int, remoteAddr string, remotePort int) []tcpmonitor.ConnectionHistoryPoint {
	if a.service == nil {
		return nil
	}
	return a.service.GetConnectionHistory(localAddr, localPort, remoteAddr, remotePort)
}

// === Session Methods ===

// GetSessions returns all recording sessions
func (a *App) GetSessions() []tcpmonitor.RecordingSession {
	if a.service == nil {
		return nil
	}
	return a.service.GetSessions()
}

// GetSessionCount returns number of sessions
func (a *App) GetSessionCount() int {
	if a.service == nil {
		return 0
	}
	return a.service.GetSessionCount()
}

// GetSessionTimeline returns all connection snapshots from a session as timeline rows
func (a *App) GetSessionTimeline(sessionID int64) []tcpmonitor.TimelineConnection {
	if a.service == nil {
		return nil
	}
	return a.service.GetSessionTimeline(sessionID)
}

// GetConnectionHistoryForSession returns historical data for a connection within a specific session
func (a *App) GetConnectionHistoryForSession(sessionID int64, localAddr string, localPort int, remoteAddr string, remotePort int) []tcpmonitor.ConnectionHistoryPoint {
	if a.service == nil {
		return nil
	}
	return a.service.GetConnectionHistoryForSession(sessionID, localAddr, localPort, remoteAddr, remotePort)
}
