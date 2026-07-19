package httpapi

const (
	MessageTypePing      = "ping"
	MessageTypePong      = "pong"
	MessageTypeHello     = "hello"
	MessageTypeHeartbeat = "heartbeat"
)

// Message is the Agent ↔ Server WebSocket envelope.
type Message struct {
	Type     string   `json:"type"`
	ID       string   `json:"id,omitempty"`
	From     string   `json:"from,omitempty"`
	Time     string   `json:"time,omitempty"`
	Message  string   `json:"message,omitempty"`
	Hostname string   `json:"hostname,omitempty"`
	OS       string   `json:"os,omitempty"`
	IPs      []string `json:"ips,omitempty"`
	// Reserved for future Agent hardware discovery (ignored until implemented).
	CPUCores    *int   `json:"cpu_cores,omitempty"`
	MemoryBytes *int64 `json:"memory_bytes,omitempty"`
}
