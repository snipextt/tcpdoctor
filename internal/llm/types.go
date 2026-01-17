package llm

import (
	"time"
)

// DiagnosticResult contains the AI-generated analysis of a TCP connection
type DiagnosticResult struct {
	Summary         string            `json:"summary"`          // Overall diagnosis summary
	Issues          []string          `json:"issues"`           // List of issues found
	PossibleCauses  []string          `json:"possibleCauses"`   // Potential root causes
	Recommendations []string          `json:"recommendations"`  // Suggested fixes
	Severity        string            `json:"severity"`         // healthy, warning, critical
	Graphs          []GraphSuggestion `json:"graphs,omitempty"` // Suggested graph visualizations
}

// GraphDataPoint represents a single data point for chart rendering
type GraphDataPoint struct {
	Label string  `json:"label"`
	Value float64 `json:"value"`
}

// GraphSuggestion represents an AI-suggested graph visualization
type GraphSuggestion struct {
	Type       string           `json:"type"`             // line, bar, pie
	Title      string           `json:"title"`            // Graph title
	XLabel     string           `json:"xLabel,omitempty"` // X-axis label
	YLabel     string           `json:"yLabel,omitempty"` // Y-axis label
	DataPoints []GraphDataPoint `json:"dataPoints"`       // Data to plot
}

// QueryResult contains the AI response to a connection query
type QueryResult struct {
	Answer  string            `json:"answer"`           // Text response (markdown)
	Graphs  []GraphSuggestion `json:"graphs,omitempty"` // Suggested graph visualizations
	Success bool              `json:"success"`          // Whether query succeeded
}

// HealthReport contains an AI-generated summary of network health
type HealthReport struct {
	Summary     string            `json:"summary"`          // Overall health summary
	Highlights  []string          `json:"highlights"`       // Key highlights
	Concerns    []string          `json:"concerns"`         // Areas of concern
	Suggestions []string          `json:"suggestions"`      // Suggestions for improvement
	Score       int               `json:"score"`            // Health score 0-100
	Graphs      []GraphSuggestion `json:"graphs,omitempty"` // Suggested graph visualizations
}

// ChatMessage represents a single message in conversation history
type ChatMessage struct {
	Role    string `json:"role"`    // "user" or "assistant"
	Content string `json:"content"` // Message content
}

// ConnectionSummary is a simplified connection representation for LLM context
type ConnectionSummary struct {
	LocalAddr            string  `json:"localAddr"`
	LocalPort            uint16  `json:"localPort"`
	RemoteAddr           string  `json:"remoteAddr"`
	RemotePort           uint16  `json:"remotePort"`
	State                string  `json:"state"`
	BytesIn              uint64  `json:"bytesIn"`
	BytesOut             uint64  `json:"bytesOut"`
	RTTMs                float64 `json:"rttMs"`
	RetransmissionRate   float64 `json:"retransmissionRate"`
	InboundBandwidthBps  uint64  `json:"inboundBandwidthBps"`
	OutboundBandwidthBps uint64  `json:"outboundBandwidthBps"`
	HasWarning           bool    `json:"hasWarning"`

	// Congestion Control
	CongestionWindow   uint64 `json:"congestionWindow"`
	SlowStartThreshold uint64 `json:"slowStartThreshold"`

	// Retransmission Details
	FastRetransmissions uint64 `json:"fastRetransmissions"`
	TimeoutEpisodes     uint64 `json:"timeoutEpisodes"`
	TotalSegmentsOut    uint64 `json:"totalSegmentsOut"`

	// Window & ACK Details
	DuplicateAcksIn     uint64 `json:"duplicateAcksIn"`
	DuplicateAcksOut    uint64 `json:"duplicateAcksOut"`
	SACKBlocksReceived  uint64 `json:"sackBlocksReceived"`
	WindowScaleSent     int    `json:"windowScaleSent"`
	WindowScaleReceived int    `json:"windowScaleReceived"`

	// MSS
	CurrentMSS uint64 `json:"currentMSS"`
	MaxMSS     uint64 `json:"maxMSS"`
	MinMSS     uint64 `json:"minMSS"`

	// Additional RTT Metrics
	RTTVarianceMs float64 `json:"rttVarianceMs"`
	MinRTTMs      float64 `json:"minRTTMs"`
	MaxRTTMs      float64 `json:"maxRTTMs"`
}

