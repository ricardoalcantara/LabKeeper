package dto

import "time"

type CredentialResponse struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	Type            string    `json:"type"`
	Username        string    `json:"username"`
	PublicKey       string    `json:"public_key,omitempty"`
	HasPassphrase   bool      `json:"has_passphrase"`
	BecomeMethod    string    `json:"become_method"`
	BecomeUser      string    `json:"become_user,omitempty"`
	HasBecomeSecret bool      `json:"has_become_secret"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type CredentialListResponse struct {
	Credentials []CredentialResponse `json:"credentials"`
}

type CreateCredentialRequest struct {
	Name         string `json:"name"          binding:"required"`
	Type         string `json:"type"          binding:"required"`
	Username     string `json:"username"      binding:"required"`
	Password     string `json:"password"`
	PrivateKey   string `json:"private_key"`
	Passphrase   string `json:"passphrase"`
	BecomeMethod string `json:"become_method"`
	BecomeUser   string `json:"become_user"`
	BecomeSecret string `json:"become_secret"`
}

type UpdateCredentialRequest struct {
	Name         string  `json:"name"`
	Username     string  `json:"username"`
	Password     string  `json:"password"`
	PrivateKey   string  `json:"private_key"`
	Passphrase   *string `json:"passphrase"`
	BecomeMethod *string `json:"become_method"`
	BecomeUser   *string `json:"become_user"`
	BecomeSecret *string `json:"become_secret"`
}

// GenerateSSHKeyResponse is returned once by ssh-keygen; the private key is not stored.
type GenerateSSHKeyResponse struct {
	PrivateKey string `json:"private_key"`
	PublicKey  string `json:"public_key"`
}
