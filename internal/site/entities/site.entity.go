package entities

import "time"

type Site struct {
	ID               string    `gorm:"column:id;primaryKey"`
	CreatedAt        time.Time `gorm:"column:created_at;not null"`
	UpdatedAt        time.Time `gorm:"column:updated_at;not null"`
	Name             string    `gorm:"column:name;not null;uniqueIndex"`
	DiscoveryEnabled bool      `gorm:"column:discovery_enabled;not null"`
}

func (Site) TableName() string { return "sites" }