// LLMConfig holds configuration for the LLM service
type LLMConfig struct {
	APIKey string `json:"apiKey"`
	Model  string `json:"model"` // default: "gemini-2.0-flash"
}

// ==================================================
// Session Analysis Types (for temporal intelligence)
// ==================================================

// TemporalEvent represents a significant event in a connection's timeline
type TemporalEvent struct {
	Timestamp time.Time   `json:"timestamp"`
	Metric    string      `json:"metric"`    // "rtt", "bandwidth", "retrans"
	EventType string      `json:"eventType"` // "spike", "drop", "burst"
	Value     interface{} `json:"value"`
	Severity  string      `json:"severity"` // "high", "medium", "low"
}

// State Transition represents a TCP state change
type StateTransition struct {
	Timestamp time.Time `json:"timestamp"`
	FromState string    `json:"fromState"`
	ToState   string    `json:"toState"`
}

// PerformancePeriod represents a time span of degraded or recovered performance
type PerformancePeriod struct {
	Start  time.Time `json:"start"`
	End    time.Time `json:"end"`
	Type   string    `json:"type"`   // "degradation" or "recovery"
	Reason string    `json:"reason"` // Description of what caused it
}

// ConnectionRanking ranks a connection by a specific metric
type ConnectionRanking struct {
	LocalAddr  string  `json:"localAddr"`
	RemoteAddr string  `json:"remoteAddr"`
	LocalPort  uint16  `json:"localPort"`
	RemotePort uint16  `json:"remotePort"`
	Score      float64 `json:"score"`    // The metric value
	Severity   string  `json:"severity"` // "high", "medium", "low"
}

// MajorEvent represents a significant event affecting multiple connections
type MajorEvent struct {
	Timestamp   time.Time `json:"timestamp"`
	Type        string    `json:"type"` // "mass_degradation", "timeout_burst", etc.
	Description string    `json:"description"`
	Affected    int       `json:"affected"` // Number of connections affected
	Severity    string    `json:"severity"`
}

// SessionHighlights contains preprocessed session analysis
type SessionHighlights struct {
	// Session overview
	SessionID         int64   `json:"sessionId"`
	Duration          float64 `json:"duration"` // seconds
	TotalSnapshots    int     `json:"totalSnapshots"`
	UniqueConnections int     `json:"uniqueConnections"`

	// Top issues (automatically surfaced)
	WorstRTTConnections       []ConnectionRanking `json:"worstRTTConnections"`
	HighestRetransConnections []ConnectionRanking `json:"highestRetransConnections"`
	MostVolatileConnections   []ConnectionRanking `json:"mostVolatileConnections"`

	// Timeline highlights
	MajorEvents []MajorEvent `json:"majorEvents"`

	// Performance summary
	OverallHealth      string   `json:"overallHealth"` // "healthy", "degraded", "critical"
	HealthScore        int      `json:"healthScore"`   // 0-100
	PrimaryIssues      []string `json:"primaryIssues"`
	AnomalyCount       int      `json:"anomalyCount"`
	DegradationPeriods int      `json:"degradationPeriods"`

	// Temporal patterns
	TimeOfWorstPerformance time.Time `json:"timeOfWorstPerformance,omitempty"`
	TimeOfBestPerformance  time.Time `json:"timeOfBestPerformance,omitempty"`
}

// ConnectionIdentifier uniquely identifies a connection
type ConnectionIdentifier struct {
	LocalAddr  string `json:"localAddr"`
	LocalPort  int    `json:"localPort"`
	RemoteAddr string `json:"remoteAddr"`
	RemotePort int    `json:"remotePort"`
}

// ConnectionFilter for filtering snapshots
type ConnectionFilter struct {
	LocalAddr  *string `json:"localAddr,omitempty"`
	RemoteAddr *string `json:"remoteAddr,omitempty"`
	LocalPort  *int    `json:"localPort,omitempty"`
	RemotePort *int    `json:"remotePort,omitempty"`
}
