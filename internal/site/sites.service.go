package site

import (
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/ricardoalcantara/LabKeeper/internal/site/dto"
	"github.com/ricardoalcantara/LabKeeper/internal/site/entities"
	"github.com/ricardoalcantara/LabKeeper/internal/site/repositories"
)

var (
	ErrSiteHasHosts = errors.New("site has hosts")
	ErrMissingName  = errors.New("name is required")
)

type Service struct {
	sites *repositories.SiteRepository
}

func NewService(sites *repositories.SiteRepository) *Service {
	return &Service{sites: sites}
}

func (s *Service) List() ([]dto.SiteResponse, error) {
	rows, err := s.sites.List()
	if err != nil {
		return nil, err
	}
	out := make([]dto.SiteResponse, 0, len(rows))
	for _, row := range rows {
		out = append(out, toResponse(row))
	}
	return out, nil
}

func (s *Service) Get(id string) (*dto.SiteResponse, error) {
	row, err := s.sites.GetByID(id)
	if err != nil {
		return nil, err
	}
	resp := toResponse(*row)
	return &resp, nil
}

func (s *Service) Create(req dto.CreateSiteRequest) (*dto.SiteResponse, error) {
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return nil, ErrMissingName
	}
	discoveryEnabled := false
	if req.DiscoveryEnabled != nil {
		discoveryEnabled = *req.DiscoveryEnabled
	}
	now := time.Now().UTC()
	row := &entities.Site{
		ID:               uuid.NewString(),
		CreatedAt:        now,
		UpdatedAt:        now,
		Name:             name,
		DiscoveryEnabled: discoveryEnabled,
	}
	if err := s.sites.Create(row); err != nil {
		return nil, err
	}
	resp := toResponse(*row)
	return &resp, nil
}

func (s *Service) Update(id string, req dto.UpdateSiteRequest) (*dto.SiteResponse, error) {
	row, err := s.sites.GetByID(id)
	if err != nil {
		return nil, err
	}
	if req.Name != nil {
		name := strings.TrimSpace(*req.Name)
		if name == "" {
			return nil, ErrMissingName
		}
		row.Name = name
	}
	if req.DiscoveryEnabled != nil {
		row.DiscoveryEnabled = *req.DiscoveryEnabled
	}
	row.UpdatedAt = time.Now().UTC()
	if err := s.sites.Update(row); err != nil {
		return nil, err
	}
	resp := toResponse(*row)
	return &resp, nil
}

func (s *Service) Delete(id string) error {
	if _, err := s.sites.GetByID(id); err != nil {
		return err
	}
	count, err := s.sites.CountHosts(id)
	if err != nil {
		return err
	}
	if count > 0 {
		return ErrSiteHasHosts
	}
	return s.sites.Delete(id)
}

func (s *Service) DefaultSiteID() string {
	return repositories.DefaultSiteID
}

func toResponse(row entities.Site) dto.SiteResponse {
	return dto.SiteResponse{
		ID:               row.ID,
		Name:             row.Name,
		DiscoveryEnabled: row.DiscoveryEnabled,
		CreatedAt:        row.CreatedAt,
		UpdatedAt:        row.UpdatedAt,
	}
}
