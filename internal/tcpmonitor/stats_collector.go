//go:build windows
// +build windows

package tcpmonitor

import (
	"fmt"
	"net"
	"time"

	"tcpdoctor/internal/tcpmonitor/winapi"
)

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
}

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
	default:
		return fmt.Sprintf("UNKNOWN(%d)", s)
	}
}

// StatsCollector interfaces with Windows APIs to collect TCP statistics
type StatsCollector struct {
	apiLayer *winapi.WindowsAPILayer
	isAdmin  bool
	logger   *Logger
}

// NewStatsCollector creates a new statistics collector
func NewStatsCollector(apiLayer *winapi.WindowsAPILayer, isAdmin bool) *StatsCollector {
	return &StatsCollector{
		apiLayer: apiLayer,
		isAdmin:  isAdmin,
		logger:   GetLogger(),
	}
}

// CollectIPv4Connections retrieves all IPv4 TCP connections
func (sc *StatsCollector) CollectIPv4Connections() ([]ConnectionInfo, error) {
	sc.logger.Debug("Collecting IPv4 connections")

	// Get the TCP table from Windows API
	buffer, err := sc.apiLayer.GetExtendedTcpTable(winapi.AF_INET, winapi.TCP_TABLE_OWNER_PID_ALL)
	if err != nil {
		return nil, NewAPIError("GetExtendedTcpTable(IPv4)", err)
	}

	// Parse the buffer into TCP rows
	rows, err := winapi.ParseTCPTable(buffer)
	if err != nil {
		return nil, NewAPIError("ParseTCPTable", err)
	}

	sc.logger.Debug("Found %d IPv4 connections", len(rows))

	// Convert rows to ConnectionInfo
	connections := make([]ConnectionInfo, 0, len(rows))
	now := time.Now()

	for _, row := range rows {
		conn := ConnectionInfo{
			LocalAddr:  winapi.ConvertIPv4Address(row.LocalAddr),
			LocalPort:  winapi.ConvertPort(row.LocalPort),
			RemoteAddr: winapi.ConvertIPv4Address(row.RemoteAddr),
			RemotePort: winapi.ConvertPort(row.RemotePort),
			State:      convertWinAPIState(winapi.TCPState(row.State)),
			PID:        row.OwningPid,
			IsIPv6:     false,
			LastSeen:   now,
		}

		connections = append(connections, conn)
	}

	return connections, nil
}

// CollectIPv6Connections retrieves all IPv6 TCP connections
func (sc *StatsCollector) CollectIPv6Connections() ([]ConnectionInfo, error) {
	sc.logger.Debug("Collecting IPv6 connections")

	// Get the TCP table from Windows API
	buffer, err := sc.apiLayer.GetExtendedTcpTable(winapi.AF_INET6, winapi.TCP_TABLE_OWNER_PID_ALL)
	if err != nil {
		return nil, NewAPIError("GetExtendedTcpTable(IPv6)", err)
	}

	// Parse the buffer into TCP rows
	rows, err := winapi.ParseTCP6Table(buffer)
	if err != nil {
		return nil, NewAPIError("ParseTCP6Table", err)
	}

	sc.logger.Debug("Found %d IPv6 connections", len(rows))

	// Convert rows to ConnectionInfo
	connections := make([]ConnectionInfo, 0, len(rows))
	now := time.Now()

	for _, row := range rows {
		conn := ConnectionInfo{
			LocalAddr:  winapi.ConvertIPv6Address(row.LocalAddr),
			LocalPort:  winapi.ConvertPort(row.LocalPort),
			RemoteAddr: winapi.ConvertIPv6Address(row.RemoteAddr),
			RemotePort: winapi.ConvertPort(row.RemotePort),
			State:      convertWinAPIState(winapi.TCPState(row.State)),
			PID:        row.OwningPid,
			IsIPv6:     true,
			LastSeen:   now,
		}

		connections = append(connections, conn)
	}

	return connections, nil
}

