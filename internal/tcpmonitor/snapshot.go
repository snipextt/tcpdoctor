package tcpmonitor

import (
	"sync"
	"time"
)

// CompactConnection stores data for snapshots - expanded for full history
type CompactConnection struct {
	LocalAddr  string `json:"localAddr"`
	LocalPort  int    `json:"localPort"`
	RemoteAddr string `json:"remoteAddr"`
	RemotePort int    `json:"remotePort"`
	State      int    `json:"state"`
	PID        int    `json:"pid"`
	// Basic Stats
	BytesIn     int64 `json:"bytesIn"`
	BytesOut    int64 `json:"bytesOut"`
	SegmentsIn  int64 `json:"segmentsIn"`
	SegmentsOut int64 `json:"segmentsOut"`
	// Extended Stats
	SampleRTT         int64 `json:"sampleRTT"`
	FastRetrans       int64 `json:"fastRetrans"`
	TimeoutEpisodes   int64 `json:"timeoutEpisodes"`
	RTT               int64 `json:"rtt"`
	RTTVariance       int64 `json:"rttVariance"`
	MinRTT            int64 `json:"minRtt"`
	MaxRTT            int64 `json:"maxRtt"`
	Retrans           int64 `json:"retrans"`
	SegsRetrans       int64 `json:"segsRetrans"`
	TotalSegsOut      int64 `json:"totalSegsOut"`
	TotalSegsIn       int64 `json:"totalSegsIn"`
	CongestionWin     int64 `json:"congestionWin"`
	InBandwidth       int64 `json:"inBandwidth"`
	OutBandwidth      int64 `json:"outBandwidth"`
	ThruBytesAcked    int64 `json:"thruBytesAcked"`
	ThruBytesReceived int64 `json:"thruBytesReceived"`
	CurrentSsthresh   int64 `json:"currentSsthresh"`
	SlowStartCount    int64 `json:"slowStartCount"`
	CongAvoidCount    int64 `json:"congAvoidCount"`
	CurRetxQueue      int64 `json:"curRetxQueue"`
	MaxRetxQueue      int64 `json:"maxRetxQueue"`
	CurAppWQueue      int64 `json:"curAppWQueue"`
	MaxAppWQueue      int64 `json:"maxAppWQueue"`

	// New Stats
	WinScaleRcvd   int   `json:"winScaleRcvd"`
	WinScaleSent   int   `json:"winScaleSent"`
	CurRwinRcvd    int64 `json:"curRwinRcvd"`
	MaxRwinRcvd    int64 `json:"maxRwinRcvd"`
	CurRwinSent    int64 `json:"curRwinSent"`
	MaxRwinSent    int64 `json:"maxRwinSent"`
	CurMss         int64 `json:"curMss"`
	MaxMss         int64 `json:"maxMss"`
	MinMss         int64 `json:"minMss"`
	DupAcksIn      int64 `json:"dupAcksIn"`
	DupAcksOut     int64 `json:"dupAcksOut"`
	SacksRcvd      int64 `json:"sacksRcvd"`
	SackBlocksRcvd int64 `json:"sackBlocksRcvd"`
	DsackDups      int64 `json:"dsackDups"`
}

// Snapshot represents a point-in-time capture
type Snapshot struct {
	ID          int64               `json:"id"`
	SessionID   int64               `json:"sessionId"` // Which recording session this belongs to
	Timestamp   time.Time           `json:"timestamp"`
	Connections []CompactConnection `json:"connections"`
}

// RecordingSession represents a Start/Stop recording duration
type RecordingSession struct {
	ID            int64     `json:"id"`
	StartTime     time.Time `json:"startTime"`
	EndTime       time.Time `json:"endTime"`
	SnapshotCount int       `json:"snapshotCount"`
}

// SnapshotStore manages snapshot recording with sessions
type SnapshotStore struct {
	mu               sync.RWMutex
	snapshots        []Snapshot
	sessions         []RecordingSession
	maxSize          int
	nextSnapshotID   int64
	nextSessionID    int64
	isRecording      bool
	currentSessionID int64 // Active session during recording
}

// NewSnapshotStore creates a store with fixed capacity
func NewSnapshotStore(maxSnapshots int) *SnapshotStore {
	return &SnapshotStore{
		snapshots:      make([]Snapshot, 0, maxSnapshots),
		sessions:       make([]RecordingSession, 0),
		maxSize:        maxSnapshots,
		nextSnapshotID: 1,
		nextSessionID:  1,
	}
}

