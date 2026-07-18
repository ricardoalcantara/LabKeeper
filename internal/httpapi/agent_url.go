package httpapi

import (
	"os"
	"path/filepath"
)

const WebSocketPath = "/ws"

// DefaultAgentAddr is the Server's dedicated mTLS WebSocket listen address for Agents.
const DefaultAgentAddr = "127.0.0.1:8443"

func ServerURLFilePath() string {
	return filepath.Join(os.TempDir(), "labkeeper-server-url")
}
