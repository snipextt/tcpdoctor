package tcpmonitor

// === Snapshot Methods (Wails-exposed) ===

// StartRecording begins snapshot capture
func (s *Service) StartRecording() {
	if s.snapshotStore != nil {
		s.snapshotStore.StartRecording()
		s.logger.Info("Snapshot recording started")
	}
}

// StopRecording stops snapshot capture
func (s *Service) StopRecording() {
	if s.snapshotStore != nil {
		s.snapshotStore.StopRecording()
		s.logger.Info("Snapshot recording stopped, %d snapshots captured", s.snapshotStore.Count())
	}
}

// IsRecording returns current recording state
func (s *Service) IsRecording() bool {
	if s.snapshotStore != nil {
		return s.snapshotStore.IsRecording()
	}
	return false
}

// GetSnapshotCount returns number of stored snapshots
func (s *Service) GetSnapshotCount() int {
	if s.snapshotStore != nil {
		return s.snapshotStore.Count()
	}
	return 0
}

// GetSnapshotMeta returns lightweight metadata for timeline
func (s *Service) GetSnapshotMeta() []SnapshotMeta {
	if s.snapshotStore != nil {
		return s.snapshotStore.GetMeta()
	}
	return nil
}

// GetSnapshot returns a specific snapshot by ID
func (s *Service) GetSnapshot(id int64) *Snapshot {
	if s.snapshotStore != nil {
		return s.snapshotStore.GetByID(id)
	}
	return nil
}

// CompareSnapshots compares two snapshots
func (s *Service) CompareSnapshots(id1, id2 int64) *ComparisonResult {
	if s.snapshotStore != nil {
		return s.snapshotStore.Compare(id1, id2)
	}
	return nil
}

// ClearSnapshots removes all stored snapshots
func (s *Service) ClearSnapshots() {
	if s.snapshotStore != nil {
		s.snapshotStore.Clear()
		s.logger.Info("Snapshots cleared")
	}
}

// TakeSnapshot manually captures current state (if recording)
func (s *Service) TakeSnapshot(filter FilterOptions) {
	if s.snapshotStore != nil {
		connections, _ := s.GetConnections(filter)
		s.snapshotStore.Take(connections)
	}
}

// GetConnectionHistory returns historical data for a specific connection
func (s *Service) GetConnectionHistory(localAddr string, localPort int, remoteAddr string, remotePort int) []ConnectionHistoryPoint {
	if s.snapshotStore != nil {
		return s.snapshotStore.GetConnectionHistory(localAddr, localPort, remoteAddr, remotePort)
	}
	return nil
}

// === Session Methods ===

// GetSessions returns all recording sessions
func (s *Service) GetSessions() []RecordingSession {
	if s.snapshotStore != nil {
		return s.snapshotStore.GetSessions()
	}
	return nil
}

// GetSessionCount returns number of sessions
func (s *Service) GetSessionCount() int {
	if s.snapshotStore != nil {
		return s.snapshotStore.SessionCount()
	}
	return 0
}

// GetSessionTimeline returns all connection snapshots from a session as timeline rows
func (s *Service) GetSessionTimeline(sessionID int64) []TimelineConnection {
	if s.snapshotStore != nil {
		return s.snapshotStore.GetSessionTimeline(sessionID)
	}
	return nil
}

// GetConnectionHistoryForSession returns connection history for a specific session
func (s *Service) GetConnectionHistoryForSession(sessionID int64, localAddr string, localPort int, remoteAddr string, remotePort int) []ConnectionHistoryPoint {
	if s.snapshotStore != nil {
		return s.snapshotStore.GetConnectionHistoryForSession(sessionID, localAddr, localPort, remoteAddr, remotePort)
	}
	return nil
}
