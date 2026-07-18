package repositories

import (
	"errors"

	"github.com/ricardoalcantara/LabKeeper/internal/credentials/entities"
	"gorm.io/gorm"
)

var ErrNotFound = errors.New("credential not found")

type CredentialRepository struct {
	db *gorm.DB
}

func NewCredentialRepository(db *gorm.DB) *CredentialRepository {
	return &CredentialRepository{db: db}
}

func (r *CredentialRepository) List() ([]entities.Credential, error) {
	var rows []entities.Credential
	if err := r.db.Order("name ASC").Find(&rows).Error; err != nil {
		return nil, err
	}
	return rows, nil
}

func (r *CredentialRepository) GetByID(id string) (*entities.Credential, error) {
	var row entities.Credential
	if err := r.db.Where("id = ?", id).First(&row).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &row, nil
}

func (r *CredentialRepository) Create(row *entities.Credential) error {
	return r.db.Create(row).Error
}

func (r *CredentialRepository) Update(row *entities.Credential) error {
	return r.db.Save(row).Error
}

func (r *CredentialRepository) Delete(id string) error {
	result := r.db.Where("id = ?", id).Delete(&entities.Credential{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}
