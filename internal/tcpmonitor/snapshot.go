//go:build windows

package tcpmonitor

import (
	"sync"
	"time"
)

// CompactConnection stores minimal data for snapshots
type CompactConnection struct {
	LocalAddr  string `json:"localAddr"`
	LocalPort  int    `json:"localPort"`
	RemoteAddr string `json:"remoteAddr"`
	RemotePort int    `json:"remotePort"`
	State      int    `json:"state"`
	PID        int    `json:"pid"`
	BytesIn    int64  `json:"bytesIn"`
	BytesOut   int64  `json:"bytesOut"`
	RTT        int64  `json:"rtt"`
	Retrans    int64  `json:"retrans"`
}

// Snapshot represents a point-in-time capture
type Snapshot struct {
	ID          int64               `json:"id"`
	Timestamp   time.Time           `json:"timestamp"`
	Connections []CompactConnection `json:"connections"`
}

// SnapshotStore manages snapshot recording with ring buffer
type SnapshotStore struct {
	mu          sync.RWMutex
	snapshots   []Snapshot
	maxSize     int
	nextID      int64
	isRecording bool
}

// NewSnapshotStore creates a store with fixed capacity
func NewSnapshotStore(maxSnapshots int) *SnapshotStore {
	return &SnapshotStore{
		snapshots: make([]Snapshot, 0, maxSnapshots),
		maxSize:   maxSnapshots,
		nextID:    1,
	}
}

// StartRecording enables snapshot capture
func (s *SnapshotStore) StartRecording() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.isRecording = true
}

// StopRecording disables snapshot capture
func (s *SnapshotStore) StopRecording() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.isRecording = false
}

// IsRecording returns current recording state
func (s *SnapshotStore) IsRecording() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.isRecording
}

// Take captures a snapshot if recording is enabled
func (s *SnapshotStore) Take(connections []ConnectionInfo) *Snapshot {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.isRecording {
		return nil
	}

	// Convert to compact format
	compact := make([]CompactConnection, len(connections))
	for i, c := range connections {
		compact[i] = CompactConnection{
			LocalAddr:  c.LocalAddr,
			LocalPort:  int(c.LocalPort),
			RemoteAddr: c.RemoteAddr,
			RemotePort: int(c.RemotePort),
			State:      int(c.State),
			PID:        int(c.PID),
		}
		if c.BasicStats != nil {
			compact[i].BytesIn = int64(c.BasicStats.DataBytesIn)
			compact[i].BytesOut = int64(c.BasicStats.DataBytesOut)
		}
		if c.ExtendedStats != nil {
			compact[i].RTT = int64(c.ExtendedStats.SmoothedRTT)
			compact[i].Retrans = int64(c.ExtendedStats.BytesRetrans)
		}
	}

	snapshot := Snapshot{
		ID:          s.nextID,
		Timestamp:   time.Now(),
		Connections: compact,
	}
	s.nextID++

	// Ring buffer: remove oldest if at capacity
	if len(s.snapshots) >= s.maxSize {
		s.snapshots = s.snapshots[1:]
	}
	s.snapshots = append(s.snapshots, snapshot)

	return &snapshot
}

// Count returns number of stored snapshots
func (s *SnapshotStore) Count() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.snapshots)
}

// GetRange returns snapshots within time range
func (s *SnapshotStore) GetRange(start, end time.Time) []Snapshot {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []Snapshot
	for _, snap := range s.snapshots {
		if (snap.Timestamp.Equal(start) || snap.Timestamp.After(start)) &&
			(snap.Timestamp.Equal(end) || snap.Timestamp.Before(end)) {
			result = append(result, snap)
		}
	}
	return result
}

// GetByID returns a specific snapshot
func (s *SnapshotStore) GetByID(id int64) *Snapshot {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, snap := range s.snapshots {
		if snap.ID == id {
			return &snap
		}
	}
	return nil
}

// GetAll returns all snapshots (for timeline view)
func (s *SnapshotStore) GetAll() []Snapshot {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]Snapshot, len(s.snapshots))
	copy(result, s.snapshots)
	return result
}

// GetMeta returns lightweight metadata for all snapshots
func (s *SnapshotStore) GetMeta() []SnapshotMeta {
	s.mu.RLock()
	defer s.mu.RUnlock()

	meta := make([]SnapshotMeta, len(s.snapshots))
	for i, snap := range s.snapshots {
		meta[i] = SnapshotMeta{
			ID:              snap.ID,
			Timestamp:       snap.Timestamp,
			ConnectionCount: len(snap.Connections),
		}
	}
	return meta
}

