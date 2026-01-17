package tcpmonitor

import (
	"fmt"
	"log"
	"os"
	"sync"
)

// LogLevel represents the severity of a log message
type LogLevel int

const (
	LogLevelDebug LogLevel = iota
	LogLevelInfo
	LogLevelWarn
	LogLevelError
)

// Logger provides structured logging for the TCP monitor
type Logger struct {
	level  LogLevel
	logger *log.Logger
	mu     sync.Mutex
}

var (
	defaultLogger *Logger
	once          sync.Once
)

// GetLogger returns the default logger instance
func GetLogger() *Logger {
	once.Do(func() {
		defaultLogger = NewLogger(LogLevelInfo)
	})
	return defaultLogger
}

// NewLogger creates a new logger with the specified level
func NewLogger(level LogLevel) *Logger {
	return &Logger{
		level:  level,
		logger: log.New(os.Stdout, "", log.LstdFlags),
	}
}

// SetLevel sets the minimum log level
func (l *Logger) SetLevel(level LogLevel) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.level = level
}

// Debug logs a debug message
func (l *Logger) Debug(format string, args ...interface{}) {
	l.log(LogLevelDebug, format, args...)
}

// Info logs an info message
func (l *Logger) Info(format string, args ...interface{}) {
	l.log(LogLevelInfo, format, args...)
}

// Warn logs a warning message
func (l *Logger) Warn(format string, args ...interface{}) {
	l.log(LogLevelWarn, format, args...)
}

// Error logs an error message
func (l *Logger) Error(format string, args ...interface{}) {
	l.log(LogLevelError, format, args...)
}

// log is the internal logging function
func (l *Logger) log(level LogLevel, format string, args ...interface{}) {
	l.mu.Lock()
	defer l.mu.Unlock()

	if level < l.level {
		return
	}

	prefix := ""
	switch level {
	case LogLevelDebug:
		prefix = "[DEBUG] "
	case LogLevelInfo:
		prefix = "[INFO] "
	case LogLevelWarn:
		prefix = "[WARN] "
	case LogLevelError:
		prefix = "[ERROR] "
	}

	message := fmt.Sprintf(format, args...)
	l.logger.Print(prefix + message)
}

// WithError logs an error with additional context
func (l *Logger) WithError(err error, format string, args ...interface{}) {
	message := fmt.Sprintf(format, args...)
	l.Error("%s: %v", message, err)
}
