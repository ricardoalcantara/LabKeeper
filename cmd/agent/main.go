package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	"github.com/ricardoalcantara/LabKeeper/internal/httpapi"
	"github.com/ricardoalcantara/LabKeeper/internal/pki"
)

func main() {
	serverURLFlag := flag.String("server-url", envOrDefault("LABKEEPER_SERVER_URL", ""), "websocket URL exposed by the server")
	retryInterval := flag.Duration("retry-interval", envDurationOrDefault("LABKEEPER_RETRY_INTERVAL", 5*time.Second), "delay between reconnect attempts")
	handshakeTimeout := flag.Duration("timeout", envDurationOrDefault("LABKEEPER_CLIENT_TIMEOUT", 5*time.Second), "websocket handshake timeout")
	defaultPaths := pki.DefaultPaths()
	caCertPath := flag.String("ca-cert", envOrDefault("LABKEEPER_CA_CERT", defaultPaths.CACert), "certificate authority file for the server")
	clientCertPath := flag.String("client-cert", envOrDefault("LABKEEPER_CLIENT_CERT", defaultPaths.ClientCert), "client certificate used for mTLS")
	clientKeyPath := flag.String("client-key", envOrDefault("LABKEEPER_CLIENT_KEY", defaultPaths.ClientKey), "client private key used for mTLS")
	flag.Parse()

	if err := pki.EnsureAssets(defaultPaths); err != nil {
		log.Fatalf("prepare local PKI assets: %v", err)
	}

	tlsConfig, err := pki.LoadClientTLSConfig(pki.Paths{
		CACert:     *caCertPath,
		ClientCert: *clientCertPath,
		ClientKey:  *clientKeyPath,
	})
	if err != nil {
		log.Fatalf("load client TLS config: %v", err)
	}

	hostname, err := os.Hostname()
	if err != nil {
		log.Printf("resolve hostname: %v", err)
		hostname = "labkeeper-agent"
	}

	dialer := websocket.Dialer{
		TLSClientConfig:  tlsConfig,
		HandshakeTimeout: *handshakeTimeout,
	}

	log.Printf("agent reconnect loop started")
	log.Printf("server URL file: %s", httpapi.ServerURLFilePath())
	log.Printf("PKI directory: %s", defaultPaths.Dir)
	log.Printf("agent certificate: %s", *clientCertPath)

	for {
		serverURL, err := resolveServerURL(*serverURLFlag)
		if err != nil {
			log.Printf("resolve server URL: %v", err)
			time.Sleep(*retryInterval)
			continue
		}

		log.Printf("connecting to %s", serverURL)
		connection, _, err := dialer.Dial(serverURL, nil)
		if err != nil {
			log.Printf("connect failed: %v", err)
			time.Sleep(*retryInterval)
			continue
		}

		log.Printf("connected to %s", serverURL)
		err = handleConnection(connection, hostname)
		connection.Close()
		log.Printf("connection closed: %v", err)
		time.Sleep(*retryInterval)
	}
}

func envOrDefault(name, fallback string) string {
	value := os.Getenv(name)
	if value == "" {
		return fallback
	}

	return value
}

func envDurationOrDefault(name string, fallback time.Duration) time.Duration {
	value := os.Getenv(name)
	if value == "" {
		return fallback
	}

	parsed, err := time.ParseDuration(value)
	if err != nil {
		log.Printf("invalid duration in %s=%q: %v; using %s", name, value, err, fallback)
		return fallback
	}

	return parsed
}

func resolveServerURL(explicit string) (string, error) {
	if explicit != "" {
		return explicit, nil
	}

	path := httpapi.ServerURLFilePath()
	data, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("set LABKEEPER_SERVER_URL/-server-url or start server first so it writes %s: %w", path, err)
	}

	return strings.TrimSpace(string(data)), nil
}

func handleConnection(connection *websocket.Conn, hostname string) error {
	for {
		var message httpapi.Message
		if err := connection.ReadJSON(&message); err != nil {
			return err
		}

		switch message.Type {
		case httpapi.MessageTypePing:
			log.Printf("ping received: id=%s from=%s", message.ID, message.From)
			if err := connection.WriteJSON(httpapi.Message{
				Type:    httpapi.MessageTypePong,
				ID:      message.ID,
				From:    hostname,
				Time:    time.Now().UTC().Format(time.RFC3339),
				Message: "pong",
			}); err != nil {
				return err
			}
		default:
			log.Printf("message received: type=%s id=%s body=%s", message.Type, message.ID, message.Message)
		}
	}
}
