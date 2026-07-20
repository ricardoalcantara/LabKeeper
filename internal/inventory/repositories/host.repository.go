package repositories

import (
	"errors"

	"github.com/ricardoalcantara/LabKeeper/internal/inventory/entities"
	"gorm.io/gorm"
)

var ErrNotFound = errors.New("host not found")

type HostRepository struct {
	db *gorm.DB
}

func NewHostRepository(db *gorm.DB) *HostRepository {
	return &HostRepository{db: db}
}

func (r *HostRepository) List(siteID string) ([]entities.Host, error) {
	var rows []entities.Host
	q := r.db
	if siteID != "" {
		q = q.Where("site_id = ?", siteID)
	}
	if err := q.Find(&rows).Error; err != nil {
		return nil, err
	}
	return rows, nil
}

func (r *HostRepository) GetByID(id string) (*entities.Host, error) {
	var row entities.Host
	if err := r.db.Where("id = ?", id).First(&row).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &row, nil
}

func (r *HostRepository) GetByFingerprint(fingerprint string) (*entities.Host, error) {
	var row entities.Host
	if err := r.db.Where("agent_fingerprint = ?", fingerprint).First(&row).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &row, nil
}

func (r *HostRepository) Create(row *entities.Host) error {
	return r.db.Create(row).Error
}

func (r *HostRepository) Update(row *entities.Host) error {
	// Select all columns so nil CredentialID / AgentFingerprint persist as NULL.
	return r.db.Select("*").Updates(row).Error
}

func (r *HostRepository) Delete(id string) error {
	result := r.db.Where("id = ?", id).Delete(&entities.Host{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *HostRepository) MarkAllOffline() error {
	return r.db.Model(&entities.Host{}).Where("online = ?", true).Updates(map[string]any{
		"online": false,
	}).Error
}
