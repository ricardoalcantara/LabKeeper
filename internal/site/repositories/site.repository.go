package repositories

import (
	"errors"

	"github.com/ricardoalcantara/LabKeeper/internal/site/entities"
	"gorm.io/gorm"
)

var ErrNotFound = errors.New("site not found")

// DefaultSiteID is the seeded Default site from migrations/00001_init.sql.
const DefaultSiteID = "00000000-0000-4000-8000-000000000001"

type SiteRepository struct {
	db *gorm.DB
}

func NewSiteRepository(db *gorm.DB) *SiteRepository {
	return &SiteRepository{db: db}
}

func (r *SiteRepository) List() ([]entities.Site, error) {
	var rows []entities.Site
	if err := r.db.Order("name ASC").Find(&rows).Error; err != nil {
		return nil, err
	}
	return rows, nil
}

func (r *SiteRepository) GetByID(id string) (*entities.Site, error) {
	var row entities.Site
	if err := r.db.Where("id = ?", id).First(&row).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &row, nil
}

func (r *SiteRepository) Create(row *entities.Site) error {
	return r.db.Create(row).Error
}

func (r *SiteRepository) Update(row *entities.Site) error {
	return r.db.Select("*").Updates(row).Error
}

func (r *SiteRepository) Delete(id string) error {
	result := r.db.Where("id = ?", id).Delete(&entities.Site{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *SiteRepository) CountHosts(siteID string) (int64, error) {
	var count int64
	if err := r.db.Table("hosts").Where("site_id = ?", siteID).Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}
