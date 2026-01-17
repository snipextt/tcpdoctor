//go:build windows

package tcpmonitor

import "tcpdoctor/internal/tcpmonitor/winapi"

// WindowsAPILayer alias for Windows builds
type WindowsAPILayer = winapi.WindowsAPILayer
