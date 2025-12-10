//go:build windows
// +build windows

package winapi

import (
	"encoding/binary"
	"fmt"
	"syscall"
	"unsafe"
)

var (
	iphlpapi = syscall.NewLazyDLL("iphlpapi.dll")
	advapi32 = syscall.NewLazyDLL("advapi32.dll")
	kernel32 = syscall.NewLazyDLL("kernel32.dll")

	procGetExtendedTcpTable       = iphlpapi.NewProc("GetExtendedTcpTable")
	procSetPerTcpConnectionEStats = iphlpapi.NewProc("SetPerTcpConnectionEStats")
	procGetPerTcpConnectionEStats = iphlpapi.NewProc("GetPerTcpConnectionEStats")
	procOpenProcessToken          = advapi32.NewProc("OpenProcessToken")
	procGetTokenInformation       = advapi32.NewProc("GetTokenInformation")
	procGetCurrentProcess         = kernel32.NewProc("GetCurrentProcess")
)

// WindowsAPILayer provides access to Windows TCP statistics APIs
type WindowsAPILayer struct{}

// NewWindowsAPILayer creates a new Windows API layer
func NewWindowsAPILayer() *WindowsAPILayer {
	return &WindowsAPILayer{}
}

// GetExtendedTcpTable retrieves a table of TCP connections
func (w *WindowsAPILayer) GetExtendedTcpTable(family AddressFamily, tableClass TCPTableClass) ([]byte, error) {
	var size uint32 = 0

	// First call to get the required buffer size
	ret, _, _ := procGetExtendedTcpTable.Call(
		0, // pTcpTable (NULL to get size)
		uintptr(unsafe.Pointer(&size)),
		0, // bOrder (unsorted)
		uintptr(family),
		uintptr(tableClass),
		0, // Reserved
	)

	if ret != uintptr(ERROR_INSUFFICIENT_BUFFER) && ret != 0 {
		return nil, fmt.Errorf("GetExtendedTcpTable failed to get buffer size: %d", ret)
	}

	if size == 0 {
		return []byte{}, nil
	}

	// Allocate buffer and make the actual call
	buffer := make([]byte, size)
	ret, _, _ = procGetExtendedTcpTable.Call(
		uintptr(unsafe.Pointer(&buffer[0])),
		uintptr(unsafe.Pointer(&size)),
		0, // bOrder (unsorted)
		uintptr(family),
		uintptr(tableClass),
		0, // Reserved
	)

	if ret != 0 {
		return nil, fmt.Errorf("GetExtendedTcpTable failed: %d", syscall.Errno(ret))
	}

	return buffer, nil
}

