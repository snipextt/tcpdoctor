package llm

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"google.golang.org/genai"
)

// GeminiService provides LLM-powered analysis using Google Gemini API
type GeminiService struct {
	client *genai.Client
	model  string
	apiKey string
	mu     sync.RWMutex
}

// NewGeminiService creates a new Gemini service
func NewGeminiService() *GeminiService {
	return &GeminiService{
		model: "gemini-2.5-flash", // Full model for comprehensive analysis
	}
}

// Configure sets up the Gemini client with the provided API key
func (g *GeminiService) Configure(apiKey string) error {
	g.mu.Lock()
	defer g.mu.Unlock()

	if apiKey == "" {
		return fmt.Errorf("API key cannot be empty")
	}

	ctx := context.Background()
	client, err := genai.NewClient(ctx, &genai.ClientConfig{
		APIKey:  apiKey,
		Backend: genai.BackendGeminiAPI,
	})
	if err != nil {
		return fmt.Errorf("failed to create Gemini client: %w", err)
	}

	g.client = client
	g.apiKey = apiKey
	return nil
}

// IsConfigured returns true if the service has a valid API key configured
func (g *GeminiService) IsConfigured() bool {
	g.mu.RLock()
	defer g.mu.RUnlock()
	return g.client != nil && g.apiKey != ""
}

// DiagnoseConnection analyzes a connection's stats and provides a diagnosis
func (g *GeminiService) DiagnoseConnection(ctx context.Context, conn ConnectionSummary) (*DiagnosticResult, error) {
	g.mu.RLock()
	defer g.mu.RUnlock()

	if g.client == nil {
		return nil, fmt.Errorf("Gemini client not configured. Please set your API key in Settings.")
	}

	// Build the connection data as JSON for context
	connJSON, err := json.MarshalIndent(conn, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("failed to serialize connection data: %w", err)
	}

	userPrompt := fmt.Sprintf("Analyze this TCP connection and provide a diagnosis:\n\n%s", string(connJSON))

	config := &genai.GenerateContentConfig{
		SystemInstruction: &genai.Content{
			Parts: []*genai.Part{{Text: DiagnosticSystemPrompt}},
		},
		Temperature:      genai.Ptr(float32(0.3)),
		ResponseMIMEType: "application/json",
		ResponseSchema:   diagnosticResultSchema(),
	}

	result, err := g.client.Models.GenerateContent(ctx, g.model, genai.Text(userPrompt), config)
	if err != nil {
		return nil, fmt.Errorf("Gemini API error: %w", err)
	}

	if len(result.Candidates) == 0 || len(result.Candidates[0].Content.Parts) == 0 {
		return nil, fmt.Errorf("empty response from Gemini")
	}

	var diagResult DiagnosticResult
	if err := json.Unmarshal([]byte(result.Text()), &diagResult); err != nil {
		// Fallback: return raw response as summary
		return &DiagnosticResult{
			Summary:  result.Text(),
			Severity: "warning",
		}, nil
	}

	return &diagResult, nil
}

// QueryConnections answers a natural language question about the connections
func (g *GeminiService) QueryConnections(ctx context.Context, query string, connections []ConnectionSummary) (*QueryResult, error) {
	g.mu.RLock()
	defer g.mu.RUnlock()

	if g.client == nil {
		return nil, fmt.Errorf("Gemini client not configured. Please set your API key in Settings.")
	}

	// Limit connections to avoid token limits
	maxConns := 50
	if len(connections) > maxConns {
		connections = connections[:maxConns]
	}

	connJSON, err := json.Marshal(connections)
	if err != nil {
		return nil, fmt.Errorf("failed to serialize connections: %w", err)
	}

	userPrompt := fmt.Sprintf("Current TCP connections (%d total):\n%s\n\nUser question: %s",
		len(connections), string(connJSON), query)

	// For queries, we don't need strict JSON schema - natural language is better
	config := &genai.GenerateContentConfig{
		SystemInstruction: &genai.Content{
			Parts: []*genai.Part{{Text: QuerySystemPrompt}},
		},
		Temperature: genai.Ptr(float32(0.5)), // Slightly higher for more natural responses
	}

	result, err := g.client.Models.GenerateContent(ctx, g.model, genai.Text(userPrompt), config)
	if err != nil {
		return &QueryResult{Answer: fmt.Sprintf("Error: %v", err), Success: false}, nil
	}

	if len(result.Candidates) == 0 || len(result.Candidates[0].Content.Parts) == 0 {
		return &QueryResult{Answer: "No response from AI", Success: false}, nil
	}

	return &QueryResult{Answer: result.Text(), Success: true}, nil
}

