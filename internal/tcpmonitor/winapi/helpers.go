//go:build windows
// +build windows

package winapi

import (
	"encoding/binary"
	"fmt"
	"net"
)

// ConvertPort converts a port from network byte order to host byte order
func ConvertPort(port uint32) uint16 {
	// Windows stores ports in network byte order (big-endian) in the low 16 bits
	// We need to swap bytes to convert to host byte order (little-endian on x86)
	p := uint16(port)
	return (p >> 8) | (p << 8)
}

// ConvertIPv4Address converts an IPv4 address from uint32 to string
func ConvertIPv4Address(addr uint32) string {
	// Windows stores IPv4 addresses in network byte order
	ip := net.IPv4(
		byte(addr),
		byte(addr>>8),
		byte(addr>>16),
		byte(addr>>24),
	)
	return ip.String()
}

// ConvertIPv6Address converts an IPv6 address from byte array to string
func ConvertIPv6Address(addr [16]byte) string {
	ip := net.IP(addr[:])
	return ip.String()
}

// ParseTCPTable parses a buffer containing MIB_TCPTABLE_OWNER_PID
func ParseTCPTable(buffer []byte) ([]MIB_TCPROW_OWNER_PID, error) {
	if len(buffer) < 4 {
		return nil, fmt.Errorf("buffer too small for TCP table")
	}

	// Read number of entries
	numEntries := binary.LittleEndian.Uint32(buffer[0:4])

	if numEntries == 0 {
		return []MIB_TCPROW_OWNER_PID{}, nil
	}

	// Calculate expected size
	rowSize := sizeofMIB_TCPROW_OWNER_PID()
	expectedSize := 4 + int(numEntries)*rowSize

	if len(buffer) < expectedSize {
		return nil, fmt.Errorf("buffer too small for %d entries (expected %d, got %d)",
			numEntries, expectedSize, len(buffer))
	}

	// Parse rows
	rows := make([]MIB_TCPROW_OWNER_PID, numEntries)
	offset := 4

	for i := uint32(0); i < numEntries; i++ {
		row := &rows[i]
		row.State = binary.LittleEndian.Uint32(buffer[offset : offset+4])
		row.LocalAddr = binary.LittleEndian.Uint32(buffer[offset+4 : offset+8])
		row.LocalPort = binary.LittleEndian.Uint32(buffer[offset+8 : offset+12])
		row.RemoteAddr = binary.LittleEndian.Uint32(buffer[offset+12 : offset+16])
		row.RemotePort = binary.LittleEndian.Uint32(buffer[offset+16 : offset+20])
		row.OwningPid = binary.LittleEndian.Uint32(buffer[offset+20 : offset+24])
		offset += rowSize
	}

	return rows, nil
}

// ParseTCP6Table parses a buffer containing MIB_TCP6TABLE_OWNER_PID
func ParseTCP6Table(buffer []byte) ([]MIB_TCP6ROW_OWNER_PID, error) {
	if len(buffer) < 4 {
		return nil, fmt.Errorf("buffer too small for TCP6 table")
	}

	// Read number of entries
	numEntries := binary.LittleEndian.Uint32(buffer[0:4])

	if numEntries == 0 {
		return []MIB_TCP6ROW_OWNER_PID{}, nil
	}

	// Calculate expected size
	rowSize := sizeofMIB_TCP6ROW_OWNER_PID()
	expectedSize := 4 + int(numEntries)*rowSize

	if len(buffer) < expectedSize {
		return nil, fmt.Errorf("buffer too small for %d entries (expected %d, got %d)",
			numEntries, expectedSize, len(buffer))
	}

	// Parse rows
	rows := make([]MIB_TCP6ROW_OWNER_PID, numEntries)
	offset := 4

	for i := uint32(0); i < numEntries; i++ {
		row := &rows[i]
		copy(row.LocalAddr[:], buffer[offset:offset+16])
		row.LocalScopeId = binary.LittleEndian.Uint32(buffer[offset+16 : offset+20])
		row.LocalPort = binary.LittleEndian.Uint32(buffer[offset+20 : offset+24])
		copy(row.RemoteAddr[:], buffer[offset+24:offset+40])
		row.RemoteScopeId = binary.LittleEndian.Uint32(buffer[offset+40 : offset+44])
		row.RemotePort = binary.LittleEndian.Uint32(buffer[offset+44 : offset+48])
		row.State = binary.LittleEndian.Uint32(buffer[offset+48 : offset+52])
		row.OwningPid = binary.LittleEndian.Uint32(buffer[offset+52 : offset+56])
		offset += rowSize
	}

	return rows, nil
}

// TCPStateToString converts a TCP state constant to a readable string
func TCPStateToString(state TCPState) string {
	switch state {
	case MIB_TCP_STATE_CLOSED:
		return "CLOSED"
	case MIB_TCP_STATE_LISTEN:
		return "LISTEN"
	case MIB_TCP_STATE_SYN_SENT:
		return "SYN_SENT"
	case MIB_TCP_STATE_SYN_RCVD:
		return "SYN_RCVD"
	case MIB_TCP_STATE_ESTAB:
		return "ESTABLISHED"
	case MIB_TCP_STATE_FIN_WAIT1:
		return "FIN_WAIT1"
	case MIB_TCP_STATE_FIN_WAIT2:
		return "FIN_WAIT2"
	case MIB_TCP_STATE_CLOSE_WAIT:
		return "CLOSE_WAIT"
	case MIB_TCP_STATE_CLOSING:
		return "CLOSING"
	case MIB_TCP_STATE_LAST_ACK:
		return "LAST_ACK"
	case MIB_TCP_STATE_TIME_WAIT:
		return "TIME_WAIT"
	case MIB_TCP_STATE_DELETE_TCB:
		return "DELETE_TCB"
	default:
		return fmt.Sprintf("UNKNOWN(%d)", state)
	}
}