// SnapshotMeta is lightweight snapshot info for UI
type SnapshotMeta struct {
	ID              int64     `json:"id"`
	Timestamp       time.Time `json:"timestamp"`
	ConnectionCount int       `json:"connectionCount"`
}

// Clear removes all snapshots
func (s *SnapshotStore) Clear() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.snapshots = s.snapshots[:0]
}

// ConnectionHistoryPoint is a single data point for charting
type ConnectionHistoryPoint struct {
	Timestamp time.Time `json:"timestamp"`
	BytesIn   int64     `json:"bytesIn"`
	BytesOut  int64     `json:"bytesOut"`
	RTT       int64     `json:"rtt"`
	Retrans   int64     `json:"retrans"`
	State     int       `json:"state"`
}

// GetConnectionHistory returns historical data for a specific connection
func (s *SnapshotStore) GetConnectionHistory(localAddr string, localPort int, remoteAddr string, remotePort int) []ConnectionHistoryPoint {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var history []ConnectionHistoryPoint
	for _, snap := range s.snapshots {
		for _, conn := range snap.Connections {
			if conn.LocalAddr == localAddr && conn.LocalPort == localPort &&
				conn.RemoteAddr == remoteAddr && conn.RemotePort == remotePort {
				history = append(history, ConnectionHistoryPoint{
					Timestamp: snap.Timestamp,
					BytesIn:   conn.BytesIn,
					BytesOut:  conn.BytesOut,
					RTT:       conn.RTT,
					Retrans:   conn.Retrans,
					State:     conn.State,
				})
				break
			}
		}
	}
	return history
}

// Compare compares two snapshots and returns differences
func (s *SnapshotStore) Compare(id1, id2 int64) *ComparisonResult {
	snap1 := s.GetByID(id1)
	snap2 := s.GetByID(id2)

	if snap1 == nil || snap2 == nil {
		return nil
	}

	// Build connection maps
	map1 := make(map[string]CompactConnection)
	map2 := make(map[string]CompactConnection)

	for _, c := range snap1.Connections {
		key := connKey(c)
		map1[key] = c
	}
	for _, c := range snap2.Connections {
		key := connKey(c)
		map2[key] = c
	}

	result := &ComparisonResult{
		Snapshot1: snap1.ID,
		Snapshot2: snap2.ID,
	}

	// Find added (in snap2 but not snap1)
	for key, c := range map2 {
		if _, exists := map1[key]; !exists {
			result.Added = append(result.Added, c)
		}
	}

	// Find removed (in snap1 but not snap2)
	for key, c := range map1 {
		if _, exists := map2[key]; !exists {
			result.Removed = append(result.Removed, c)
		}
	}

	// Find changed (in both, but stats differ)
	for key, c1 := range map1 {
		if c2, exists := map2[key]; exists {
			if c1.BytesIn != c2.BytesIn || c1.BytesOut != c2.BytesOut ||
				c1.RTT != c2.RTT || c1.Retrans != c2.Retrans || c1.State != c2.State {
				result.Changed = append(result.Changed, ConnectionDiff{
					Connection: c2,
					DeltaIn:    c2.BytesIn - c1.BytesIn,
					DeltaOut:   c2.BytesOut - c1.BytesOut,
					DeltaRTT:   c2.RTT - c1.RTT,
				})
			}
		}
	}

	return result
}

func connKey(c CompactConnection) string {
	return c.LocalAddr + ":" + string(rune(c.LocalPort)) + "-" + c.RemoteAddr + ":" + string(rune(c.RemotePort))
}

// ComparisonResult holds diff between two snapshots
type ComparisonResult struct {
	Snapshot1 int64               `json:"snapshot1"`
	Snapshot2 int64               `json:"snapshot2"`
	Added     []CompactConnection `json:"added"`
	Removed   []CompactConnection `json:"removed"`
	Changed   []ConnectionDiff    `json:"changed"`
}

// ConnectionDiff shows what changed for a connection
type ConnectionDiff struct {
	Connection CompactConnection `json:"connection"`
	DeltaIn    int64             `json:"deltaIn"`
	DeltaOut   int64             `json:"deltaOut"`
	DeltaRTT   int64             `json:"deltaRtt"`
}
