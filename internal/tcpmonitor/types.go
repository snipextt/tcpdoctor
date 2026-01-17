package tcpmonitor

import (
	"time"
)

// === Stats Types ===

// BasicStats contains basic TCP connection statistics
type BasicStats struct {
	DataBytesOut uint64
	DataBytesIn  uint64
	DataSegsOut  uint64
	DataSegsIn   uint64
}

// ExtendedStats contains detailed TCP statistics
type ExtendedStats struct {
	// Data Transfer
	TotalSegsOut      uint64
	TotalSegsIn       uint64
	ThruBytesAcked    uint64
	ThruBytesReceived uint64

	// Retransmissions
	SegsRetrans     uint32
	BytesRetrans    uint32
	FastRetrans     uint32
	TimeoutEpisodes uint32

	// RTT Metrics
	SampleRTT   uint32
	SmoothedRTT uint32
	RTTVariance uint32
	MinRTT      uint32
	MaxRTT      uint32

	// Congestion Control
	CurrentCwnd     uint32
	CurrentSsthresh uint32
	SlowStartCount  uint32
	CongAvoidCount  uint32

	// Buffers
	CurRetxQueue uint32
	MaxRetxQueue uint32
	CurAppWQueue uint32
	MaxAppWQueue uint32

	// Bandwidth
	OutboundBandwidth uint64
	InboundBandwidth  uint64

	// NEW: Window Size & Scaling
	WinScaleRcvd uint32
	WinScaleSent uint32 // Note: Windows API returns uint8 but we use uint32 for consistency in JSON
	CurRwinRcvd  uint32
	MaxRwinRcvd  uint32
	CurRwinSent  uint32
	MaxRwinSent  uint32

	// NEW: MSS & PMTU
	CurMss uint32
	MaxMss uint32
	MinMss uint32

	// NEW: SACKs & Duplicate ACKs
	DupAcksIn      uint32
	DupAcksOut     uint32 // From Rec Stats
	SacksRcvd      uint32
	SackBlocksRcvd uint32
	DsackDups      uint32
}

// === Connection Types ===

// ConnectionInfo represents a TCP connection with its statistics
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

	// Raw values from Windows API (for stats API calls)
	RawLocalPort   uint32
	RawRemotePort  uint32
	RawLocalAddr   uint32   // IPv4 only
	RawRemoteAddr  uint32   // IPv4 only
	RawLocalAddr6  [16]byte // IPv6 only
	RawRemoteAddr6 [16]byte // IPv6 only

	// Health indicators
	HighRetransmissionWarning bool
	HighRTTWarning            bool
}

// TCPState represents the state of a TCP connection
type TCPState int

const (
	StateClosed TCPState = iota + 1
	StateListen
	StateSynSent
	StateSynRcvd
	StateEstablished
	StateFinWait1
	StateFinWait2
	StateCloseWait
	StateClosing
	StateLastAck
	StateTimeWait
	StateDeleteTCB
)

// String returns the string representation of a TCP state
func (s TCPState) String() string {
	switch s {
	case StateClosed:
		return "CLOSED"
	case StateListen:
		return "LISTEN"
	case StateSynSent:
		return "SYN_SENT"
	case StateSynRcvd:
		return "SYN_RCVD"
	case StateEstablished:
		return "ESTABLISHED"
	case StateFinWait1:
		return "FIN_WAIT1"
	case StateFinWait2:
		return "FIN_WAIT2"
	case StateCloseWait:
		return "CLOSE_WAIT"
	case StateClosing:
		return "CLOSING"
	case StateLastAck:
		return "LAST_ACK"
	case StateTimeWait:
		return "TIME_WAIT"
	case StateDeleteTCB:
		return "DELETE_TCB"
	}
	return "UNKNOWN"
}

// === Configuration Types ===

// HealthThresholds defines thresholds for health warnings
type HealthThresholds struct {
	RetransmissionRatePercent float64
	HighRTTMilliseconds       uint32
}

func DefaultHealthThresholds() HealthThresholds {
	return HealthThresholds{
		RetransmissionRatePercent: 5.0,
		HighRTTMilliseconds:       200,
	}
}