// QueryConnectionsWithHistory answers a question with conversation context
func (g *GeminiService) QueryConnectionsWithHistory(ctx context.Context, query string, connections []ConnectionSummary, history []ChatMessage) (*QueryResult, error) {
	g.mu.RLock()
	defer g.mu.RUnlock()

	if g.client == nil {
		return nil, fmt.Errorf("Gemini client not configured. Please set your API key in Settings.")
	}

	// Limit connections to avoid token limits
	maxConns := 50
	if len(connections) > maxConns {
		connections = connections[:maxConns]
	}

	connJSON, err := json.Marshal(connections)
	if err != nil {
		return nil, fmt.Errorf("failed to serialize connections: %w", err)
	}

	// Build the context data
	contextData := fmt.Sprintf("Current TCP connections (%d total):\n%s", len(connections), string(connJSON))

	// Build chat history from previous messages
	var chatHistory []*genai.Content

	// Limit history to last 10 messages to save tokens
	historyStart := 0
	if len(history) > 10 {
		historyStart = len(history) - 10
	}

	for _, msg := range history[historyStart:] {
		var role genai.Role = "user"
		if msg.Role == "assistant" {
			role = "model"
		}
		chatHistory = append(chatHistory, genai.NewContentFromText(msg.Content, role))
	}

	// Create chat config with system instruction and JSON response schema
	chatConfig := &genai.GenerateContentConfig{
		SystemInstruction: &genai.Content{
			Parts: []*genai.Part{{Text: QuerySystemPromptWithGraphs}},
		},
		Temperature:      genai.Ptr(float32(0.5)),
		ResponseMIMEType: "application/json",
		ResponseSchema:   queryResponseSchema(),
	}

	// Create chat with history
	chat, err := g.client.Chats.Create(ctx, g.model, chatConfig, chatHistory)
	if err != nil {
		return &QueryResult{Answer: fmt.Sprintf("Failed to create chat: %v", err), Success: false}, nil
	}

	// Send the current message with connection context
	currentMessage := fmt.Sprintf("%s\n\nUser question: %s", contextData, query)
	result, err := chat.SendMessage(ctx, genai.Part{Text: currentMessage})
	if err != nil {
		return &QueryResult{Answer: fmt.Sprintf("Error: %v", err), Success: false}, nil
	}

	if len(result.Candidates) == 0 || len(result.Candidates[0].Content.Parts) == 0 {
		return &QueryResult{Answer: "No response from AI", Success: false}, nil
	}

	// Parse JSON response
	var response struct {
		Response string `json:"response"`
		Graphs   []struct {
			Type       string `json:"type"`
			Title      string `json:"title"`
			XLabel     string `json:"xLabel"`
			YLabel     string `json:"yLabel"`
			DataPoints []struct {
				Label string  `json:"label"`
				Value float64 `json:"value"`
			} `json:"dataPoints"`
		} `json:"graphs"`
	}

	if err := json.Unmarshal([]byte(result.Text()), &response); err != nil {
		// Fallback to raw text if JSON parsing fails
		return &QueryResult{Answer: result.Text(), Success: true}, nil
	}

	// Convert to QueryResult
	qr := &QueryResult{
		Answer:  response.Response,
		Success: true,
	}

	for _, g := range response.Graphs {
		graph := GraphSuggestion{
			Type:   g.Type,
			Title:  g.Title,
			XLabel: g.XLabel,
			YLabel: g.YLabel,
		}
		for _, dp := range g.DataPoints {
			graph.DataPoints = append(graph.DataPoints, GraphDataPoint{
				Label: dp.Label,
				Value: dp.Value,
			})
		}
		qr.Graphs = append(qr.Graphs, graph)
	}

	return qr, nil
}

// queryResponseSchema returns the JSON schema for query responses with graphs
func queryResponseSchema() *genai.Schema {
	return &genai.Schema{
		Type: genai.TypeObject,
		Properties: map[string]*genai.Schema{
			"response": {
				Type:        genai.TypeString,
				Description: "Your text response in Markdown format. Be natural and helpful.",
			},
			"graphs": {
				Type:        genai.TypeArray,
				Description: "Optional array of graphs to visualize data. Only include when visualization would help understanding.",
				Items: &genai.Schema{
					Type: genai.TypeObject,
					Properties: map[string]*genai.Schema{
						"type": {
							Type:        genai.TypeString,
							Description: "Graph type",
							Enum:        []string{"bar", "line", "pie"},
						},
						"title": {
							Type:        genai.TypeString,
							Description: "Graph title",
						},
						"xLabel": {
							Type:        genai.TypeString,
							Description: "X-axis label (optional)",
						},
						"yLabel": {
							Type:        genai.TypeString,
							Description: "Y-axis label (optional)",
						},
						"dataPoints": {
							Type: genai.TypeArray,
							Items: &genai.Schema{
								Type: genai.TypeObject,
								Properties: map[string]*genai.Schema{
									"label": {Type: genai.TypeString},
									"value": {Type: genai.TypeNumber},
								},
								Required: []string{"label", "value"},
							},
						},
					},
					Required: []string{"type", "title", "dataPoints"},
				},
			},
		},
		Required: []string{"response"},
	}
}