// StartRecording enables snapshot capture and creates a new session
func (s *SnapshotStore) StartRecording() int64 {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Create new session
	session := RecordingSession{
		ID:        s.nextSessionID,
		StartTime: time.Now(),
	}
	s.sessions = append(s.sessions, session)
	s.currentSessionID = s.nextSessionID
	s.nextSessionID++
	s.isRecording = true

	return s.currentSessionID
}

// StopRecording disables snapshot capture and closes current session
func (s *SnapshotStore) StopRecording() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.isRecording {
		return
	}

	// Update session with end time and snapshot count
	for i := range s.sessions {
		if s.sessions[i].ID == s.currentSessionID {
			s.sessions[i].EndTime = time.Now()
			// Count snapshots in this session
			count := 0
			for _, snap := range s.snapshots {
				if snap.SessionID == s.currentSessionID {
					count++
				}
			}
			s.sessions[i].SnapshotCount = count
			break
		}
	}

	s.isRecording = false
	s.currentSessionID = 0
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
			compact[i].SegmentsIn = int64(c.BasicStats.DataSegsIn)
			compact[i].SegmentsOut = int64(c.BasicStats.DataSegsOut)
		}
		if c.ExtendedStats != nil {
			compact[i].SampleRTT = int64(c.ExtendedStats.SampleRTT)
			compact[i].FastRetrans = int64(c.ExtendedStats.FastRetrans)
			compact[i].TimeoutEpisodes = int64(c.ExtendedStats.TimeoutEpisodes)
			compact[i].RTT = int64(c.ExtendedStats.SmoothedRTT)
			compact[i].RTTVariance = int64(c.ExtendedStats.RTTVariance)
			compact[i].MinRTT = int64(c.ExtendedStats.MinRTT)
			compact[i].MaxRTT = int64(c.ExtendedStats.MaxRTT)
			compact[i].Retrans = int64(c.ExtendedStats.BytesRetrans)
			compact[i].SegsRetrans = int64(c.ExtendedStats.SegsRetrans)
			compact[i].TotalSegsOut = int64(c.ExtendedStats.TotalSegsOut)
			compact[i].TotalSegsIn = int64(c.ExtendedStats.TotalSegsIn)
			compact[i].CongestionWin = int64(c.ExtendedStats.CurrentCwnd)
			compact[i].InBandwidth = int64(c.ExtendedStats.InboundBandwidth)
			compact[i].OutBandwidth = int64(c.ExtendedStats.OutboundBandwidth)
			compact[i].ThruBytesAcked = int64(c.ExtendedStats.ThruBytesAcked)
			compact[i].ThruBytesReceived = int64(c.ExtendedStats.ThruBytesReceived)
			compact[i].CurrentSsthresh = int64(c.ExtendedStats.CurrentSsthresh)
			compact[i].SlowStartCount = int64(c.ExtendedStats.SlowStartCount)
			compact[i].CongAvoidCount = int64(c.ExtendedStats.CongAvoidCount)
			compact[i].CurRetxQueue = int64(c.ExtendedStats.CurRetxQueue)
			compact[i].MaxRetxQueue = int64(c.ExtendedStats.MaxRetxQueue)
			compact[i].CurAppWQueue = int64(c.ExtendedStats.CurAppWQueue)
			compact[i].MaxAppWQueue = int64(c.ExtendedStats.MaxAppWQueue)

			// New Stats
			compact[i].WinScaleRcvd = int(c.ExtendedStats.WinScaleRcvd)
			compact[i].WinScaleSent = int(c.ExtendedStats.WinScaleSent)
			compact[i].CurRwinRcvd = int64(c.ExtendedStats.CurRwinRcvd)
			compact[i].MaxRwinRcvd = int64(c.ExtendedStats.MaxRwinRcvd)
			compact[i].CurRwinSent = int64(c.ExtendedStats.CurRwinSent)
			compact[i].MaxRwinSent = int64(c.ExtendedStats.MaxRwinSent)
			compact[i].CurMss = int64(c.ExtendedStats.CurMss)
			compact[i].MaxMss = int64(c.ExtendedStats.MaxMss)
			compact[i].MinMss = int64(c.ExtendedStats.MinMss)
			compact[i].DupAcksIn = int64(c.ExtendedStats.DupAcksIn)
			compact[i].DupAcksOut = int64(c.ExtendedStats.DupAcksOut)
			compact[i].SacksRcvd = int64(c.ExtendedStats.SacksRcvd)
			compact[i].SackBlocksRcvd = int64(c.ExtendedStats.SackBlocksRcvd)
			compact[i].DsackDups = int64(c.ExtendedStats.DsackDups)
		}
	}

	// Find active session and increment count
	for i := range s.sessions {
		if s.sessions[i].ID == s.currentSessionID {
			s.sessions[i].SnapshotCount++
			break
		}
	}

	snapshot := Snapshot{
		ID:          s.nextSnapshotID,
		SessionID:   s.currentSessionID,
		Timestamp:   time.Now(),
		Connections: compact,
	}
	s.nextSnapshotID++

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

