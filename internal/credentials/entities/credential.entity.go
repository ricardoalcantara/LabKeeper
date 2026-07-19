package entities

import "time"

const (
	TypePassword = "password"
	TypeSSHKey   = "ssh_key"

	BecomeNone = "none"
	BecomeSudo = "sudo"
	BecomeSu   = "su"
)

type Credential struct {
	ID                     string    `gorm:"column:id;primaryKey"`
	CreatedAt              time.Time `gorm:"column:created_at;not null"`
	UpdatedAt              time.Time `gorm:"column:updated_at;not null"`
	Name                   string    `gorm:"column:name;not null"`
	Type                   string    `gorm:"column:type;not null"`
	Username               string    `gorm:"column:username;not null"`
	SecretCiphertext       []byte    `gorm:"column:secret_ciphertext;not null"`
	PublicKey              string    `gorm:"column:public_key"`
	PassphraseCiphertext   []byte    `gorm:"column:passphrase_ciphertext"`
	BecomeMethod           string    `gorm:"column:become_method;not null"`
	BecomeUser             string    `gorm:"column:become_user;not null"`
	BecomeSecretCiphertext []byte    `gorm:"column:become_secret_ciphertext"`
}

func (Credential) TableName() string { return "credentials" }
