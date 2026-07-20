package inventory

import (
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	credrepo "github.com/ricardoalcantara/LabKeeper/internal/credentials/repositories"
	"github.com/ricardoalcantara/LabKeeper/internal/inventory/dto"
	"github.com/ricardoalcantara/LabKeeper/internal/inventory/entities"
	"github.com/ricardoalcantara/LabKeeper/internal/inventory/repositories"
	siterepo "github.com/ricardoalcantara/LabKeeper/internal/site/repositories"
)

var (
	ErrInvalidCredential = errors.New("credential not found")
	ErrInvalidSite       = errors.New("site not found")
	ErrMissingSite       = errors.New("site_id is required")
)

type Service struct {
	hosts       *repositories.HostRepository
	credentials *credrepo.CredentialRepository
	sites       *siterepo.SiteRepository
}

func NewService(
	hosts *repositories.HostRepository,
	credentials *credrepo.CredentialRepository,
	sites *siterepo.SiteRepository,
) *Service {
	return &Service{hosts: hosts, credentials: credentials, sites: sites}
}

func (s *Service) MarkAllOffline() error {
	return s.hosts.MarkAllOffline()
}

func (s *Service) UpsertFromAgent(fingerprint, subject, remoteAddr, hostname, osName string, ips []string) (dto.HostResponse, error) {
	now := time.Now().UTC()
	row, err := s.hosts.GetByFingerprint(fingerprint)
	if err != nil && !errors.Is(err, repositories.ErrNotFound) {
		return dto.HostResponse{}, err
	}

	if errors.Is(err, repositories.ErrNotFound) {
		fp := fingerprint
		row = &entities.Host{
			ID:               uuid.NewString(),
			CreatedAt:        now,
			UpdatedAt:        now,
			SiteID:           siterepo.DefaultSiteID,
			Name:             "", // optional friendly label; Agent only fills hostname
			Hostname:         hostname,
			OS:               osName,
			IPs:              encodeIPs(ips),
			RemoteAddr:       remoteAddr,
			Subject:          subject,
			AgentFingerprint: &fp,
			Online:           true,
			ConnectedAt:      &now,
			LastSeen:         &now,
		}
		if err := s.hosts.Create(row); err != nil {
			return dto.HostResponse{}, err
		}
		return s.toResponse(row)
	}

	row.Subject = subject
	row.RemoteAddr = remoteAddr
	if hostname != "" {
		row.Hostname = hostname
	}
	if osName != "" {
		row.OS = osName
	}
	if ips != nil {
		row.IPs = encodeIPs(ips)
	}
	row.Online = true
	row.LastSeen = &now
	row.UpdatedAt = now
	if row.ConnectedAt == nil {
		row.ConnectedAt = &now
	}
	if err := s.hosts.Update(row); err != nil {
		return dto.HostResponse{}, err
	}
	return s.toResponse(row)
}

func (s *Service) Heartbeat(fingerprint, hostname, osName string, ips []string) (dto.HostResponse, bool, error) {
	row, err := s.hosts.GetByFingerprint(fingerprint)
	if err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			return dto.HostResponse{}, false, nil
		}
		return dto.HostResponse{}, false, err
	}

	now := time.Now().UTC()
	if hostname != "" {
		row.Hostname = hostname
	}
	if osName != "" {
		row.OS = osName
	}
	if ips != nil {
		row.IPs = encodeIPs(ips)
	}
	row.Online = true
	row.LastSeen = &now
	row.UpdatedAt = now
	if err := s.hosts.Update(row); err != nil {
		return dto.HostResponse{}, false, err
	}
	resp, err := s.toResponse(row)
	return resp, true, err
}

func (s *Service) MarkOffline(fingerprint string) error {
	row, err := s.hosts.GetByFingerprint(fingerprint)
	if err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			return nil
		}
		return err
	}
	now := time.Now().UTC()
	row.Online = false
	row.LastSeen = &now
	row.UpdatedAt = now
	return s.hosts.Update(row)
}

func (s *Service) List(siteID string) ([]dto.HostResponse, error) {
	rows, err := s.hosts.List(siteID)
	if err != nil {
		return nil, err
	}
	out := make([]dto.HostResponse, 0, len(rows))
	for i := range rows {
		resp, err := s.toResponse(&rows[i])
		if err != nil {
			return nil, err
		}
		out = append(out, resp)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Online != out[j].Online {
			return out[i].Online
		}
		left := out[i].Name
		if left == "" {
			left = out[i].Hostname
		}
		right := out[j].Name
		if right == "" {
			right = out[j].Hostname
		}
		return left < right
	})
	return out, nil
}

func (s *Service) Get(id string) (*dto.HostResponse, error) {
	row, err := s.hosts.GetByID(id)
	if err != nil {
		return nil, err
	}
	resp, err := s.toResponse(row)
	if err != nil {
		return nil, err
	}
	return &resp, nil
}

