package entities

import "time"

type Host struct {
	ID               string     `gorm:"column:id;primaryKey"`
	CreatedAt        time.Time  `gorm:"column:created_at;not null"`
	UpdatedAt        time.Time  `gorm:"column:updated_at;not null"`
	Name             string     `gorm:"column:name;not null"`
	Hostname         string     `gorm:"column:hostname;not null"`
	Address          string     `gorm:"column:address;not null"`
	OS               string     `gorm:"column:os;not null"`
	IPs              string     `gorm:"column:ips;not null"` // JSON array
	RemoteAddr       string     `gorm:"column:remote_addr;not null"`
	Subject          string     `gorm:"column:subject;not null"`
	AgentFingerprint *string    `gorm:"column:agent_fingerprint;uniqueIndex"`
	Online           bool       `gorm:"column:online;not null"`
	ConnectedAt      *time.Time `gorm:"column:connected_at"`
	LastSeen         *time.Time `gorm:"column:last_seen"`
	CPUCores         *int       `gorm:"column:cpu_cores"`
	MemoryBytes      *int64     `gorm:"column:memory_bytes"`
	CredentialID     *string    `gorm:"column:credential_id"`
}

func (Host) TableName() string { return "hosts" }
