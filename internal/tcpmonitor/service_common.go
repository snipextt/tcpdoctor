package tcpmonitor

import (
	"context"
	"sync"
	"time"

	"tcpdoctor/internal/llm"
)

// Service coordinates all TCP monitoring components
type Service struct {
	// These fields might be nil on non-Windows platforms
	connectionManager *ConnectionManager
	statsCollector    *StatsCollector
	filterEngine      *FilterEngine
	apiLayer          *WindowsAPILayer

	// LLM service for AI-powered analysis - Cross-platform
	llmService *llm.GeminiService

	// Snapshot store for time-travel feature - Cross-platform
	snapshotStore *SnapshotStore

	updateInterval time.Duration
	isAdmin        bool

	// Health thresholds
	healthThresholds HealthThresholds

	// Polling control
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup

	// State management
	mu           sync.RWMutex
	selectedConn *ConnectionKey

	logger *Logger
}

// ServiceConfig contains configuration options for the Service
type ServiceConfig struct {
	UpdateInterval time.Duration // How often to poll for connection updates
}

// DefaultServiceConfig returns the default service configuration
func DefaultServiceConfig() ServiceConfig {
	return ServiceConfig{
		UpdateInterval: 1 * time.Second,
	}
}
