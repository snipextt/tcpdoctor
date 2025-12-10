// +build windows

package tcpmonitor

import (
	"fmt"
	"sync"
	"time"
)

// ConnectionKey uniquely identifies a TCP connection
type ConnectionKey struct {
	LocalAddr  string
	LocalPort  uint16
	RemoteAddr string
	RemotePort uint16
	IsIPv6     bool
}

// String returns a string representation of the connection key
func (ck ConnectionKey) String() string {
	return fmt.Sprintf("%s:%d->%s:%d(ipv6=%v)",
		ck.LocalAddr, ck.LocalPort, ck.RemoteAddr, ck.RemotePort, ck.IsIPv6)
}

// ConnectionEventType represents the type of connection event
type ConnectionEventType int

const (
	ConnectionAdded ConnectionEventType = iota
	ConnectionRemoved
	ConnectionUpdated
)

// String returns a string representation of the event type
func (t ConnectionEventType) String() string {
	switch t {
	case ConnectionAdded:
		return "ADDED"
	case ConnectionRemoved:
		return "REMOVED"
	case ConnectionUpdated:
		return "UPDATED"
	default:
		return fmt.Sprintf("UNKNOWN(%d)", t)
	}
}

// ConnectionEvent represents a change in connection state
type ConnectionEvent struct {
	Type       ConnectionEventType
	Connection ConnectionInfo
	Timestamp  time.Time
}

// ConnectionManager manages the lifecycle of TCP connections
type ConnectionManager struct {
	connections map[ConnectionKey]*ConnectionInfo
	mu          sync.RWMutex
	logger      *Logger
}

// NewConnectionManager creates a new connection manager
func NewConnectionManager() *ConnectionManager {
	return &ConnectionManager{
		connections: make(map[ConnectionKey]*ConnectionInfo),
		logger:      GetLogger(),
	}
}

// Update processes a new list of connections and detects changes
// Returns a list of events representing new, closed, and updated connections
func (cm *ConnectionManager) Update(connections []ConnectionInfo) []ConnectionEvent {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	events := make([]ConnectionEvent, 0)
	now := time.Now()

	// Create a set of current connection keys for efficient lookup
	currentKeys := make(map[ConnectionKey]bool)

	// Process incoming connections
	for i := range connections {
		conn := &connections[i]
		key := cm.makeKey(conn)
		currentKeys[key] = true

		// Check if this is a new or existing connection
		existing, exists := cm.connections[key]

		if !exists {
			// New connection detected
			conn.LastSeen = now
			cm.connections[key] = conn
			events = append(events, ConnectionEvent{
				Type:       ConnectionAdded,
				Connection: *conn,
				Timestamp:  now,
			})
			cm.logger.Debug("New connection: %s", key.String())
		} else {
			// Existing connection - update it
			existing.State = conn.State
			existing.PID = conn.PID
			existing.LastSeen = now
			existing.BasicStats = conn.BasicStats
			existing.ExtendedStats = conn.ExtendedStats

			events = append(events, ConnectionEvent{
				Type:       ConnectionUpdated,
				Connection: *existing,
				Timestamp:  now,
			})
		}
	}

	// Detect closed connections (present in map but not in current list)
	for key, conn := range cm.connections {
		if !currentKeys[key] {
			// Connection has been closed
			events = append(events, ConnectionEvent{
				Type:       ConnectionRemoved,
				Connection: *conn,
				Timestamp:  now,
			})
			delete(cm.connections, key)
			cm.logger.Debug("Connection closed: %s", key.String())
		}
	}

	cm.logger.Debug("Update complete: %d events generated", len(events))
	return events
}

// Get retrieves a specific connection by its key
func (cm *ConnectionManager) Get(key ConnectionKey) (*ConnectionInfo, bool) {
	cm.mu.RLock()
	defer cm.mu.RUnlock()

	conn, exists := cm.connections[key]
	if !exists {
		return nil, false
	}

	// Return a copy to prevent external modification
	connCopy := *conn
	return &connCopy, true
}

// GetAll returns all currently tracked connections
func (cm *ConnectionManager) GetAll() []ConnectionInfo {
	cm.mu.RLock()
	defer cm.mu.RUnlock()

	// Create a slice with capacity equal to the number of connections
	result := make([]ConnectionInfo, 0, len(cm.connections))

	for _, conn := range cm.connections {
		// Return copies to prevent external modification
		result = append(result, *conn)
	}

	return result
}

// Count returns the number of tracked connections
func (cm *ConnectionManager) Count() int {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	return len(cm.connections)
}

// Clear removes all tracked connections
func (cm *ConnectionManager) Clear() {
	cm.mu.Lock()
	defer cm.mu.Unlock()
	cm.connections = make(map[ConnectionKey]*ConnectionInfo)
	cm.logger.Debug("Connection manager cleared")
}

// makeKey creates a ConnectionKey from a ConnectionInfo
func (cm *ConnectionManager) makeKey(conn *ConnectionInfo) ConnectionKey {
	return ConnectionKey{
		LocalAddr:  conn.LocalAddr,
		LocalPort:  conn.LocalPort,
		RemoteAddr: conn.RemoteAddr,
		RemotePort: conn.RemotePort,
		IsIPv6:     conn.IsIPv6,
	}
}
