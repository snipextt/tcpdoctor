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

// Snapshot stubs and types
type CompactConnection struct {
	LocalAddr     string `json:"localAddr"`
	LocalPort     int    `json:"localPort"`
	RemoteAddr    string `json:"remoteAddr"`
	RemotePort    int    `json:"remotePort"`
	State         int    `json:"state"`
	PID           int    `json:"pid"`
	BytesIn       int64  `json:"bytesIn"`
	BytesOut      int64  `json:"bytesOut"`
	SegmentsIn    int64  `json:"segmentsIn"`
	SegmentsOut   int64  `json:"segmentsOut"`
	RTT           int64  `json:"rtt"`
	RTTVariance   int64  `json:"rttVariance"`
	MinRTT        int64  `json:"minRtt"`
	MaxRTT        int64  `json:"maxRtt"`
	Retrans       int64  `json:"retrans"`
	SegsRetrans   int64  `json:"segsRetrans"`
	CongestionWin int64  `json:"congestionWin"`
	InBandwidth   int64  `json:"inBandwidth"`
	OutBandwidth  int64  `json:"outBandwidth"`
}

type Snapshot struct {
	ID          int64               `json:"id"`
	Timestamp   time.Time           `json:"timestamp"`
	Connections []CompactConnection `json:"connections"`
}

type SnapshotMeta struct {
	ID              int64     `json:"id"`
	Timestamp       time.Time `json:"timestamp"`
	ConnectionCount int       `json:"connectionCount"`
}

type ComparisonResult struct {
	Snapshot1 int64               `json:"snapshot1"`
	Snapshot2 int64               `json:"snapshot2"`
	Added     []CompactConnection `json:"added"`
	Removed   []CompactConnection `json:"removed"`
	Changed   []ConnectionDiff    `json:"changed"`
}

type ConnectionDiff struct {
	Connection CompactConnection `json:"connection"`
	DeltaIn    int64             `json:"deltaIn"`
	DeltaOut   int64             `json:"deltaOut"`
	DeltaRTT   int64             `json:"deltaRtt"`
}

func (s *Service) StartRecording()                                   {}
func (s *Service) StopRecording()                                    {}
func (s *Service) IsRecording() bool                                 { return false }
func (s *Service) GetSnapshotCount() int                             { return 0 }
func (s *Service) GetSnapshotMeta() []SnapshotMeta                   { return nil }
func (s *Service) GetSnapshot(id int64) *Snapshot                    { return nil }
func (s *Service) CompareSnapshots(id1, id2 int64) *ComparisonResult { return nil }
func (s *Service) ClearSnapshots()                                   {}
func (s *Service) TakeSnapshot()                                     {}

// ConnectionHistoryPoint is a single data point for charting - all metrics
type ConnectionHistoryPoint struct {
	Timestamp     time.Time `json:"timestamp"`
	State         int       `json:"state"`
	BytesIn       int64     `json:"bytesIn"`
	BytesOut      int64     `json:"bytesOut"`
	SegmentsIn    int64     `json:"segmentsIn"`
	SegmentsOut   int64     `json:"segmentsOut"`
	RTT           int64     `json:"rtt"`
	RTTVariance   int64     `json:"rttVariance"`
	MinRTT        int64     `json:"minRtt"`
	MaxRTT        int64     `json:"maxRtt"`
	Retrans       int64     `json:"retrans"`
	SegsRetrans   int64     `json:"segsRetrans"`
	CongestionWin int64     `json:"congestionWin"`
	InBandwidth   int64     `json:"inBandwidth"`
	OutBandwidth  int64     `json:"outBandwidth"`
}

func (s *Service) GetConnectionHistory(localAddr string, localPort int, remoteAddr string, remotePort int) []ConnectionHistoryPoint {
	return nil
}
