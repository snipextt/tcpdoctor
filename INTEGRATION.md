# Wails Backend Integration

This document describes the integration between the TCP monitoring backend and the Wails frontend.

## Overview

The TCP monitoring service has been successfully integrated with the Wails framework, allowing the React frontend to call backend methods through automatically generated TypeScript bindings.

## Integration Points

### 1. Service Initialization

The `App` struct in `app.go` now:
- Creates and initializes the TCP monitoring service on startup
- Starts the polling loop for connection updates
- Gracefully shuts down the service when the application closes

### 2. Exposed Backend Methods

The following methods are exposed to the frontend through Wails bindings:

#### Connection Management
- `GetConnections(filter FilterOptions)` - Returns all connections matching filter criteria
- `GetConnectionStats(localAddr, localPort, remoteAddr, remotePort)` - Gets detailed stats for a specific connection
- `GetConnectionCount()` - Returns the total number of tracked connections
- `ClearSelection()` - Clears the currently selected connection

#### Configuration
- `IsAdministrator()` - Returns whether the app is running with admin privileges
- `SetUpdateInterval(ms int)` - Changes the polling interval (in milliseconds)
- `GetUpdateInterval()` - Returns the current update interval in milliseconds

#### Health Thresholds
- `GetHealthThresholds()` - Returns current health indicator thresholds
- `SetHealthThresholds(thresholds)` - Updates all health thresholds
- `SetRetransmissionThreshold(percent)` - Updates only the retransmission threshold
- `SetRTTThreshold(milliseconds)` - Updates only the RTT threshold

#### Export
- `ExportToCSV(path string)` - Exports all current connections to a CSV file

### 3. TypeScript Bindings

Wails automatically generates TypeScript bindings in `frontend/wailsjs/go/`:
- `main/App.d.ts` - TypeScript type definitions for all exposed methods
- `main/App.js` - JavaScript implementation that calls the Go backend
- `models.ts` - TypeScript classes for all Go structs (ConnectionInfo, FilterOptions, etc.)

### 4. Application Lifecycle

```
Startup:
1. Wails calls app.startup()
2. TCP monitoring service is created with default config
3. Service.Start() begins the polling loop
4. Frontend can now call backend methods

Shutdown:
1. User closes the application
2. Wails calls app.shutdown()
3. Service.Stop() gracefully stops the polling loop
4. All goroutines are cleaned up
```

## Testing the Integration

The frontend has been updated with a test component that:
1. Calls `IsAdministrator()` to check privilege level
2. Calls `GetUpdateInterval()` to verify configuration
3. Calls `GetConnectionCount()` to get the number of connections
4. Polls `GetConnections()` every second to display live connection data

To test the integration:
```bash
# Build and run the application
wails dev

# Or build for production
wails build
```

## Platform Support

The TCP monitoring service is Windows-only. For development on non-Windows platforms:
- A stub implementation is provided in `internal/tcpmonitor/stub.go`
- The stub allows the application to compile and run on macOS/Linux
- All backend methods return appropriate "not supported" errors on non-Windows platforms

## Error Handling

All backend methods that can fail return errors:
- Frontend receives errors as rejected promises
- Service initialization failures are logged to console
- Individual API call failures are handled gracefully without crashing the app

## Next Steps

With the backend integration complete, the next tasks are:
1. Implement the frontend UI components (Connection Table, Statistics Panel, Filter Controls)
2. Add real-time data visualization
3. Implement CSV export with file save dialog
4. Add responsive layout and styling
