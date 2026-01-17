package tcpmonitor

// CalculateHealth evaluates a connection's health and sets warning flags
func CalculateHealth(conn *ConnectionInfo, thresholds HealthThresholds) {
	// Reset warning flags
	conn.HighRetransmissionWarning = false
	conn.HighRTTWarning = false

	// Only calculate health if we have extended statistics
	if conn.ExtendedStats == nil {
		return
	}

	// Check for high retransmission rate
	if conn.ExtendedStats.TotalSegsOut > 0 {
		retransRate := (float64(conn.ExtendedStats.SegsRetrans) / float64(conn.ExtendedStats.TotalSegsOut)) * 100.0
		if retransRate >= thresholds.RetransmissionRatePercent {
			conn.HighRetransmissionWarning = true
		}
	}

	// Check for high RTT
	// Use SmoothedRTT as the primary RTT metric (it's more stable than SampleRTT)
	if conn.ExtendedStats.SmoothedRTT >= thresholds.HighRTTMilliseconds {
		conn.HighRTTWarning = true
	}
}

// HasHealthWarnings returns true if the connection has any health warnings
func HasHealthWarnings(conn *ConnectionInfo) bool {
	return conn.HighRetransmissionWarning || conn.HighRTTWarning
}
