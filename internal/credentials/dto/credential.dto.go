package dto

import "time"

type CredentialResponse struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Type      string    `json:"type"`
	Username  string    `json:"username"`
	PublicKey string    `json:"public_key,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type CredentialListResponse struct {
	Credentials []CredentialResponse `json:"credentials"`
}

type CreateCredentialRequest struct {
	Name       string `json:"name"        binding:"required"`
	Type       string `json:"type"        binding:"required"`
	Username   string `json:"username"    binding:"required"`
	Password   string `json:"password"`
	PrivateKey string `json:"private_key"`
}

type UpdateCredentialRequest struct {
	Name       string `json:"name"`
	Username   string `json:"username"`
	Password   string `json:"password"`
	PrivateKey string `json:"private_key"`
}
