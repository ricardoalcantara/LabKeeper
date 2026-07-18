package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"os"
)

// CryptoService encrypts and decrypts recoverable secrets with AES-256-GCM.
type CryptoService struct {
	masterKey []byte
}

func NewCryptoServiceFromEnv() (*CryptoService, error) {
	raw := os.Getenv("LABKEEPER_MASTER_KEY")
	if raw == "" {
		return nil, errors.New("crypto: LABKEEPER_MASTER_KEY is required")
	}
	key, err := decodeMasterKey(raw)
	if err != nil {
		return nil, err
	}
	return &CryptoService{masterKey: key}, nil
}

func (s *CryptoService) Encrypt(plaintext []byte) ([]byte, error) {
	block, err := aes.NewCipher(s.masterKey)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}
	return gcm.Seal(nonce, nonce, plaintext, nil), nil
}

func (s *CryptoService) Decrypt(ciphertext []byte) ([]byte, error) {
	block, err := aes.NewCipher(s.masterKey)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return nil, errors.New("crypto: ciphertext too short")
	}
	return gcm.Open(nil, ciphertext[:nonceSize], ciphertext[nonceSize:], nil)
}

func decodeMasterKey(b64 string) ([]byte, error) {
	key, err := base64.StdEncoding.DecodeString(b64)
	if err != nil {
		key, err = base64.URLEncoding.DecodeString(b64)
		if err != nil {
			return nil, fmt.Errorf("crypto: invalid master key encoding: %w", err)
		}
	}
	if len(key) != 32 {
		return nil, fmt.Errorf("crypto: master key must be 32 bytes, got %d", len(key))
	}
	return key, nil
}
