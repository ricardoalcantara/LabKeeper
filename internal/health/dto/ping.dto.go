package dto

type PingResponse struct {
	Status  string         `json:"status"`
	Message string         `json:"message"`
	Time    string         `json:"time"`
	Subject string         `json:"subject,omitempty"`
	Name    string         `json:"name,omitempty"`
	Roles   []string       `json:"roles,omitempty"`
	Claims  map[string]any `json:"claims,omitempty"`
}
