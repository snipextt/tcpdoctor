# TCP Monitor Internal Package

This package provides the core functionality for monitoring TCP connections on Windows systems.

## Structure

```
internal/tcpmonitor/
├── winapi/              # Windows API layer
│   ├── api.go          # Windows API syscall wrappers (Windows only)
│   ├── api_stub.go     # Stub implementation for non-Windows platforms
│   ├── types.go        # Windows API structure definitions (Windows only)
│   ├── types_stub.go   # Stub types for non-Windows platforms
│   ├── helpers.go      # Helper functions for data conversion (Windows only)
│   ├── helpers_stub.go # Stub helpers for non-Windows platforms
│   └── *_test.go       # Unit tests
├── logger.go           # Logging infrastructure
├── errors.go           # Error types and handling
└── README.md           # This file
```

## Windows API Layer

The `winapi` package provides low-level access to Windows TCP statistics APIs through syscall wrappers.

### Key Components

#### API Functions

- **GetExtendedTcpTable**: Retrieves a table of TCP connections (IPv4 or IPv6)
- **SetPerTcpConnectionEStats**: Enables extended statistics collection for a connection
- **GetPerTcpConnectionEStats**: Retrieves extended statistics for a connection
- **IsAdministrator**: Checks if the process has administrator privileges

#### Data Structures

- **MIB_TCPROW_OWNER_PID**: IPv4 TCP connection information
- **MIB_TCP6ROW_OWNER_PID**: IPv6 TCP connection information
- **TCP_ESTATS_*_ROD_v0**: Various extended statistics structures
  - Data transfer metrics
  - Congestion control metrics
  - RTT (Round Trip Time) metrics
  - Receiver statistics
  - Send buffer statistics
  - Bandwidth estimates

#### Helper Functions

- **ConvertPort**: Converts port numbers from network byte order to host byte order
- **ConvertIPv4Address**: Converts IPv4 addresses from uint32 to string
- **ConvertIPv6Address**: Converts IPv6 addresses from byte array to string
- **ParseTCPTable**: Parses raw buffer into IPv4 connection structures
- **ParseTCP6Table**: Parses raw buffer into IPv6 connection structures
- **TCPStateToString**: Converts TCP state constants to readable strings

## Error Handling

The package provides structured error handling with the following error types:

- **ErrNotSupported**: Operation not supported on this platform
- **ErrAccessDenied**: Administrator privileges required
- **ErrInvalidParameter**: Invalid parameter provided
- **ErrConnectionNotFound**: Connection not found
- **ErrInvalidInterval**: Invalid update interval

Use `IsAccessDenied()` and `IsNotSupported()` helper functions to check error types.

## Logging

The package includes a structured logger with multiple log levels:

- **Debug**: Detailed debugging information
- **Info**: General informational messages
- **Warn**: Warning messages
- **Error**: Error messages

Usage:
```go
logger := tcpmonitor.GetLogger()
logger.Info("Starting TCP monitor")
logger.WithError(err, "Failed to retrieve connections")
```

## Platform Support

The package is designed for Windows but includes stub implementations for other platforms to allow compilation. The actual functionality is only available on Windows.

Build tags are used to select the appropriate implementation:
- `// +build windows` - Windows implementation
- `// +build !windows` - Stub implementation

## Requirements

- Go 1.23 or later
- Windows OS (for actual functionality)
- Administrator privileges (for extended statistics)

## Testing

Run tests with:
```bash
go test ./internal/tcpmonitor/...
```

Tests are platform-aware and will run appropriate tests based on the build platform.
