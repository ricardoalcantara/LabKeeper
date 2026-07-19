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
)

var (
	ErrInvalidCredential = errors.New("credential not found")
)

type Service struct {
	hosts       *repositories.HostRepository
	credentials *credrepo.CredentialRepository
}

func NewService(hosts *repositories.HostRepository, credentials *credrepo.CredentialRepository) *Service {
	return &Service{hosts: hosts, credentials: credentials}
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

func (s *Service) List() ([]dto.HostResponse, error) {
	rows, err := s.hosts.List()
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
	now := time.Now().UTC()
	row := &entities.Host{
		ID:        uuid.NewString(),
		CreatedAt: now,
		UpdatedAt: now,
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

func (s *Service) ensureCredential(id string) error {
	if _, err := s.credentials.GetByID(id); err != nil {
		if errors.Is(err, credrepo.ErrNotFound) {
			return ErrInvalidCredential
		}
		return err
	}
	return nil
}

func (s *Service) toResponse(row *entities.Host) (dto.HostResponse, error) {
	resp := dto.HostResponse{
		ID:          row.ID,
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
