//go:build !windows
// +build !windows

package tcpmonitor

import (
	"fmt"
	"time"

	"tcpdoctor/internal/llm"
)

// Stub types for non-Windows platforms (for development/testing purposes)

type Service struct{}
type ServiceConfig struct {
	UpdateInterval time.Duration
}
type ConnectionInfo struct {
	LocalAddr     string
	LocalPort     uint16
	RemoteAddr    string
	RemotePort    uint16
	State         TCPState
	PID           uint32
	IsIPv6        bool
	LastSeen      time.Time
	BasicStats    *BasicStats
	ExtendedStats *ExtendedStats
}
type FilterOptions struct {
	PID             *uint32
	Port            *uint16
	State           *TCPState
	IPv4Only        bool
	IPv6Only        bool
	ExcludeInternal bool
	SearchText      string
}
type ExtendedStats struct {
	TotalSegsOut      uint64
	TotalSegsIn       uint64
	ThruBytesAcked    uint64
	ThruBytesReceived uint64
	SegsRetrans       uint32
	BytesRetrans      uint32
	FastRetrans       uint32
	TimeoutEpisodes   uint32
	SampleRTT         uint32
	SmoothedRTT       uint32
	RTTVariance       uint32
	MinRTT            uint32
	MaxRTT            uint32
	CurrentCwnd       uint32
	CurrentSsthresh   uint32
	SlowStartCount    uint32
	CongAvoidCount    uint32
	CurRetxQueue      uint32
	MaxRetxQueue      uint32
	CurAppWQueue      uint32
	MaxAppWQueue      uint32
	OutboundBandwidth uint64
	InboundBandwidth  uint64
}
type BasicStats struct {
	DataBytesOut uint64
	DataBytesIn  uint64
	DataSegsOut  uint64
	DataSegsIn   uint64
}
type TCPState int
type HealthThresholds struct {
	RetransmissionRatePercent float64
	HighRTTMilliseconds       uint32
}

func DefaultServiceConfig() ServiceConfig {
	return ServiceConfig{UpdateInterval: 1 * time.Second}
}

func DefaultHealthThresholds() HealthThresholds {
	return HealthThresholds{
		RetransmissionRatePercent: 5.0,
		HighRTTMilliseconds:       200,
	}
}

func NewService(config ServiceConfig) (*Service, error) {
	return nil, fmt.Errorf("TCP monitoring is only supported on Windows")
}

func (s *Service) Start() {}
func (s *Service) Stop()  {}
func (s *Service) GetConnections(filter FilterOptions) ([]ConnectionInfo, error) {
	return nil, fmt.Errorf("not supported")
}
func (s *Service) GetConnectionStats(localAddr string, localPort uint16, remoteAddr string, remotePort uint16) (*ExtendedStats, error) {
	return nil, fmt.Errorf("not supported")
}
func (s *Service) IsAdministrator() bool                           { return false }
func (s *Service) SetUpdateInterval(interval time.Duration) error  { return fmt.Errorf("not supported") }
func (s *Service) GetUpdateInterval() time.Duration                { return 0 }
func (s *Service) GetConnectionCount() int                         { return 0 }
func (s *Service) ClearSelection()                                 {}
func (s *Service) SetHealthThresholds(thresholds HealthThresholds) {}
func (s *Service) GetHealthThresholds() HealthThresholds           { return DefaultHealthThresholds() }
func (s *Service) SetRetransmissionThreshold(percent float64)      {}
func (s *Service) SetRTTThreshold(milliseconds uint32)             {}
func (s *Service) ExportToCSV(path string) error                   { return fmt.Errorf("not supported") }

// LLM stubs
func (s *Service) ConfigureLLM(apiKey string) error { return fmt.Errorf("not supported") }
func (s *Service) IsLLMConfigured() bool            { return false }
func (s *Service) DiagnoseConnection(localAddr string, localPort uint16, remoteAddr string, remotePort uint16) (*llm.DiagnosticResult, error) {
	return nil, fmt.Errorf("not supported")
}
func (s *Service) QueryConnections(query string) (*llm.QueryResult, error) {
	return nil, fmt.Errorf("not supported")
}
func (s *Service) GenerateHealthReport() (*llm.HealthReport, error) {
	return nil, fmt.Errorf("not supported")
}
