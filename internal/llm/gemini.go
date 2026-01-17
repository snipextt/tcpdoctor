package llm

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
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
		content := msg.Content
		if strings.TrimSpace(content) == "" {
			content = "(No text content)"
		}
		chatHistory = append(chatHistory, genai.NewContentFromText(content, role))
	}

	// Create chat config with system instruction
	// NOTE: We don't set ResponseMIMEType: "application/json" here because it is currently
	// incompatible with Function Calling (tools) in the Gemini API.
	chatConfig := &genai.GenerateContentConfig{
		SystemInstruction: &genai.Content{
			Parts: []*genai.Part{{Text: QuerySystemPromptWithGraphs}},
		},
		Temperature: genai.Ptr(float32(0.5)),
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
							"sessionID":  {Type: genai.TypeInteger, Description: "The recording session ID"},
							"startTime":  {Type: genai.TypeString, Description: "Start time (ISO8601 format)"},
							"endTime":    {Type: genai.TypeString, Description: "End time (ISO8601 format)"},
							"localAddr":  {Type: genai.TypeString, Description: "Filter by local address"},
							"localPort":  {Type: genai.TypeInteger, Description: "Filter by local port"},
							"remoteAddr": {Type: genai.TypeString, Description: "Filter by remote address"},
							"remotePort": {Type: genai.TypeInteger, Description: "Filter by remote port"},
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
				{
					Name:        "plot_graph",
					Description: "Suggest a graph visualization to show data to the user. Use this whenever you want to visualize distributions or trends.",
					Parameters: &genai.Schema{
						Type: genai.TypeObject,
						Properties: map[string]*genai.Schema{
							"type":   {Type: genai.TypeString, Description: "Graph type: 'bar', 'line', 'pie'", Enum: []string{"bar", "line", "pie"}},
							"title":  {Type: genai.TypeString, Description: "Clear, descriptive title for the graph"},
							"xLabel": {Type: genai.TypeString, Description: "Label for the X axis"},
							"yLabel": {Type: genai.TypeString, Description: "Label for the Y axis"},
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
		},
	}
	chatConfig.Tools = tools

	// Send the current message with connection context
	currentMessage := fmt.Sprintf("%s\n\nUser question: %s", contextData, query)

	// Loop to handle potential multiple tool calls and responses
	var fullAnswer strings.Builder
	var graphs []GraphSuggestion

	// We maintain our own history for the session to allow sanitization
	// Start with the base history constructed above
	sessionHistory := make([]*genai.Content, len(chatHistory))
	copy(sessionHistory, chatHistory)

	for i := 0; i < 20; i++ {
		// Create a NEW chat session for this turn with the sanitized history
		// This is necessary because we need to modify/sanitize history (remove empty parts)
		// which isn't easy with the stateful ChatSession object.

		// LOGGING: Print the structure of the request we are about to send
		// This is critical for debugging 400 'data required' errors
		fmt.Printf("\n--- [Debugging] Sending Message (Turn %d) ---\n", i)
		fmt.Printf("Current Message Len: %d\n", len(currentMessage))
		fmt.Printf("History Count: %d\n", len(sessionHistory))

		for idx, h := range sessionHistory {
			fmt.Printf("History[%d] Role: %s, Parts: %d\n", idx, h.Role, len(h.Parts))
			for pIdx, part := range h.Parts {
				hasText := part.Text != ""
				hasFnCall := part.FunctionCall != nil
				hasFnResp := part.FunctionResponse != nil
				hasBlob := part.InlineData != nil || part.FileData != nil
				fmt.Printf("  Part[%d]: Text=%v, FnCall=%v, FnResp=%v, Blob=%v\n",
					pIdx, hasText, hasFnCall, hasFnResp, hasBlob)
				if hasBlob {
					fmt.Printf("    -> ALERT: Blob part detected at History[%d].Part[%d]\n", idx, pIdx)
				}
				if !hasText && !hasFnCall && !hasFnResp && !hasBlob {
					fmt.Printf("    -> CRITICAL: Empty/Invalid Part at History[%d].Part[%d]!\n", idx, pIdx)
				}
			}
		}

		chatSession, err := g.client.Chats.Create(ctx, g.model, chatConfig, sessionHistory)
		if err != nil {
			return &QueryResult{Answer: fmt.Sprintf("Failed to create chat session: %v", err), Success: false}, nil
		}

		result, err := chatSession.SendMessage(ctx, genai.Part{Text: currentMessage})
		if err != nil {
			fmt.Printf("\n!!! GEMINI API ERROR: %v\n", err) // Print to console for visibility
			return &QueryResult{Answer: fmt.Sprintf("Error: %v", err), Success: false}, nil
		}

		// Update our manual history with the User's message
		sessionHistory = append(sessionHistory, genai.NewContentFromText(currentMessage, "user"))

		if len(result.Candidates) == 0 {
			break
		}

		candidate := result.Candidates[0]

		// Sanitize and append the Model's response to our history
		var validParts []*genai.Part
		for _, p := range candidate.Content.Parts {
			if p.Text != "" || p.FunctionCall != nil {
				validParts = append(validParts, p)
			}
		}
		if len(validParts) == 0 {
			validParts = []*genai.Part{{Text: "(Visual content)"}} // Fallback to avoid empty message
		}

		// Append sanitized model response to history for next turn
		modelContent := &genai.Content{Role: "model", Parts: validParts}
		sessionHistory = append(sessionHistory, modelContent)

		currentMessage = "" // Reset for next turn logic
		currentMessage = "" // Reset for next turn logic

		// Handle Parts (Text and Function Calls)
		var responses []genai.Part
		hasFunctionCall := false

		for _, part := range candidate.Content.Parts {
			if part.Text != "" {
				fullAnswer.WriteString(part.Text)
				fullAnswer.WriteString("\n\n")
			}

			if part.FunctionCall != nil {
				hasFunctionCall = true
				call := part.FunctionCall

				// Special handling for plot_graph (internal caching)
				if call.Name == "plot_graph" {
					graph := GraphSuggestion{
						Type:   call.Args["type"].(string),
						Title:  call.Args["title"].(string),
						XLabel: getValueString(call.Args, "xLabel"),
						YLabel: getValueString(call.Args, "yLabel"),
					}
					if dps, ok := call.Args["dataPoints"].([]interface{}); ok {
						for _, it := range dps {
							if dp, ok := it.(map[string]interface{}); ok {
								graph.DataPoints = append(graph.DataPoints, GraphDataPoint{
									Label: dp["label"].(string),
									Value: getFloat64(dp["value"]),
								})
							}
						}
					}
					graphs = append(graphs, graph)

					// Acknowledge the graph plotting tool
					responses = append(responses, genai.Part{
						FunctionResponse: &genai.FunctionResponse{
							Name:     call.Name,
							Response: map[string]interface{}{"result": "Graph plotted successfully"},
						},
					})
				} else {
					// External data retrieval tools
					g.mu.RLock()
					handler, ok := g.toolHandlers[call.Name]
					g.mu.RUnlock()

					if !ok {
						responses = append(responses, genai.Part{
							FunctionResponse: &genai.FunctionResponse{
								Name:     call.Name,
								Response: map[string]interface{}{"error": "unknown tool"},
							},
						})
						continue
					}

					toolResult, err := handler(ctx, call.Args)
					if err != nil {
						responses = append(responses, genai.Part{
							FunctionResponse: &genai.FunctionResponse{
								Name:     call.Name,
								Response: map[string]interface{}{"error": err.Error()},
							},
						})
					} else {
						toolResultJSON, _ := json.Marshal(toolResult)
						responses = append(responses, genai.Part{
							FunctionResponse: &genai.FunctionResponse{
								Name:     call.Name,
								Response: map[string]interface{}{"result": string(toolResultJSON)},
							},
						})
					}
				}
			}
		}

		if !hasFunctionCall {
			// Model is finished
			break
		}

		// Send responses back to model
		result, err = chatSession.SendMessage(ctx, responses...)
		if err != nil {
			return &QueryResult{Answer: fmt.Sprintf("Error in tool turn: %v", err), Success: false}, nil
		}

		if len(result.Candidates) > 0 {
			for _, part := range result.Candidates[0].Content.Parts {
				if part.Text != "" {
					fullAnswer.WriteString(part.Text)
					fullAnswer.WriteString("\n\n")
				}
			}
		}
	}

	ans := strings.TrimSpace(fullAnswer.String())
	if ans == "" {
		if len(graphs) > 0 {
			ans = "Here are the requested visualizations."
		} else {
			ans = "Processed."
		}
	}

	return &QueryResult{
		Answer:  ans,
		Graphs:  graphs,
		Success: true,
	}, nil
}

func getValueString(m map[string]interface{}, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}

func getFloat64(v interface{}) float64 {
	switch t := v.(type) {
	case float64:
		return t
	case int:
		return float64(t)
	case int64:
		return float64(t)
	default:
		return 0
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
