//go:build windows
// +build windows

package winapi

import (
	"syscall"
	"unsafe"
)

// AddressFamily represents IPv4 or IPv6
type AddressFamily uint32

const (
	AF_INET  AddressFamily = 2  // IPv4
	AF_INET6 AddressFamily = 23 // IPv6
)

// TCPTableClass specifies the type of TCP table to retrieve
type TCPTableClass uint32

const (
	TCP_TABLE_BASIC_LISTENER TCPTableClass = iota
	TCP_TABLE_BASIC_CONNECTIONS
	TCP_TABLE_BASIC_ALL
	TCP_TABLE_OWNER_PID_LISTENER
	TCP_TABLE_OWNER_PID_CONNECTIONS
	TCP_TABLE_OWNER_PID_ALL
	TCP_TABLE_OWNER_MODULE_LISTENER
	TCP_TABLE_OWNER_MODULE_CONNECTIONS
	TCP_TABLE_OWNER_MODULE_ALL
)

// TCPState represents the state of a TCP connection
type TCPState uint32

const (
	MIB_TCP_STATE_CLOSED TCPState = iota + 1
	MIB_TCP_STATE_LISTEN
	MIB_TCP_STATE_SYN_SENT
	MIB_TCP_STATE_SYN_RCVD
	MIB_TCP_STATE_ESTAB
	MIB_TCP_STATE_FIN_WAIT1
	MIB_TCP_STATE_FIN_WAIT2
	MIB_TCP_STATE_CLOSE_WAIT
	MIB_TCP_STATE_CLOSING
	MIB_TCP_STATE_LAST_ACK
	MIB_TCP_STATE_TIME_WAIT
	MIB_TCP_STATE_DELETE_TCB
)

// MIB_TCPROW represents a single IPv4 TCP connection (used for extended stats APIs)
type MIB_TCPROW struct {
	State      uint32
	LocalAddr  uint32
	LocalPort  uint32
	RemoteAddr uint32
	RemotePort uint32
}

// MIB_TCPROW_OWNER_PID represents a single IPv4 TCP connection with PID
type MIB_TCPROW_OWNER_PID struct {
	State      uint32
	LocalAddr  uint32
	LocalPort  uint32
	RemoteAddr uint32
	RemotePort uint32
	OwningPid  uint32
}

// MIB_TCPTABLE_OWNER_PID represents a table of IPv4 TCP connections
type MIB_TCPTABLE_OWNER_PID struct {
	NumEntries uint32
	Table      [1]MIB_TCPROW_OWNER_PID
}

// MIB_TCP6ROW represents a single IPv6 TCP connection (used for extended stats APIs)
type MIB_TCP6ROW struct {
	LocalAddr     [16]byte
	LocalScopeId  uint32
	LocalPort     uint32
	RemoteAddr    [16]byte
	RemoteScopeId uint32
	RemotePort    uint32
	State         uint32
}

// MIB_TCP6ROW_OWNER_PID represents a single IPv6 TCP connection with PID
type MIB_TCP6ROW_OWNER_PID struct {
	LocalAddr     [16]byte
	LocalScopeId  uint32
	LocalPort     uint32
	RemoteAddr    [16]byte
	RemoteScopeId uint32
	RemotePort    uint32
	State         uint32
	OwningPid     uint32
}

// MIB_TCP6TABLE_OWNER_PID represents a table of IPv6 TCP connections
type MIB_TCP6TABLE_OWNER_PID struct {
	NumEntries uint32
	Table      [1]MIB_TCP6ROW_OWNER_PID
}

// TCP_ESTATS_TYPE represents the type of extended statistics
type TCP_ESTATS_TYPE int32

const (
	TcpConnectionEstatsSynOpts TCP_ESTATS_TYPE = iota
	TcpConnectionEstatsData
	TcpConnectionEstatsSndCong
	TcpConnectionEstatsPath
	TcpConnectionEstatsSendBuff
	TcpConnectionEstatsRec
	TcpConnectionEstatsObsRec
	TcpConnectionEstatsBandwidth
	TcpConnectionEstatsFineRtt
	TcpConnectionEstatsMaximum
)

