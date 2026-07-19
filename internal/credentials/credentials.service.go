package credentials

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/pem"
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
	ErrInvalidType         = errors.New("invalid credential type")
	ErrMissingSecret       = errors.New("missing secret for credential type")
	ErrInvalidKey          = errors.New("invalid ssh private key")
	ErrInvalidBecomeMethod = errors.New("invalid become method")
	ErrPassphraseNotSSH    = errors.New("passphrase is only valid for ssh_key credentials")
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
	passphrase := req.Passphrase
	if passphrase != "" && credType != entities.TypeSSHKey {
		return nil, ErrPassphraseNotSSH
	}

	secret, publicKey, err := s.prepareSecret(credType, req.Password, req.PrivateKey, passphrase, true)
	if err != nil {
		return nil, err
	}

	ciphertext, err := s.crypto.Encrypt(secret)
	if err != nil {
		return nil, fmt.Errorf("encrypt secret: %w", err)
	}

	becomeMethod, becomeUser, err := normalizeBecome(req.BecomeMethod, req.BecomeUser)
	if err != nil {
		return nil, err
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
		BecomeMethod:     becomeMethod,
		BecomeUser:       becomeUser,
	}

	if passphrase != "" {
		enc, err := s.crypto.Encrypt([]byte(passphrase))
		if err != nil {
			return nil, fmt.Errorf("encrypt passphrase: %w", err)
		}
		row.PassphraseCiphertext = enc
	}

	if becomeMethod != entities.BecomeNone && strings.TrimSpace(req.BecomeSecret) != "" {
		enc, err := s.crypto.Encrypt([]byte(req.BecomeSecret))
		if err != nil {
			return nil, fmt.Errorf("encrypt become secret: %w", err)
		}
		row.BecomeSecretCiphertext = enc
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

	passphraseForParse := ""
	if req.Passphrase != nil {
		passphraseForParse = *req.Passphrase
	} else if len(row.PassphraseCiphertext) > 0 {
		plain, err := s.crypto.Decrypt(row.PassphraseCiphertext)
		if err != nil {
			return nil, fmt.Errorf("decrypt passphrase: %w", err)
		}
		passphraseForParse = string(plain)
	}

	if req.Password != "" || req.PrivateKey != "" {
		if req.Passphrase != nil && *req.Passphrase != "" && row.Type != entities.TypeSSHKey {
			return nil, ErrPassphraseNotSSH
		}
		secret, publicKey, err := s.prepareSecret(row.Type, req.Password, req.PrivateKey, passphraseForParse, true)
		if err != nil {
			return nil, err
		}
		ciphertext, err := s.crypto.Encrypt(secret)
		if err != nil {
			return nil, fmt.Errorf("encrypt secret: %w", err)
		}
		row.SecretCiphertext = ciphertext
		row.PublicKey = publicKey
	} else if req.Passphrase != nil && *req.Passphrase != "" && row.Type == entities.TypeSSHKey {
		// Validate new passphrase against stored private key.
		plainKey, err := s.crypto.Decrypt(row.SecretCiphertext)
		if err != nil {
			return nil, fmt.Errorf("decrypt private key: %w", err)
		}
		if _, _, err := s.prepareSecret(row.Type, "", string(plainKey), *req.Passphrase, true); err != nil {
			return nil, err
		}
	}

	if req.Passphrase != nil {
		if row.Type != entities.TypeSSHKey && *req.Passphrase != "" {
			return nil, ErrPassphraseNotSSH
		}
		if *req.Passphrase == "" {
			row.PassphraseCiphertext = nil
		} else {
			enc, err := s.crypto.Encrypt([]byte(*req.Passphrase))
			if err != nil {
				return nil, fmt.Errorf("encrypt passphrase: %w", err)
			}
			row.PassphraseCiphertext = enc
		}
	}

	if req.BecomeMethod != nil || req.BecomeUser != nil {
		method := row.BecomeMethod
		user := row.BecomeUser
		if req.BecomeMethod != nil {
			method = *req.BecomeMethod
		}
		if req.BecomeUser != nil {
			user = *req.BecomeUser
		}
		normalizedMethod, normalizedUser, err := normalizeBecome(method, user)
		if err != nil {
			return nil, err
		}
		row.BecomeMethod = normalizedMethod
		row.BecomeUser = normalizedUser
		if normalizedMethod == entities.BecomeNone {
			row.BecomeSecretCiphertext = nil
		}
	}

	if req.BecomeSecret != nil {
		if row.BecomeMethod == entities.BecomeNone {
			row.BecomeSecretCiphertext = nil
		} else if *req.BecomeSecret == "" {
			row.BecomeSecretCiphertext = nil
		} else {
			enc, err := s.crypto.Encrypt([]byte(*req.BecomeSecret))
			if err != nil {
				return nil, fmt.Errorf("encrypt become secret: %w", err)
			}
			row.BecomeSecretCiphertext = enc
		}
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

// GenerateSSHKey creates an Ed25519 OpenSSH key pair. Nothing is persisted.
func (s *Service) GenerateSSHKey() (*dto.GenerateSSHKeyResponse, error) {
	_, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("generate ed25519 key: %w", err)
	}

	block, err := ssh.MarshalPrivateKey(priv, "labkeeper")
	if err != nil {
		return nil, fmt.Errorf("marshal private key: %w", err)
	}
	privatePEM := string(pem.EncodeToMemory(block))

	signer, err := ssh.NewSignerFromKey(priv)
	if err != nil {
		return nil, fmt.Errorf("signer from key: %w", err)
	}
	publicKey := strings.TrimSpace(string(ssh.MarshalAuthorizedKey(signer.PublicKey())))

	return &dto.GenerateSSHKeyResponse{
		PrivateKey: privatePEM,
		PublicKey:  publicKey,
	}, nil
}

func normalizeBecome(method, user string) (string, string, error) {
	method = strings.TrimSpace(method)
	if method == "" {
		method = entities.BecomeNone
	}
	switch method {
	case entities.BecomeNone:
		return entities.BecomeNone, "", nil
	case entities.BecomeSudo, entities.BecomeSu:
		user = strings.TrimSpace(user)
		if user == "" {
			user = "root"
		}
		return method, user, nil
	default:
		return "", "", ErrInvalidBecomeMethod
	}
}

func (s *Service) prepareSecret(credType, password, privateKey, passphrase string, required bool) (secret []byte, publicKey string, err error) {
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
		signer, err := parseSSHPrivateKey([]byte(privateKey), passphrase)
		if err != nil {
			return nil, "", fmt.Errorf("%w: %v", ErrInvalidKey, err)
		}
		pub := strings.TrimSpace(string(ssh.MarshalAuthorizedKey(signer.PublicKey())))
		return []byte(privateKey), pub, nil
	default:
		return nil, "", ErrInvalidType
	}
}

func parseSSHPrivateKey(pemBytes []byte, passphrase string) (ssh.Signer, error) {
	if passphrase != "" {
		return ssh.ParsePrivateKeyWithPassphrase(pemBytes, []byte(passphrase))
	}
	signer, err := ssh.ParsePrivateKey(pemBytes)
	if err != nil {
		var missing *ssh.PassphraseMissingError
		if errors.As(err, &missing) {
			return nil, fmt.Errorf("private key requires a passphrase")
		}
		return nil, err
	}
	return signer, nil
}

func toResponse(row entities.Credential) dto.CredentialResponse {
	method := row.BecomeMethod
	if method == "" {
		method = entities.BecomeNone
	}
	return dto.CredentialResponse{
		ID:              row.ID,
		Name:            row.Name,
		Type:            row.Type,
		Username:        row.Username,
		PublicKey:       row.PublicKey,
		HasPassphrase:   len(row.PassphraseCiphertext) > 0,
		BecomeMethod:    method,
		BecomeUser:      row.BecomeUser,
		HasBecomeSecret: len(row.BecomeSecretCiphertext) > 0,
		CreatedAt:       row.CreatedAt,
		UpdatedAt:       row.UpdatedAt,
	}
}
