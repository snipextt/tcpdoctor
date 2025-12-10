package llm

// DiagnosticResult contains the AI-generated analysis of a TCP connection
type DiagnosticResult struct {
	Summary         string   `json:"summary"`         // Brief summary of the connection status
	Issues          []string `json:"issues"`          // List of detected issues
	PossibleCauses  []string `json:"possibleCauses"`  // Possible causes for the issues
	Recommendations []string `json:"recommendations"` // Recommended actions
	Severity        string   `json:"severity"`        // "healthy", "warning", "critical"
}

// QueryResult contains the AI-generated response to a natural language query
type QueryResult struct {
	Answer  string `json:"answer"`  // Natural language answer
	Success bool   `json:"success"` // Whether the query was successful
}

// HealthReport contains an AI-generated summary of network health
type HealthReport struct {
	Summary     string   `json:"summary"`     // Overall health summary
	Highlights  []string `json:"highlights"`  // Key highlights
	Concerns    []string `json:"concerns"`    // Areas of concern
	Suggestions []string `json:"suggestions"` // Suggestions for improvement
	Score       int      `json:"score"`       // Health score 0-100
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
}

// LLMConfig holds configuration for the LLM service
type LLMConfig struct {
	APIKey string `json:"apiKey"`
	Model  string `json:"model"` // default: "gemini-2.0-flash"
}