// TCP_BOOLEAN_OPTIONAL represents an optional boolean value
type TCP_BOOLEAN_OPTIONAL int32

const (
	TcpBoolOptDisabled TCP_BOOLEAN_OPTIONAL = iota
	TcpBoolOptEnabled
	TcpBoolOptUnchanged
)

// TCP_ESTATS_DATA_ROD_v0 contains data transfer statistics
// Go and Windows use same natural alignment rules - no explicit padding needed
type TCP_ESTATS_DATA_ROD_v0 struct {
	DataBytesOut      uint64
	DataSegsOut       uint64
	DataBytesIn       uint64
	DataSegsIn        uint64
	SegsOut           uint64
	SegsIn            uint64
	SoftErrors        uint32
	SoftErrorReason   uint32
	SndUna            uint32
	SndNxt            uint32
	SndMax            uint32
	ThruBytesAcked    uint64
	RcvNxt            uint32
	ThruBytesReceived uint64
	SegsRetrans       uint32
	BytesRetrans      uint32
	FastRetran        uint32
	DupAcksIn         uint32
	TimeoutEpisodes   uint32
	SynRetrans        uint8
}

// TCP_ESTATS_SND_CONG_ROD_v0 contains congestion control statistics
// Field order MUST match Windows API exactly: Trans/Time/Bytes for each limit type
type TCP_ESTATS_SND_CONG_ROD_v0 struct {
	SndLimTransRwin uint32
	SndLimTimeRwin  uint32
	SndLimBytesRwin uint32 // was missing
	SndLimTransCwnd uint32
	SndLimTimeCwnd  uint32
	SndLimBytesCwnd uint32 // was missing
	SndLimTransSnd  uint32
	SndLimTimeSnd   uint32
	SndLimBytesSnd  uint32 // was missing
	SlowStart       uint32
	CongAvoid       uint32
	OtherReductions uint32
	CurCwnd         uint32
	MaxSsCwnd       uint32
	MaxCaCwnd       uint32
	CurSsthresh     uint32
	MaxSsthresh     uint32
	MinSsthresh     uint32
}

// TCP_ESTATS_PATH_ROD_v0 contains path statistics including RTT
type TCP_ESTATS_PATH_ROD_v0 struct {
	FastRetran            uint32
	Timeouts              uint32
	SubsequentTimeouts    uint32
	CurTimeoutCount       uint32
	AbruptTimeouts        uint32
	PktsRetrans           uint32
	BytesRetrans          uint32
	DupAcksIn             uint32
	SacksRcvd             uint32
	SackBlocksRcvd        uint32
	CongSignals           uint32
	PreCongSumCwnd        uint32
	PreCongSumRtt         uint32
	PostCongSumRtt        uint32
	PostCongCountRtt      uint32
	EcnSignals            uint32
	EceRcvd               uint32
	SendStall             uint32
	QuenchRcvd            uint32
	RetranThresh          uint32
	SndDupAckEpisodes     uint32
	SumBytesReordered     uint32
	NonRecovDa            uint32
	NonRecovDaEpisodes    uint32
	AckAfterFr            uint32
	DsackDups             uint32
	SampleRtt             uint32
	SmoothedRtt           uint32
	RttVar                uint32
	MaxRtt                uint32
	MinRtt                uint32
	SumRtt                uint32
	CountRtt              uint32
	CurRto                uint32
	MaxRto                uint32
	MinRto                uint32
	CurMss                uint32
	MaxMss                uint32
	MinMss                uint32
	SpuriousRtoDetections uint32
}