func (s *Service) Create(req dto.CreateHostRequest) (*dto.HostResponse, error) {
	siteID := strings.TrimSpace(req.SiteID)
	if siteID == "" {
		return nil, ErrMissingSite
	}
	if err := s.ensureSite(siteID); err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	row := &entities.Host{
		ID:        uuid.NewString(),
		CreatedAt: now,
		UpdatedAt: now,
		SiteID:    siteID,
		Name:      strings.TrimSpace(req.Name),
		Hostname:  strings.TrimSpace(req.Hostname),
		Address:   strings.TrimSpace(req.Address),
		OS:        strings.TrimSpace(req.OS),
		IPs:       "[]",
		Online:    false,
	}
	if credID := strings.TrimSpace(req.CredentialID); credID != "" {
		if err := s.ensureCredential(credID); err != nil {
			return nil, err
		}
		row.CredentialID = &credID
	}
	if err := s.hosts.Create(row); err != nil {
		return nil, err
	}
	resp, err := s.toResponse(row)
	if err != nil {
		return nil, err
	}
	return &resp, nil
}

func (s *Service) Update(id string, req dto.UpdateHostRequest) (*dto.HostResponse, error) {
	row, err := s.hosts.GetByID(id)
	if err != nil {
		return nil, err
	}
	if req.SiteID != nil {
		siteID := strings.TrimSpace(*req.SiteID)
		if siteID == "" {
			return nil, ErrMissingSite
		}
		if err := s.ensureSite(siteID); err != nil {
			return nil, err
		}
		row.SiteID = siteID
	}
	if req.Name != nil {
		row.Name = strings.TrimSpace(*req.Name)
	}
	if req.Hostname != nil {
		row.Hostname = strings.TrimSpace(*req.Hostname)
	}
	if req.Address != nil {
		row.Address = strings.TrimSpace(*req.Address)
	}
	if req.OS != nil {
		row.OS = strings.TrimSpace(*req.OS)
	}
	if req.CredentialID != nil {
		credID := strings.TrimSpace(*req.CredentialID)
		if credID == "" {
			row.CredentialID = nil
		} else {
			if err := s.ensureCredential(credID); err != nil {
				return nil, err
			}
			row.CredentialID = &credID
		}
	}
	row.UpdatedAt = time.Now().UTC()
	if err := s.hosts.Update(row); err != nil {
		return nil, err
	}
	resp, err := s.toResponse(row)
	if err != nil {
		return nil, err
	}
	return &resp, nil
}

func (s *Service) Delete(id string) error {
	return s.hosts.Delete(id)
}

// KnownAddresses returns address/IP strings already present in Inventory.
func (s *Service) KnownAddresses() (map[string]struct{}, error) {
	rows, err := s.hosts.List("")
	if err != nil {
		return nil, err
	}
	known := make(map[string]struct{})
	for _, row := range rows {
		if addr := strings.TrimSpace(row.Address); addr != "" {
			known[addr] = struct{}{}
		}
		for _, ip := range decodeIPs(row.IPs) {
			if ip = strings.TrimSpace(ip); ip != "" {
				known[ip] = struct{}{}
			}
		}
	}
	return known, nil
}

func (s *Service) ensureCredential(id string) error {
	if _, err := s.credentials.GetByID(id); err != nil {
		if errors.Is(err, credrepo.ErrNotFound) {
			return ErrInvalidCredential
		}
		return err
	}
	return nil
}

func (s *Service) ensureSite(id string) error {
	if _, err := s.sites.GetByID(id); err != nil {
		if errors.Is(err, siterepo.ErrNotFound) {
			return ErrInvalidSite
		}
		return err
	}
	return nil
}

func (s *Service) toResponse(row *entities.Host) (dto.HostResponse, error) {
	resp := dto.HostResponse{
		ID:          row.ID,
		SiteID:      row.SiteID,
		Name:        row.Name,
		Hostname:    row.Hostname,
		Address:     row.Address,
		OS:          row.OS,
		IPs:         decodeIPs(row.IPs),
		RemoteAddr:  row.RemoteAddr,
		Subject:     row.Subject,
		Online:      row.Online,
		ConnectedAt: row.ConnectedAt,
		LastSeen:    row.LastSeen,
		CPUCores:    row.CPUCores,
		MemoryBytes: row.MemoryBytes,
		CreatedAt:   row.CreatedAt,
		UpdatedAt:   row.UpdatedAt,
	}
	if row.AgentFingerprint != nil {
		resp.AgentFingerprint = *row.AgentFingerprint
	}
	if row.CredentialID != nil && *row.CredentialID != "" {
		resp.CredentialID = *row.CredentialID
		cred, err := s.credentials.GetByID(*row.CredentialID)
		if err == nil {
			resp.Credential = &dto.CredentialSummary{
				ID:       cred.ID,
				Name:     cred.Name,
				Type:     cred.Type,
				Username: cred.Username,
			}
		} else if !errors.Is(err, credrepo.ErrNotFound) {
			return dto.HostResponse{}, fmt.Errorf("load credential: %w", err)
		}
	}
	return resp, nil
}

func encodeIPs(ips []string) string {
	if ips == nil {
		ips = []string{}
	}
	raw, err := json.Marshal(ips)
	if err != nil {
		return "[]"
	}
	return string(raw)
}

func decodeIPs(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	var ips []string
	if err := json.Unmarshal([]byte(raw), &ips); err != nil {
		return nil
	}
	return ips
}