// SetPerTcpConnectionEStats enables extended statistics for a TCP connection
func (w *WindowsAPILayer) SetPerTcpConnectionEStats(row interface{}, statsType TCP_ESTATS_TYPE, enable bool) error {
	var rowPtr uintptr
	var version uint32 = 0

	// Determine the row pointer based on type
	switch r := row.(type) {
	case *MIB_TCPROW:
		rowPtr = uintptr(unsafe.Pointer(r))
	case *MIB_TCP6ROW:
		rowPtr = uintptr(unsafe.Pointer(r))
	default:
		return fmt.Errorf("unsupported row type: expected MIB_TCPROW or MIB_TCP6ROW")
	}

	// Create the RW structure to enable/disable collection
	var rw interface{}
	var rwPtr uintptr
	var rwSize uintptr

	var enableValue byte = 0
	if enable {
		enableValue = 1
	}

	switch statsType {
	case TcpConnectionEstatsData:
		rwStruct := TCP_ESTATS_DATA_RW_v0{EnableCollection: enableValue}
		rw = &rwStruct
		rwPtr = uintptr(unsafe.Pointer(&rwStruct))
		rwSize = unsafe.Sizeof(rwStruct)
	case TcpConnectionEstatsSndCong:
		rwStruct := TCP_ESTATS_SND_CONG_RW_v0{EnableCollection: enableValue}
		rw = &rwStruct
		rwPtr = uintptr(unsafe.Pointer(&rwStruct))
		rwSize = unsafe.Sizeof(rwStruct)
	case TcpConnectionEstatsPath:
		rwStruct := TCP_ESTATS_PATH_RW_v0{EnableCollection: enableValue}
		rw = &rwStruct
		rwPtr = uintptr(unsafe.Pointer(&rwStruct))
		rwSize = unsafe.Sizeof(rwStruct)
	case TcpConnectionEstatsRec:
		rwStruct := TCP_ESTATS_REC_RW_v0{EnableCollection: enableValue}
		rw = &rwStruct
		rwPtr = uintptr(unsafe.Pointer(&rwStruct))
		rwSize = unsafe.Sizeof(rwStruct)
	case TcpConnectionEstatsSendBuff:
		rwStruct := TCP_ESTATS_SEND_BUFF_RW_v0{EnableCollection: enableValue}
		rw = &rwStruct
		rwPtr = uintptr(unsafe.Pointer(&rwStruct))
		rwSize = unsafe.Sizeof(rwStruct)
	case TcpConnectionEstatsBandwidth:
		// C# uses the same simple 1-byte struct for ALL types - let's match that
		rwStruct := TCP_ESTATS_DATA_RW_v0{EnableCollection: enableValue}
		rw = &rwStruct
		rwPtr = uintptr(unsafe.Pointer(&rwStruct))
		rwSize = unsafe.Sizeof(rwStruct)
	case TcpConnectionEstatsFineRtt:
		rwStruct := TCP_ESTATS_FINE_RTT_RW_v0{EnableCollection: enableValue}
		rw = &rwStruct
		rwPtr = uintptr(unsafe.Pointer(&rwStruct))
		rwSize = unsafe.Sizeof(rwStruct)
	default:
		return fmt.Errorf("unsupported statistics type: %d", statsType)
	}

	_ = rw // Keep reference to prevent GC

	// SetPerTcpConnectionEStats params: Row, EstatsType, Rw, RwVersion, RwSize, Offset
	ret, _, _ := procSetPerTcpConnectionEStats.Call(
		rowPtr,
		uintptr(statsType),
		rwPtr,
		uintptr(version), // RwVersion
		rwSize,           // RwSize
		0,                // Offset
	)

	if ret != 0 {
		errno := syscall.Errno(ret)
		// Don't treat access denied as a fatal error - just means not admin
		if errno == ERROR_ACCESS_DENIED {
			return fmt.Errorf("access denied (administrator privileges required): %w", errno)
		}
		return fmt.Errorf("SetPerTcpConnectionEStats failed: %w", errno)
	}

	return nil
}

