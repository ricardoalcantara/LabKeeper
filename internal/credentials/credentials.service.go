package credentials

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/ricardoalcantara/LabKeeper/internal/credentials/dto"
	"github.com/ricardoalcantara/LabKeeper/internal/credentials/entities"
	"github.com/ricardoalcantara/LabKeeper/internal/credentials/repositories"
	"github.com/ricardoalcantara/LabKeeper/internal/crypto"
	"golang.org/x/crypto/ssh"
)

var (
	ErrInvalidType   = errors.New("invalid credential type")
	ErrMissingSecret = errors.New("missing secret for credential type")
	ErrInvalidKey    = errors.New("invalid ssh private key")
)

type Service struct {
	repo   *repositories.CredentialRepository
	crypto *crypto.CryptoService
}

func NewService(repo *repositories.CredentialRepository, cryptoSvc *crypto.CryptoService) *Service {
	return &Service{repo: repo, crypto: cryptoSvc}
}

func (s *Service) List() ([]dto.CredentialResponse, error) {
	rows, err := s.repo.List()
	if err != nil {
		return nil, err
	}
	out := make([]dto.CredentialResponse, 0, len(rows))
	for _, row := range rows {
		out = append(out, toResponse(row))
	}
	return out, nil
}

func (s *Service) Get(id string) (*dto.CredentialResponse, error) {
	row, err := s.repo.GetByID(id)
	if err != nil {
		return nil, err
	}
	resp := toResponse(*row)
	return &resp, nil
}

func (s *Service) Create(req dto.CreateCredentialRequest) (*dto.CredentialResponse, error) {
	credType := strings.TrimSpace(req.Type)
	secret, publicKey, err := s.prepareSecret(credType, req.Password, req.PrivateKey, true)
	if err != nil {
		return nil, err
	}

	ciphertext, err := s.crypto.Encrypt(secret)
	if err != nil {
		return nil, fmt.Errorf("encrypt secret: %w", err)
	}

	now := time.Now().UTC()
	row := &entities.Credential{
		ID:               uuid.NewString(),
		CreatedAt:        now,
		UpdatedAt:        now,
		Name:             strings.TrimSpace(req.Name),
		Type:             credType,
		Username:         strings.TrimSpace(req.Username),
		SecretCiphertext: ciphertext,
		PublicKey:        publicKey,
	}
	if err := s.repo.Create(row); err != nil {
		return nil, err
	}
	resp := toResponse(*row)
	return &resp, nil
}

func (s *Service) Update(id string, req dto.UpdateCredentialRequest) (*dto.CredentialResponse, error) {
	row, err := s.repo.GetByID(id)
	if err != nil {
		return nil, err
	}

	if name := strings.TrimSpace(req.Name); name != "" {
		row.Name = name
	}
	if username := strings.TrimSpace(req.Username); username != "" {
		row.Username = username
	}

	if req.Password != "" || req.PrivateKey != "" {
		secret, publicKey, err := s.prepareSecret(row.Type, req.Password, req.PrivateKey, true)
		if err != nil {
			return nil, err
		}
		ciphertext, err := s.crypto.Encrypt(secret)
		if err != nil {
			return nil, fmt.Errorf("encrypt secret: %w", err)
		}
		row.SecretCiphertext = ciphertext
		row.PublicKey = publicKey
	}

	row.UpdatedAt = time.Now().UTC()
	if err := s.repo.Update(row); err != nil {
		return nil, err
	}
	resp := toResponse(*row)
	return &resp, nil
}

func (s *Service) Delete(id string) error {
	return s.repo.Delete(id)
}

func (s *Service) prepareSecret(credType, password, privateKey string, required bool) (secret []byte, publicKey string, err error) {
	switch credType {
	case entities.TypePassword:
		if password == "" {
			if required {
				return nil, "", ErrMissingSecret
			}
			return nil, "", nil
		}
		return []byte(password), "", nil
	case entities.TypeSSHKey:
		if privateKey == "" {
			if required {
				return nil, "", ErrMissingSecret
			}
			return nil, "", nil
		}
		signer, err := ssh.ParsePrivateKey([]byte(privateKey))
		if err != nil {
			return nil, "", fmt.Errorf("%w: %v", ErrInvalidKey, err)
		}
		pub := strings.TrimSpace(string(ssh.MarshalAuthorizedKey(signer.PublicKey())))
		return []byte(privateKey), pub, nil
	default:
		return nil, "", ErrInvalidType
	}
}

func toResponse(row entities.Credential) dto.CredentialResponse {
	return dto.CredentialResponse{
		ID:        row.ID,
		Name:      row.Name,
		Type:      row.Type,
		Username:  row.Username,
		PublicKey: row.PublicKey,
		CreatedAt: row.CreatedAt,
		UpdatedAt: row.UpdatedAt,
	}
}
