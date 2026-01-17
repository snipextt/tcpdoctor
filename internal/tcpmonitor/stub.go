//go:build !windows
// +build !windows

package tcpmonitor

import (
	"fmt"
	"time"
)

// Stub types for non-Windows platforms (for development/testing purposes)

type StatsCollector struct{}

func (sc *StatsCollector) GetExtendedStats(conn *ConnectionInfo) (*ExtendedStats, error) {
	return nil, nil
}

func (sc *StatsCollector) Close() {}

func NewService(config ServiceConfig) (*Service, error) {
	// For non-Windows builds, return a service with dependencies
	// Note: apiLayer will be nil or stubbed via type_aliases_other.go
	return &Service{
		updateInterval: config.UpdateInterval,
		// minimal initialization to prevent nil panics if methods are called
		logger: GetLogger(),
	}, nil
}

// Stub methods for Windows-specific functionality
func (s *Service) Start() {}
func (s *Service) Stop()  {}
func (s *Service) GetConnections(filter FilterOptions) ([]ConnectionInfo, error) {
	return nil, fmt.Errorf("TCP monitoring not supported on this platform")
}
func (s *Service) GetConnectionStats(localAddr string, localPort uint16, remoteAddr string, remotePort uint16) (*ExtendedStats, error) {
	return nil, fmt.Errorf("TCP monitoring not supported on this platform")
}
func (s *Service) IsAdministrator() bool                           { return false }
func (s *Service) SetUpdateInterval(interval time.Duration) error  { return nil }
func (s *Service) GetUpdateInterval() time.Duration                { return s.updateInterval }
func (s *Service) GetConnectionCount() int                         { return 0 }
func (s *Service) ClearSelection()                                 {}
func (s *Service) SetHealthThresholds(thresholds HealthThresholds) {}
func (s *Service) GetHealthThresholds() HealthThresholds           { return DefaultHealthThresholds() }
func (s *Service) SetRetransmissionThreshold(percent float64)      {}
func (s *Service) SetRTTThreshold(milliseconds uint32)             {}
func (s *Service) ExportToCSV(path string) error                   { return fmt.Errorf("not supported") }

// LLM stubs
// LLM stubs
func (s *Service) ConfigureLLM(apiKey string) error {
	// We can support configuration even on Mac if we want to test LLM
	if s.llmService != nil {
		return s.llmService.Configure(apiKey)
	}
	return fmt.Errorf("LLM service not initialized")
}

// IsLLMConfigured, DiagnoseConnection, QueryConnections, GenerateHealthReport are now in service_llm.go
// REMOVED duplicates

// Snapshot stubs and types
// Snapshot types are now in snapshot.go (untagged)
// Removed duplicate struct definitions

// Internal method implementations for session analysis are now in service_analysis.go
// Removed duplicates
