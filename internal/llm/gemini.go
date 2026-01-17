package llm

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"google.golang.org/genai"
)

// ToolHandler is a function that executes a tool call from the LLM
type ToolHandler func(ctx context.Context, args map[string]interface{}) (interface{}, error)

// GeminiService provides LLM-powered analysis using Google Gemini API
type GeminiService struct {
	client       *genai.Client
	model        string
	apiKey       string
	toolHandlers map[string]ToolHandler
	mu           sync.RWMutex
}

// NewGeminiService creates a new Gemini service
func NewGeminiService() *GeminiService {
	return &GeminiService{
		model:        "gemini-2.5-flash", // Full model for comprehensive analysis
		toolHandlers: make(map[string]ToolHandler),
	}
}

// RegisterTool registers a handler for an AI tool
func (g *GeminiService) RegisterTool(name string, handler ToolHandler) {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.toolHandlers[name] = handler
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

	var response struct {
		DiagnosticResult
		Graphs []GraphSuggestion `json:"graphs"`
	}

	if err := json.Unmarshal([]byte(result.Text()), &response); err != nil {
		return &DiagnosticResult{
			Summary:  result.Text(),
			Severity: "warning",
		}, nil
	}

	diagResult := response.DiagnosticResult
	diagResult.Graphs = response.Graphs
	return &diagResult, nil
}

// QueryConnections answers a natural language question about the connections
func (g *GeminiService) QueryConnections(ctx context.Context, query string, connections []ConnectionSummary) (*QueryResult, error) {
	// Refactor to use history-enabled method with empty history for consistency
	return g.QueryConnectionsWithHistory(ctx, query, connections, nil)
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

	// Tools configuration
	tools := []*genai.Tool{
		{
			FunctionDeclarations: []*genai.FunctionDeclaration{
				{
					Name:        "get_snapshots_by_time_range",
					Description: "Retrieve network snapshots for a specific time range within a session. Use this to analyze what happened during a specific interval.",
					Parameters: &genai.Schema{
						Type: genai.TypeObject,
						Properties: map[string]*genai.Schema{
							"sessionID": {Type: genai.TypeInteger, Description: "The recording session ID"},
							"startTime": {Type: genai.TypeString, Description: "Start time (ISO8601 format)"},
							"endTime":   {Type: genai.TypeString, Description: "End time (ISO8601 format)"},
						},
						Required: []string{"sessionID", "startTime", "endTime"},
					},
				},
				{
					Name:        "get_metric_history",
					Description: "Retrieve historical data points for a specific connection metric (e.g., RTT, bandwidth) across a session.",
					Parameters: &genai.Schema{
						Type: genai.TypeObject,
						Properties: map[string]*genai.Schema{
							"sessionID":  {Type: genai.TypeInteger, Description: "The recording session ID"},
							"localAddr":  {Type: genai.TypeString},
							"localPort":  {Type: genai.TypeInteger},
							"remoteAddr": {Type: genai.TypeString},
							"remotePort": {Type: genai.TypeInteger},
							"metric":     {Type: genai.TypeString, Description: "Metric to fetch: 'rtt', 'bandwidth_in', 'bandwidth_out'"},
						},
						Required: []string{"sessionID", "localAddr", "localPort", "remoteAddr", "remotePort", "metric"},
					},
				},
			},
		},
	}
	chatConfig.Tools = tools

	// Send the current message with connection context
	currentMessage := fmt.Sprintf("%s\n\nUser question: %s", contextData, query)

	var lastText string

	// Loop to handle potential multiple tool calls
	for i := 0; i < 5; i++ {
		result, err := chat.SendMessage(ctx, genai.Part{Text: currentMessage})
		if err != nil {
			return &QueryResult{Answer: fmt.Sprintf("Error: %v", err), Success: false}, nil
		}

		if len(result.Candidates) == 0 {
			return &QueryResult{Answer: "No response from AI", Success: false}, nil
		}

		candidate := result.Candidates[0]
		var toolCall *genai.FunctionCall
		for _, part := range candidate.Content.Parts {
			if part.FunctionCall != nil {
				toolCall = part.FunctionCall
				break
			}
		}

		if toolCall == nil {
			// No tool call, parse final JSON
			lastText = result.Text()
			break
		}

		// Execute tool
		g.mu.RLock()
		handler, ok := g.toolHandlers[toolCall.Name]
		g.mu.RUnlock()

		if !ok {
			return &QueryResult{Answer: fmt.Sprintf("Error: AI tried to use unknown tool %s", toolCall.Name), Success: false}, nil
		}

		toolResult, err := handler(ctx, toolCall.Args)
		if err != nil {
			return &QueryResult{Answer: fmt.Sprintf("Error executing tool %s: %v", toolCall.Name, err), Success: false}, nil
		}

		// Send tool result back
		toolResultJSON, _ := json.Marshal(toolResult)
		currentMessage = "" // Clear user message for subsequent turns
		result, err = chat.SendMessage(ctx, genai.Part{
			FunctionResponse: &genai.FunctionResponse{
				Name:     toolCall.Name,
				Response: map[string]interface{}{"result": string(toolResultJSON)},
			},
		})
		if err != nil {
			return &QueryResult{Answer: fmt.Sprintf("Error sending tool result: %v", err), Success: false}, nil
		}

		if len(result.Candidates) > 0 {
			lastText = result.Text()
		}
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

	if err := json.Unmarshal([]byte(lastText), &response); err != nil {
		// Fallback to raw text if JSON parsing fails
		return &QueryResult{Answer: lastText, Success: true}, nil
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

	var response struct {
		HealthReport
		Graphs []GraphSuggestion `json:"graphs"`
	}

	if err := json.Unmarshal([]byte(result.Text()), &response); err != nil {
		return &HealthReport{
			Summary: result.Text(),
			Score:   50,
		}, nil
	}

	report := response.HealthReport
	report.Graphs = response.Graphs
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
			"graphs": {
				Type:        genai.TypeArray,
				Description: "Optional array of graphs to visualize data",
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
			"graphs": {
				Type:        genai.TypeArray,
				Description: "Optional array of graphs to visualize data",
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
		Required: []string{"summary", "score"},
	}
}
