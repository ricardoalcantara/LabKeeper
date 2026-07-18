package entities

import "time"

const (
	TypePassword = "password"
	TypeSSHKey   = "ssh_key"
)

type Credential struct {
	ID               string    `gorm:"column:id;primaryKey"`
	CreatedAt        time.Time `gorm:"column:created_at;not null"`
	UpdatedAt        time.Time `gorm:"column:updated_at;not null"`
	Name             string    `gorm:"column:name;not null"`
	Type             string    `gorm:"column:type;not null"`
	Username         string    `gorm:"column:username;not null"`
	SecretCiphertext []byte    `gorm:"column:secret_ciphertext;not null"`
	PublicKey        string    `gorm:"column:public_key"`
}

func (Credential) TableName() string { return "credentials" }
