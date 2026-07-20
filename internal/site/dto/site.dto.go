package dto

import "time"

type SiteResponse struct {
	ID               string    `json:"id"`
	Name             string    `json:"name"`
	DiscoveryEnabled bool      `json:"discovery_enabled"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

type SiteListResponse struct {
	Sites []SiteResponse `json:"sites"`
}

type CreateSiteRequest struct {
	Name             string `json:"name"`
	DiscoveryEnabled *bool  `json:"discovery_enabled"`
}

type UpdateSiteRequest struct {
	Name             *string `json:"name"`
	DiscoveryEnabled *bool   `json:"discovery_enabled"`
}