// Clear removes all snapshots and sessions
func (s *SnapshotStore) Clear() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.snapshots = s.snapshots[:0]
	s.sessions = s.sessions[:0]
}

// GetSessions returns all recording sessions
func (s *SnapshotStore) GetSessions() []RecordingSession {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]RecordingSession, len(s.sessions))
	copy(result, s.sessions)
	return result
}

// SessionCount returns number of sessions
func (s *SnapshotStore) SessionCount() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.sessions)
}

// GetSessionByID returns a specific session by ID
func (s *SnapshotStore) GetSessionByID(sessionID int64) *RecordingSession {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for i := range s.sessions {
		if s.sessions[i].ID == sessionID {
			return &s.sessions[i]
		}
	}
	return nil
}

// TimelineConnection represents a connection snapshot with its timestamp for timeline view
type TimelineConnection struct {
	Timestamp  time.Time         `json:"timestamp"`
	Connection CompactConnection `json:"connection"`
}

// GetSessionTimeline returns all connection snapshots from a session as timeline rows
func (s *SnapshotStore) GetSessionTimeline(sessionID int64) []TimelineConnection {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var timeline []TimelineConnection
	for _, snap := range s.snapshots {
		if snap.SessionID == sessionID {
			for _, conn := range snap.Connections {
				timeline = append(timeline, TimelineConnection{
					Timestamp:  snap.Timestamp,
					Connection: conn,
				})
			}
		}
	}
	return timeline
}

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
					Timestamp:     snap.Timestamp,
					State:         conn.State,
					BytesIn:       conn.BytesIn,
					BytesOut:      conn.BytesOut,
					SegmentsIn:    conn.SegmentsIn,
					SegmentsOut:   conn.SegmentsOut,
					RTT:           conn.RTT,
					RTTVariance:   conn.RTTVariance,
					MinRTT:        conn.MinRTT,
					MaxRTT:        conn.MaxRTT,
					Retrans:       conn.Retrans,
					SegsRetrans:   conn.SegsRetrans,
					CongestionWin: conn.CongestionWin,
					InBandwidth:   conn.InBandwidth,
					OutBandwidth:  conn.OutBandwidth,
				})
				break
			}
		}
	}
	return history
}

// GetConnectionHistoryForSession returns historical data for a connection within a specific session
func (s *SnapshotStore) GetConnectionHistoryForSession(sessionID int64, localAddr string, localPort int, remoteAddr string, remotePort int) []ConnectionHistoryPoint {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var history []ConnectionHistoryPoint
	for _, snap := range s.snapshots {
		if snap.SessionID != sessionID {
			continue
		}
		for _, conn := range snap.Connections {
			if conn.LocalAddr == localAddr && conn.LocalPort == localPort &&
				conn.RemoteAddr == remoteAddr && conn.RemotePort == remotePort {
				history = append(history, ConnectionHistoryPoint{
					Timestamp:     snap.Timestamp,
					State:         conn.State,
					BytesIn:       conn.BytesIn,
					BytesOut:      conn.BytesOut,
					SegmentsIn:    conn.SegmentsIn,
					SegmentsOut:   conn.SegmentsOut,
					RTT:           conn.RTT,
					RTTVariance:   conn.RTTVariance,
					MinRTT:        conn.MinRTT,
					MaxRTT:        conn.MaxRTT,
					Retrans:       conn.Retrans,
					SegsRetrans:   conn.SegsRetrans,
					CongestionWin: conn.CongestionWin,
					InBandwidth:   conn.InBandwidth,
					OutBandwidth:  conn.OutBandwidth,
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
