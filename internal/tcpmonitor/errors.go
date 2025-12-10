// +build windows

package tcpmonitor

import (
	"errors"
	"fmt"
)

var (
	// ErrNotSupported indicates the operation is not supported on this platform
	ErrNotSupported = errors.New("operation not supported on this platform")

	// ErrAccessDenied indicates administrator privileges are required
	ErrAccessDenied = errors.New("access denied - administrator privileges required")

	// ErrInvalidParameter indicates an invalid parameter was provided
	ErrInvalidParameter = errors.New("invalid parameter")

	// ErrConnectionNotFound indicates the specified connection was not found
	ErrConnectionNotFound = errors.New("connection not found")

	// ErrInvalidInterval indicates an invalid update interval was specified
	ErrInvalidInterval = errors.New("invalid update interval")
)

// APIError wraps Windows API errors with additional context
type APIError struct {
	Operation string
	Err       error
}

func (e *APIError) Error() string {
	return fmt.Sprintf("%s failed: %v", e.Operation, e.Err)
}

func (e *APIError) Unwrap() error {
	return e.Err
}

// NewAPIError creates a new API error
func NewAPIError(operation string, err error) *APIError {
	return &APIError{
		Operation: operation,
		Err:       err,
	}
}

// IsAccessDenied checks if an error is an access denied error
func IsAccessDenied(err error) bool {
	return errors.Is(err, ErrAccessDenied)
}

// IsNotSupported checks if an error is a not supported error
func IsNotSupported(err error) bool {
	return errors.Is(err, ErrNotSupported)
}