// GetPerTcpConnectionEStats retrieves extended statistics for a TCP connection
func (w *WindowsAPILayer) GetPerTcpConnectionEStats(row interface{}, statsType TCP_ESTATS_TYPE) (interface{}, error) {
	var rowPtr uintptr
	var version uint32 = 0

	// Determine the row pointer based on type (must use MIB_TCPROW/MIB_TCP6ROW, not OWNER_PID variants)
	switch r := row.(type) {
	case *MIB_TCPROW:
		rowPtr = uintptr(unsafe.Pointer(r))
	case *MIB_TCP6ROW:
		rowPtr = uintptr(unsafe.Pointer(r))
	default:
		return nil, fmt.Errorf("unsupported row type: expected MIB_TCPROW or MIB_TCP6ROW")
	}

	// Create the ROD structure to receive statistics
	// Like C#, we allocate a buffer and ZERO it first to avoid reading garbage if API fails
	var rod interface{}
	var rodSize uintptr

	switch statsType {
	case TcpConnectionEstatsData:
		rodSize = unsafe.Sizeof(TCP_ESTATS_DATA_ROD_v0{})
	case TcpConnectionEstatsSndCong:
		rodSize = unsafe.Sizeof(TCP_ESTATS_SND_CONG_ROD_v0{})
	case TcpConnectionEstatsPath:
		rodSize = unsafe.Sizeof(TCP_ESTATS_PATH_ROD_v0{})
	case TcpConnectionEstatsRec:
		rodSize = unsafe.Sizeof(TCP_ESTATS_REC_ROD_v0{})
	case TcpConnectionEstatsSendBuff:
		rodSize = unsafe.Sizeof(TCP_ESTATS_SEND_BUFF_ROD_v0{})
	case TcpConnectionEstatsBandwidth:
		// Windows struct is 34 bytes, but we allocate 40 (Go struct size)
		// and tell Windows API to write only 34 bytes
		rodSize = 34
	case TcpConnectionEstatsFineRtt:
		rodSize = unsafe.Sizeof(TCP_ESTATS_FINE_RTT_ROD_v0{})
	default:
		return nil, fmt.Errorf("unsupported statistics type: %d", statsType)
	}

	// Allocate and zero the buffer (like C# Marshal.AllocHGlobal + zeroing)
	buffer := make([]byte, rodSize)
	for i := range buffer {
		buffer[i] = 0
	}
	rodPtr := uintptr(unsafe.Pointer(&buffer[0]))

	// GetPerTcpConnectionEStats params: Row, EstatsType, Rw, RwVersion, RwSize, Ros, RosVersion, RosSize, Rod, RodVersion, RodSize
	ret, _, _ := procGetPerTcpConnectionEStats.Call(
		rowPtr,
		uintptr(statsType),
		0,                // Rw (NULL - not reading RW)
		uintptr(version), // RwVersion
		0,                // RwSize
		0,                // Ros (NULL - not reading static)
		uintptr(version), // RosVersion
		0,                // RosSize
		rodPtr,           // Rod
		uintptr(version), // RodVersion
		rodSize,          // RodSize
	)

	if ret != 0 {
		errno := syscall.Errno(ret)
		return nil, fmt.Errorf("GetPerTcpConnectionEStats failed: %w", errno)
	}

	// Copy the buffer data to a properly typed struct (like C# Marshal.PtrToStructure)
	// We create new structs and copy the values to avoid returning pointers to the buffer
	switch statsType {
	case TcpConnectionEstatsData:
		src := (*TCP_ESTATS_DATA_ROD_v0)(unsafe.Pointer(&buffer[0]))
		result := *src // Copy the struct
		rod = &result
	case TcpConnectionEstatsSndCong:
		src := (*TCP_ESTATS_SND_CONG_ROD_v0)(unsafe.Pointer(&buffer[0]))
		result := *src
		rod = &result
	case TcpConnectionEstatsPath:
		src := (*TCP_ESTATS_PATH_ROD_v0)(unsafe.Pointer(&buffer[0]))
		result := *src
		rod = &result
	case TcpConnectionEstatsRec:
		src := (*TCP_ESTATS_REC_ROD_v0)(unsafe.Pointer(&buffer[0]))
		result := *src
		rod = &result
	case TcpConnectionEstatsSendBuff:
		src := (*TCP_ESTATS_SEND_BUFF_ROD_v0)(unsafe.Pointer(&buffer[0]))
		result := *src
		rod = &result
	case TcpConnectionEstatsBandwidth:
		// Buffer is 34 bytes, but Go struct is 40 bytes due to alignment
		// We must manually extract the values from the buffer
		result := TCP_ESTATS_BANDWIDTH_ROD_v0{
			OutboundBandwidth:       binary.LittleEndian.Uint64(buffer[0:8]),
			InboundBandwidth:        binary.LittleEndian.Uint64(buffer[8:16]),
			OutboundInstability:     binary.LittleEndian.Uint64(buffer[16:24]),
			InboundInstability:      binary.LittleEndian.Uint64(buffer[24:32]),
			OutboundBandwidthPeaked: buffer[32],
			InboundBandwidthPeaked:  buffer[33],
		}
		rod = &result
	case TcpConnectionEstatsFineRtt:
		src := (*TCP_ESTATS_FINE_RTT_ROD_v0)(unsafe.Pointer(&buffer[0]))
		result := *src
		rod = &result
	}

	return rod, nil
}

// IsAdministrator checks if the current process has administrator privileges
func (w *WindowsAPILayer) IsAdministrator() bool {
	var token syscall.Token

	// Get current process handle
	proc, _, _ := procGetCurrentProcess.Call()

	// Open process token
	ret, _, _ := procOpenProcessToken.Call(
		proc,
		syscall.TOKEN_QUERY,
		uintptr(unsafe.Pointer(&token)),
	)

	if ret == 0 {
		return false
	}
	defer token.Close()

	// Get token elevation information
	const TokenElevation = 20
	type TOKEN_ELEVATION struct {
		TokenIsElevated uint32
	}

	var elevation TOKEN_ELEVATION
	var returnLength uint32

	ret, _, _ = procGetTokenInformation.Call(
		uintptr(token),
		TokenElevation,
		uintptr(unsafe.Pointer(&elevation)),
		unsafe.Sizeof(elevation),
		uintptr(unsafe.Pointer(&returnLength)),
	)

	if ret == 0 {
		return false
	}

	return elevation.TokenIsElevated != 0
}