// EnableExtendedStats enables extended statistics collection for a connection
func (sc *StatsCollector) EnableExtendedStats(conn *ConnectionInfo) error {
	if !sc.isAdmin {
		sc.logger.Debug("Skipping extended stats enablement (not admin)")
		return ErrAccessDenied
	}

	sc.logger.Debug("Enabling extended stats for %s:%d -> %s:%d",
		conn.LocalAddr, conn.LocalPort, conn.RemoteAddr, conn.RemotePort)

	// Create the appropriate row structure based on IP version
	var row interface{}
	if conn.IsIPv6 {
		row = sc.createTCP6Row(conn)
	} else {
		row = sc.createTCPRow(conn)
	}

	// Enable all statistics types
	statsTypes := []winapi.TCP_ESTATS_TYPE{
		winapi.TcpConnectionEstatsData,
		winapi.TcpConnectionEstatsSndCong,
		winapi.TcpConnectionEstatsPath,
		winapi.TcpConnectionEstatsRec,
		winapi.TcpConnectionEstatsSendBuff,
		winapi.TcpConnectionEstatsBandwidth,
		winapi.TcpConnectionEstatsFineRtt,
	}

	var lastErr error
	successCount := 0

	for _, statsType := range statsTypes {
		err := sc.apiLayer.SetPerTcpConnectionEStats(row, statsType, true)
		if err != nil {
			// These failures are expected for connections in transient states
			sc.logger.Debug("Failed to enable stats type %d: %v", statsType, err)
			lastErr = err
		} else {
			successCount++
		}
	}

	sc.logger.Debug("Enabled %d/%d statistics types", successCount, len(statsTypes))

	// If we couldn't enable any stats, return the last error
	if successCount == 0 && lastErr != nil {
		return lastErr
	}

	return nil
}

// GetExtendedStats retrieves extended statistics for a connection
func (sc *StatsCollector) GetExtendedStats(conn *ConnectionInfo) (*ExtendedStats, error) {
	sc.logger.Debug("Getting extended stats for %s:%d -> %s:%d",
		conn.LocalAddr, conn.LocalPort, conn.RemoteAddr, conn.RemotePort)

	// Create the appropriate row structure based on IP version
	var row interface{}
	if conn.IsIPv6 {
		row = sc.createTCP6Row(conn)
	} else {
		row = sc.createTCPRow(conn)
	}

	stats := &ExtendedStats{}

	// Retrieve data transfer statistics
	if dataStats, err := sc.getDataStats(row); err == nil {
		stats.TotalSegsOut = dataStats.SegsOut
		stats.TotalSegsIn = dataStats.SegsIn
		stats.ThruBytesAcked = dataStats.ThruBytesAcked
		stats.ThruBytesReceived = dataStats.ThruBytesReceived
	} else {
		sc.logger.Debug("Failed to get data stats: %v", err)
	}

	// Retrieve path statistics (includes RTT and retransmissions)
	if pathStats, err := sc.getPathStats(row); err == nil {
		stats.SegsRetrans = pathStats.PktsRetrans
		stats.BytesRetrans = pathStats.BytesRetrans
		stats.FastRetrans = pathStats.FastRetran
		stats.TimeoutEpisodes = pathStats.Timeouts
		stats.SampleRTT = pathStats.SampleRtt
		stats.SmoothedRTT = pathStats.SmoothedRtt
		stats.RTTVariance = pathStats.RttVar
		stats.MinRTT = pathStats.MinRtt
		stats.MaxRTT = pathStats.MaxRtt
	} else {
		sc.logger.Debug("Failed to get path stats: %v", err)
	}

	// Retrieve congestion control statistics
	if congStats, err := sc.getCongestionStats(row); err == nil {
		stats.CurrentCwnd = congStats.CurCwnd
		stats.CurrentSsthresh = congStats.CurSsthresh
		stats.SlowStartCount = congStats.SlowStart
		stats.CongAvoidCount = congStats.CongAvoid
	} else {
		sc.logger.Debug("Failed to get congestion stats: %v", err)
	}

	// Retrieve send buffer statistics
	if sendBuffStats, err := sc.getSendBuffStats(row); err == nil {
		stats.CurRetxQueue = sendBuffStats.CurRetxQueue
		stats.MaxRetxQueue = sendBuffStats.MaxRetxQueue
		stats.CurAppWQueue = sendBuffStats.CurAppWQueue
		stats.MaxAppWQueue = sendBuffStats.MaxAppWQueue
	} else {
		sc.logger.Debug("Failed to get send buffer stats: %v", err)
	}

	// Retrieve bandwidth statistics
	if bwStats, err := sc.getBandwidthStats(row); err == nil {
		stats.OutboundBandwidth = bwStats.OutboundBandwidth
		stats.InboundBandwidth = bwStats.InboundBandwidth
	} else {
		sc.logger.Debug("Failed to get bandwidth stats: %v", err)
	}

	return stats, nil
}

// Helper methods to retrieve specific statistics types

func (sc *StatsCollector) getDataStats(row interface{}) (*winapi.TCP_ESTATS_DATA_ROD_v0, error) {
	result, err := sc.apiLayer.GetPerTcpConnectionEStats(row, winapi.TcpConnectionEstatsData)
	if err != nil {
		return nil, err
	}

	stats, ok := result.(*winapi.TCP_ESTATS_DATA_ROD_v0)
	if !ok {
		return nil, fmt.Errorf("unexpected type for data stats")
	}

	return stats, nil
}