// TCP_ESTATS_REC_ROD_v0 contains receiver statistics
// Layout must match Windows exactly: 13 uint32s, 2 bytes, then 3 more uint32s
type TCP_ESTATS_REC_ROD_v0 struct {
	CurRwinSent    uint32
	MaxRwinSent    uint32
	MinRwinSent    uint32
	LimRwin        uint32
	DupAckEpisodes uint32
	DupAcksOut     uint32
	CeRcvd         uint32
	EcnSent        uint32
	EcnNoncesRcvd  uint32
	CurReasmQueue  uint32
	MaxReasmQueue  uint32
	CurAppRQueue   uint32
	MaxAppRQueue   uint32
	WinScaleRcvd   uint8 // was missing - comes before WinScaleSent
	WinScaleSent   uint8
	_              [2]byte // padding to align next uint32
	CurRwinRcvd    uint32  // was missing
	MaxRwinRcvd    uint32  // was missing
	MinRwinRcvd    uint32  // was missing
}

// TCP_ESTATS_SEND_BUFF_ROD_v0 contains send buffer statistics
type TCP_ESTATS_SEND_BUFF_ROD_v0 struct {
	CurRetxQueue uint32
	MaxRetxQueue uint32
	CurAppWQueue uint32
	MaxAppWQueue uint32
}

// TCP_ESTATS_BANDWIDTH_ROD_v0 contains bandwidth estimates
// Note: No padding - Windows struct is packed
type TCP_ESTATS_BANDWIDTH_ROD_v0 struct {
	OutboundBandwidth       uint64
	InboundBandwidth        uint64
	OutboundInstability     uint64
	InboundInstability      uint64
	OutboundBandwidthPeaked uint8
	InboundBandwidthPeaked  uint8
}

// TCP_ESTATS_FINE_RTT_ROD_v0 contains fine-grained RTT statistics
type TCP_ESTATS_FINE_RTT_ROD_v0 struct {
	RttVar uint32
	MaxRtt uint32
	MinRtt uint32
	SumRtt uint32
}

// TCP_ESTATS_DATA_RW_v0 is used to enable/disable data statistics
// All RW structures have the same layout - just a single byte for EnableCollection
type TCP_ESTATS_DATA_RW_v0 struct {
	EnableCollection byte
}

// TCP_ESTATS_SND_CONG_RW_v0 is used to enable/disable congestion statistics
type TCP_ESTATS_SND_CONG_RW_v0 struct {
	EnableCollection byte
}

// TCP_ESTATS_PATH_RW_v0 is used to enable/disable path statistics
type TCP_ESTATS_PATH_RW_v0 struct {
	EnableCollection byte
}

// TCP_ESTATS_REC_RW_v0 is used to enable/disable receiver statistics
type TCP_ESTATS_REC_RW_v0 struct {
	EnableCollection byte
}

// TCP_ESTATS_SEND_BUFF_RW_v0 is used to enable/disable send buffer statistics
type TCP_ESTATS_SEND_BUFF_RW_v0 struct {
	EnableCollection byte
}

// TCP_ESTATS_BANDWIDTH_RW_v0 is used to enable/disable bandwidth statistics
// Note: Unlike other RW structs, this has TWO fields - one for each direction
type TCP_ESTATS_BANDWIDTH_RW_v0 struct {
	EnableCollectionOutbound byte
	EnableCollectionInbound  byte
}

// TCP_ESTATS_FINE_RTT_RW_v0 is used to enable/disable fine RTT statistics
type TCP_ESTATS_FINE_RTT_RW_v0 struct {
	EnableCollection byte
}

// Windows error codes
const (
	ERROR_INSUFFICIENT_BUFFER = syscall.Errno(122)
	ERROR_INVALID_PARAMETER   = syscall.Errno(87)
	ERROR_NOT_SUPPORTED       = syscall.Errno(50)
	ERROR_ACCESS_DENIED       = syscall.Errno(5)
)

// Helper function to get the size of a structure
func sizeofMIB_TCPROW_OWNER_PID() int {
	return int(unsafe.Sizeof(MIB_TCPROW_OWNER_PID{}))
}

func sizeofMIB_TCP6ROW_OWNER_PID() int {
	return int(unsafe.Sizeof(MIB_TCP6ROW_OWNER_PID{}))
}
