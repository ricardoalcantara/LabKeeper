package dto

import "time"

type HostResponse struct {
	ID          string    `json:"id"`
	Subject     string    `json:"subject"`
	Hostname    string    `json:"hostname"`
	OS          string    `json:"os,omitempty"`
	IPs         []string  `json:"ips,omitempty"`
	RemoteAddr  string    `json:"remote_addr,omitempty"`
	Online      bool      `json:"online"`
	ConnectedAt time.Time `json:"connected_at"`
	LastSeen    time.Time `json:"last_seen"`
}

type HostListResponse struct {
	Hosts []HostResponse `json:"hosts"`
}
