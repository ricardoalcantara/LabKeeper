package pki

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"fmt"
	"math/big"
	"net"
	"os"
	"path/filepath"
	"time"
)

const (
	DefaultDirName = "labkeeper-ws-pki"
)

type Paths struct {
	Dir        string
	CACert     string
	CAKey      string
	ServerCert string
	ServerKey  string
	ClientCert string
	ClientKey  string
}

func DefaultPaths() Paths {
	dir := filepath.Join(os.TempDir(), DefaultDirName)
	return Paths{
		Dir:        dir,
		CACert:     filepath.Join(dir, "ca-cert.pem"),
		CAKey:      filepath.Join(dir, "ca-key.pem"),
		ServerCert: filepath.Join(dir, "server-cert.pem"),
		ServerKey:  filepath.Join(dir, "server-key.pem"),
		ClientCert: filepath.Join(dir, "agent-cert.pem"),
		ClientKey:  filepath.Join(dir, "agent-key.pem"),
	}
}

func EnsureAssets(paths Paths) error {
	if filesExist(paths.CACert, paths.CAKey, paths.ServerCert, paths.ServerKey, paths.ClientCert, paths.ClientKey) {
		return nil
	}

	if err := os.MkdirAll(paths.Dir, 0o700); err != nil {
		return fmt.Errorf("create PKI directory: %w", err)
	}

	caCert, caKey, err := createCertificateAuthority()
	if err != nil {
		return err
	}

	serverCert, serverKey, err := createSignedCertificate(caCert, caKey, certificateOptions{
		CommonName: "labkeeper-server",
		DNSNames:   []string{"localhost"},
		IPAddresses: []net.IP{
			net.ParseIP("127.0.0.1"),
		},
		ExtKeyUsages: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
	})
	if err != nil {
		return err
	}

	clientCert, clientKey, err := createSignedCertificate(caCert, caKey, certificateOptions{
		CommonName:   "labkeeper-agent",
		ExtKeyUsages: []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth},
	})
	if err != nil {
		return err
	}

	if err := writePEMFile(paths.CACert, "CERTIFICATE", caCert.Raw); err != nil {
		return err
	}
	if err := writePKCS8PrivateKey(paths.CAKey, caKey); err != nil {
		return err
	}
	if err := writePEMFile(paths.ServerCert, "CERTIFICATE", serverCert.Raw); err != nil {
		return err
	}
	if err := writePKCS8PrivateKey(paths.ServerKey, serverKey); err != nil {
		return err
	}
	if err := writePEMFile(paths.ClientCert, "CERTIFICATE", clientCert.Raw); err != nil {
		return err
	}
	if err := writePKCS8PrivateKey(paths.ClientKey, clientKey); err != nil {
		return err
	}

	return nil
}

func LoadServerTLSConfig(paths Paths) (*tls.Config, error) {
	certificate, err := tls.LoadX509KeyPair(paths.ServerCert, paths.ServerKey)
	if err != nil {
		return nil, fmt.Errorf("load server certificate: %w", err)
	}

	clientCAs, err := certPoolFromFile(paths.CACert)
	if err != nil {
		return nil, err
	}

	return &tls.Config{
		MinVersion:   tls.VersionTLS13,
		Certificates: []tls.Certificate{certificate},
		ClientCAs:    clientCAs,
		ClientAuth:   tls.RequireAndVerifyClientCert,
	}, nil
}

func LoadClientTLSConfig(paths Paths) (*tls.Config, error) {
	certificate, err := tls.LoadX509KeyPair(paths.ClientCert, paths.ClientKey)
	if err != nil {
		return nil, fmt.Errorf("load client certificate: %w", err)
	}

	rootCAs, err := certPoolFromFile(paths.CACert)
	if err != nil {
		return nil, err
	}

	return &tls.Config{
		MinVersion:   tls.VersionTLS13,
		Certificates: []tls.Certificate{certificate},
		RootCAs:      rootCAs,
	}, nil
}

