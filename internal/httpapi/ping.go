package httpapi

const WebSocketPath = "/ws"

const (
	MessageTypePing = "ping"
	MessageTypePong = "pong"
)

type Message struct {
	Type    string `json:"type"`
	ID      string `json:"id,omitempty"`
	From    string `json:"from,omitempty"`
	Time    string `json:"time,omitempty"`
	Message string `json:"message,omitempty"`
}
