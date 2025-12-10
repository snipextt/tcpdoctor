//go:build windows
// +build windows

package tcpmonitor

import (
	"net"
	"strings"
)

// FilterOptions defines the criteria for filtering connections
type FilterOptions struct {
	PID             *uint32   // Filter by process ID (nil means no filter)
	Port            *uint16   // Filter by port number (local or remote, nil means no filter)
	State           *TCPState // Filter by connection state (nil means no filter)
	IPv4Only        bool      // Show only IPv4 connections
	IPv6Only        bool      // Show only IPv6 connections
	ExcludeInternal bool      // Hide connections where both endpoints are internal/private IPs
	SearchText      string    // Text search for addresses (empty means no filter)
}

// FilterEngine applies filters to connection lists
type FilterEngine struct {
	logger *Logger
}

// NewFilterEngine creates a new filter engine
func NewFilterEngine() *FilterEngine {
	return &FilterEngine{
		logger: GetLogger(),
	}
}

// Apply filters a list of connections based on the provided filter options
// Returns a new slice containing only connections that match all filter criteria
func (fe *FilterEngine) Apply(connections []ConnectionInfo, filter FilterOptions) []ConnectionInfo {
	// If no filters are active, return all connections
	if !fe.hasActiveFilters(filter) {
		fe.logger.Debug("No active filters, returning all %d connections", len(connections))
		return connections
	}

	// Pre-allocate result slice with estimated capacity
	result := make([]ConnectionInfo, 0, len(connections))

	for _, conn := range connections {
		if fe.matchesFilter(conn, filter) {
			result = append(result, conn)
		}
	}

	fe.logger.Debug("Filtered %d connections to %d results", len(connections), len(result))
	return result
}

// hasActiveFilters checks if any filter criteria are set
func (fe *FilterEngine) hasActiveFilters(filter FilterOptions) bool {
	return filter.PID != nil ||
		filter.Port != nil ||
		filter.State != nil ||
		filter.IPv4Only ||
		filter.IPv6Only ||
		filter.ExcludeInternal ||
		filter.SearchText != ""
}

// matchesFilter checks if a connection matches all filter criteria
func (fe *FilterEngine) matchesFilter(conn ConnectionInfo, filter FilterOptions) bool {
	// PID filter
	if filter.PID != nil && conn.PID != *filter.PID {
		return false
	}

	// Port filter (matches either local or remote port)
	if filter.Port != nil {
		if conn.LocalPort != *filter.Port && conn.RemotePort != *filter.Port {
			return false
		}
	}

	// State filter
	if filter.State != nil && conn.State != *filter.State {
		return false
	}

	// IPv4/IPv6 filters
	if filter.IPv4Only && conn.IsIPv6 {
		return false
	}
	if filter.IPv6Only && !conn.IsIPv6 {
		return false
	}

	// Internal traffic filter - hide connections where both endpoints are internal
	if filter.ExcludeInternal {
		if isInternalIP(conn.LocalAddr) && isInternalIP(conn.RemoteAddr) {
			return false
		}
	}

	// Text search filter (searches in local and remote addresses)
	if filter.SearchText != "" {
		searchLower := strings.ToLower(filter.SearchText)
		localAddrLower := strings.ToLower(conn.LocalAddr)
		remoteAddrLower := strings.ToLower(conn.RemoteAddr)

		if !strings.Contains(localAddrLower, searchLower) &&
			!strings.Contains(remoteAddrLower, searchLower) {
			return false
		}
	}

	// All filters passed
	return true
}

// isInternalIP checks if an IP address is a private/internal address
// Matches: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8, ::1, fe80::/10
func isInternalIP(addr string) bool {
	ip := net.ParseIP(addr)
	if ip == nil {
		return false
	}

	// Check for loopback (127.x.x.x or ::1)
	if ip.IsLoopback() {
		return true
	}

	// Check for link-local (169.254.x.x or fe80::)
	if ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() {
		return true
	}

	// Check for private addresses (10.x, 172.16-31.x, 192.168.x, fc00::/7)
	if ip.IsPrivate() {
		return true
	}

	return false
}