func FingerprintCertificate(certificate *x509.Certificate) string {
	if certificate == nil {
		return ""
	}

	sum := sha256.Sum256(certificate.Raw)
	return base64.RawStdEncoding.EncodeToString(sum[:])
}

type certificateOptions struct {
	CommonName   string
	DNSNames     []string
	IPAddresses  []net.IP
	ExtKeyUsages []x509.ExtKeyUsage
}

func createCertificateAuthority() (*x509.Certificate, ed25519.PrivateKey, error) {
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, nil, fmt.Errorf("generate CA key: %w", err)
	}

	template := &x509.Certificate{
		SerialNumber:          big.NewInt(time.Now().UnixNano()),
		Subject:               pkix.Name{CommonName: "labkeeper-dev-ca"},
		NotBefore:             time.Now().Add(-5 * time.Minute),
		NotAfter:              time.Now().Add(24 * time.Hour),
		KeyUsage:              x509.KeyUsageCertSign | x509.KeyUsageCRLSign,
		BasicConstraintsValid: true,
		IsCA:                  true,
	}

	derBytes, err := x509.CreateCertificate(rand.Reader, template, template, publicKey, privateKey)
	if err != nil {
		return nil, nil, fmt.Errorf("create CA certificate: %w", err)
	}

	certificate, err := x509.ParseCertificate(derBytes)
	if err != nil {
		return nil, nil, fmt.Errorf("parse CA certificate: %w", err)
	}

	return certificate, privateKey, nil
}

func createSignedCertificate(caCert *x509.Certificate, caKey ed25519.PrivateKey, options certificateOptions) (*x509.Certificate, ed25519.PrivateKey, error) {
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, nil, fmt.Errorf("generate leaf key: %w", err)
	}

	template := &x509.Certificate{
		SerialNumber: big.NewInt(time.Now().UnixNano()),
		Subject: pkix.Name{
			CommonName: options.CommonName,
		},
		NotBefore:   time.Now().Add(-5 * time.Minute),
		NotAfter:    time.Now().Add(12 * time.Hour),
		KeyUsage:    x509.KeyUsageDigitalSignature,
		ExtKeyUsage: options.ExtKeyUsages,
		DNSNames:    options.DNSNames,
		IPAddresses: options.IPAddresses,
	}

	derBytes, err := x509.CreateCertificate(rand.Reader, template, caCert, publicKey, caKey)
	if err != nil {
		return nil, nil, fmt.Errorf("create signed certificate %q: %w", options.CommonName, err)
	}

	certificate, err := x509.ParseCertificate(derBytes)
	if err != nil {
		return nil, nil, fmt.Errorf("parse signed certificate %q: %w", options.CommonName, err)
	}

	return certificate, privateKey, nil
}

func certPoolFromFile(path string) (*x509.CertPool, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read certificate authority %q: %w", path, err)
	}

	pool := x509.NewCertPool()
	if ok := pool.AppendCertsFromPEM(data); !ok {
		return nil, errors.New("append CA certificate to pool")
	}

	return pool, nil
}

func writePEMFile(path, blockType string, derBytes []byte) error {
	return writePEM(path, &pem.Block{Type: blockType, Bytes: derBytes})
}

func writePKCS8PrivateKey(path string, key ed25519.PrivateKey) error {
	derBytes, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		return fmt.Errorf("marshal private key %q: %w", path, err)
	}

	return writePEM(path, &pem.Block{Type: "PRIVATE KEY", Bytes: derBytes})
}

func writePEM(path string, block *pem.Block) error {
	file, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o600)
	if err != nil {
		return fmt.Errorf("open %q for write: %w", path, err)
	}
	defer file.Close()

	if err := pem.Encode(file, block); err != nil {
		return fmt.Errorf("encode PEM %q: %w", path, err)
	}

	return nil
}

func filesExist(paths ...string) bool {
	for _, path := range paths {
		if _, err := os.Stat(path); err != nil {
			return false
		}
	}

	return true
}