func (sc *StatsCollector) getPathStats(row interface{}) (*winapi.TCP_ESTATS_PATH_ROD_v0, error) {
	result, err := sc.apiLayer.GetPerTcpConnectionEStats(row, winapi.TcpConnectionEstatsPath)
	if err != nil {
		return nil, err
	}

	stats, ok := result.(*winapi.TCP_ESTATS_PATH_ROD_v0)
	if !ok {
		return nil, fmt.Errorf("unexpected type for path stats")
	}

	return stats, nil
}

func (sc *StatsCollector) getCongestionStats(row interface{}) (*winapi.TCP_ESTATS_SND_CONG_ROD_v0, error) {
	result, err := sc.apiLayer.GetPerTcpConnectionEStats(row, winapi.TcpConnectionEstatsSndCong)
	if err != nil {
		return nil, err
	}

	stats, ok := result.(*winapi.TCP_ESTATS_SND_CONG_ROD_v0)
	if !ok {
		return nil, fmt.Errorf("unexpected type for congestion stats")
	}

	return stats, nil
}

func (sc *StatsCollector) getSendBuffStats(row interface{}) (*winapi.TCP_ESTATS_SEND_BUFF_ROD_v0, error) {
	result, err := sc.apiLayer.GetPerTcpConnectionEStats(row, winapi.TcpConnectionEstatsSendBuff)
	if err != nil {
		return nil, err
	}

	stats, ok := result.(*winapi.TCP_ESTATS_SEND_BUFF_ROD_v0)
	if !ok {
		return nil, fmt.Errorf("unexpected type for send buffer stats")
	}

	return stats, nil
}

func (sc *StatsCollector) getBandwidthStats(row interface{}) (*winapi.TCP_ESTATS_BANDWIDTH_ROD_v0, error) {
	result, err := sc.apiLayer.GetPerTcpConnectionEStats(row, winapi.TcpConnectionEstatsBandwidth)
	if err != nil {
		return nil, err
	}

	stats, ok := result.(*winapi.TCP_ESTATS_BANDWIDTH_ROD_v0)
	if !ok {
		return nil, fmt.Errorf("unexpected type for bandwidth stats")
	}

	return stats, nil
}

// Helper methods to create row structures for API calls
// Note: Extended stats APIs require MIB_TCPROW/MIB_TCP6ROW (without PID)

func (sc *StatsCollector) createTCPRow(conn *ConnectionInfo) *winapi.MIB_TCPROW {
	return &winapi.MIB_TCPROW{
		State:      uint32(convertToWinAPIState(conn.State)),
		LocalAddr:  sc.ipv4StringToUint32(conn.LocalAddr),
		LocalPort:  sc.portToNetworkOrder(conn.LocalPort),
		RemoteAddr: sc.ipv4StringToUint32(conn.RemoteAddr),
		RemotePort: sc.portToNetworkOrder(conn.RemotePort),
	}
}

func (sc *StatsCollector) createTCP6Row(conn *ConnectionInfo) *winapi.MIB_TCP6ROW {
	return &winapi.MIB_TCP6ROW{
		LocalAddr:     sc.ipv6StringToBytes(conn.LocalAddr),
		LocalScopeId:  0,
		LocalPort:     sc.portToNetworkOrder(conn.LocalPort),
		RemoteAddr:    sc.ipv6StringToBytes(conn.RemoteAddr),
		RemoteScopeId: 0,
		RemotePort:    sc.portToNetworkOrder(conn.RemotePort),
		State:         uint32(convertToWinAPIState(conn.State)),
	}
}

// Helper conversion functions

func convertWinAPIState(state winapi.TCPState) TCPState {
	return TCPState(state)
}

func convertToWinAPIState(state TCPState) winapi.TCPState {
	return winapi.TCPState(state)
}

func (sc *StatsCollector) ipv4StringToUint32(addr string) uint32 {
	// Parse the IP address string
	var a, b, c, d uint32
	fmt.Sscanf(addr, "%d.%d.%d.%d", &a, &b, &c, &d)
	// Windows stores IPv4 addresses in network byte order
	return a | (b << 8) | (c << 16) | (d << 24)
}

func (sc *StatsCollector) ipv6StringToBytes(addr string) [16]byte {
	var result [16]byte
	// Parse IPv6 address using net.ParseIP
	ip := net.ParseIP(addr)
	if ip != nil {
		// net.ParseIP returns 16 bytes for IPv6
		ipv6 := ip.To16()
		if ipv6 != nil {
			copy(result[:], ipv6)
		}
	}
	return result
}

func (sc *StatsCollector) portToNetworkOrder(port uint16) uint32 {
	// Convert port to network byte order (big-endian) as uint32
	return uint32(port>>8) | uint32(port<<8)
}