// GenerateHealthReport creates a comprehensive health report
func (g *GeminiService) GenerateHealthReport(ctx context.Context, connections []ConnectionSummary) (*HealthReport, error) {
	g.mu.RLock()
	defer g.mu.RUnlock()

	if g.client == nil {
		return nil, fmt.Errorf("Gemini client not configured. Please set your API key in Settings.")
	}

	// Build summary statistics
	var totalConns, establishedConns, listenConns, warningConns int
	var totalBytesIn, totalBytesOut uint64
	var avgRTT float64

	for _, c := range connections {
		totalConns++
		switch c.State {
		case "ESTABLISHED":
			establishedConns++
		case "LISTEN":
			listenConns++
		}
		if c.HasWarning {
			warningConns++
		}
		totalBytesIn += c.BytesIn
		totalBytesOut += c.BytesOut
		avgRTT += c.RTTMs
	}
	if totalConns > 0 {
		avgRTT /= float64(totalConns)
	}

	// Limit detailed connections for context
	maxConns := 30
	detailedConns := connections
	if len(connections) > maxConns {
		detailedConns = connections[:maxConns]
	}
	connJSON, _ := json.Marshal(detailedConns)

	userPrompt := fmt.Sprintf(`Network Statistics Summary:
- Total Connections: %d
- Established: %d
- Listening: %d  
- With Warnings: %d
- Total Bytes In: %d
- Total Bytes Out: %d
- Average RTT: %.2f ms

Sample connections (first %d):
%s

Generate a health report for this network.`,
		totalConns, establishedConns, listenConns, warningConns,
		totalBytesIn, totalBytesOut, avgRTT,
		len(detailedConns), string(connJSON))

	config := &genai.GenerateContentConfig{
		SystemInstruction: &genai.Content{
			Parts: []*genai.Part{{Text: HealthReportSystemPrompt}},
		},
		Temperature:      genai.Ptr(float32(0.3)),
		ResponseMIMEType: "application/json",
		ResponseSchema:   healthReportSchema(),
	}

	result, err := g.client.Models.GenerateContent(ctx, g.model, genai.Text(userPrompt), config)
	if err != nil {
		return nil, fmt.Errorf("Gemini API error: %w", err)
	}

	if len(result.Candidates) == 0 || len(result.Candidates[0].Content.Parts) == 0 {
		return nil, fmt.Errorf("empty response from Gemini")
	}

	var report HealthReport
	if err := json.Unmarshal([]byte(result.Text()), &report); err != nil {
		return &HealthReport{
			Summary: result.Text(),
			Score:   50,
		}, nil
	}

	return &report, nil
}

// ============================================================
// JSON Schemas for structured output
// ============================================================

// diagnosticResultSchema returns the JSON schema for DiagnosticResult
func diagnosticResultSchema() *genai.Schema {
	return &genai.Schema{
		Type: genai.TypeObject,
		Properties: map[string]*genai.Schema{
			"summary": {
				Type:        genai.TypeString,
				Description: "Brief one-line summary of connection health",
			},
			"issues": {
				Type:        genai.TypeArray,
				Description: "List of specific issues detected, empty array if healthy",
				Items:       &genai.Schema{Type: genai.TypeString},
			},
			"possibleCauses": {
				Type:        genai.TypeArray,
				Description: "Potential causes for any issues",
				Items:       &genai.Schema{Type: genai.TypeString},
			},
			"recommendations": {
				Type:        genai.TypeArray,
				Description: "Specific actionable recommendations",
				Items:       &genai.Schema{Type: genai.TypeString},
			},
			"severity": {
				Type:        genai.TypeString,
				Description: "Severity level: healthy, warning, or critical",
				Enum:        []string{"healthy", "warning", "critical"},
			},
		},
		Required: []string{"summary", "severity"},
	}
}

// healthReportSchema returns the JSON schema for HealthReport
func healthReportSchema() *genai.Schema {
	return &genai.Schema{
		Type: genai.TypeObject,
		Properties: map[string]*genai.Schema{
			"summary": {
				Type:        genai.TypeString,
				Description: "2-3 sentence overall health summary",
			},
			"highlights": {
				Type:        genai.TypeArray,
				Description: "Positive observations about the network",
				Items:       &genai.Schema{Type: genai.TypeString},
			},
			"concerns": {
				Type:        genai.TypeArray,
				Description: "Areas needing attention",
				Items:       &genai.Schema{Type: genai.TypeString},
			},
			"suggestions": {
				Type:        genai.TypeArray,
				Description: "Actionable improvement suggestions",
				Items:       &genai.Schema{Type: genai.TypeString},
			},
			"score": {
				Type:        genai.TypeInteger,
				Description: "Health score from 0 to 100",
			},
		},
		Required: []string{"summary", "score"},
	}
}
