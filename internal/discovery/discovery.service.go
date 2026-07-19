package discovery

import (
	"context"
	"errors"
	"strings"

	"github.com/ricardoalcantara/LabKeeper/internal/inventory"
)

var (
	ErrDiscoveryDisabled = errors.New("discovery disabled: no private network interface")
	ErrInvalidCIDR       = errors.New("invalid or disallowed cidr")
)

type StatusResponse struct {
	Enabled  bool      `json:"enabled"`
	Networks []Network `json:"networks"`
}

type ScanRequest struct {
	CIDR string `json:"cidr" binding:"required"`
}

type ScanResponse struct {
	CIDR       string      `json:"cidr"`
	Candidates []Candidate `json:"candidates"`
}

type Service struct {
	inventory *inventory.Service
}

func NewService(inv *inventory.Service) *Service {
	return &Service{inventory: inv}
}

func (s *Service) Status() (StatusResponse, error) {
	networks, err := listPrivateNetworks()
	if err != nil {
		return StatusResponse{}, err
	}
	return StatusResponse{
		Enabled:  len(networks) > 0,
		Networks: networks,
	}, nil
}

func (s *Service) Scan(ctx context.Context, cidr string) (*ScanResponse, error) {
	status, err := s.Status()
	if err != nil {
		return nil, err
	}
	if !status.Enabled {
		return nil, ErrDiscoveryDisabled
	}

	prefix, err := validateScanCIDR(strings.TrimSpace(cidr))
	if err != nil {
		return nil, errors.Join(ErrInvalidCIDR, err)
	}

	known, err := s.inventory.KnownAddresses()
	if err != nil {
		return nil, err
	}

	candidates, err := scanCIDR(ctx, prefix, known)
	if err != nil && !errors.Is(err, context.DeadlineExceeded) && !errors.Is(err, context.Canceled) {
		return nil, err
	}
	// Partial results on deadline are OK.
	return &ScanResponse{
		CIDR:       prefix.String(),
		Candidates: candidates,
	}, nil
}
