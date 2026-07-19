package dto

import "time"

type CredentialSummary struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Type     string `json:"type"`
	Username string `json:"username"`
}

type HostResponse struct {
	ID               string             `json:"id"`
	Name             string             `json:"name"`
	Hostname         string             `json:"hostname"`
	Address          string             `json:"address,omitempty"`
	OS               string             `json:"os,omitempty"`
	IPs              []string           `json:"ips,omitempty"`
	RemoteAddr       string             `json:"remote_addr,omitempty"`
	Subject          string             `json:"subject,omitempty"`
	AgentFingerprint string             `json:"agent_fingerprint,omitempty"`
	Online           bool               `json:"online"`
	ConnectedAt      *time.Time         `json:"connected_at,omitempty"`
	LastSeen         *time.Time         `json:"last_seen,omitempty"`
	CPUCores         *int               `json:"cpu_cores,omitempty"`
	MemoryBytes      *int64             `json:"memory_bytes,omitempty"`
	CredentialID     string             `json:"credential_id,omitempty"`
	Credential       *CredentialSummary `json:"credential,omitempty"`
	CreatedAt        time.Time          `json:"created_at"`
	UpdatedAt        time.Time          `json:"updated_at"`
}

type HostListResponse struct {
	Hosts []HostResponse `json:"hosts"`
}

type CreateHostRequest struct {
	Name         string `json:"name"`
	Hostname     string `json:"hostname"`
	Address      string `json:"address"`
	OS           string `json:"os"`
	CredentialID string `json:"credential_id"`
}

type UpdateHostRequest struct {
	Name         *string `json:"name"`
	Hostname     *string `json:"hostname"`
	Address      *string `json:"address"`
	OS           *string `json:"os"`
	CredentialID *string `json:"credential_id"`
}
