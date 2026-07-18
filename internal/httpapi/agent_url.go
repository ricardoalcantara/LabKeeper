package httpapi

import (
	"os"
	"path/filepath"
)

const DefaultServerAddr = "127.0.0.1:0"

func ServerURLFilePath() string {
	return filepath.Join(os.TempDir(), "labkeeper-server-url")
}
