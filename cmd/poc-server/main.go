package main

import (
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	"github.com/ricardoalcantara/LabKeeper/internal/httpapi"
	"github.com/ricardoalcantara/LabKeeper/internal/pki"
)

func main() {
	addr := flag.String("addr", envOrDefault("LABKEEPER_SERVER_ADDR", httpapi.DefaultServerAddr), "TLS listen address for websocket connections")
	pingInterval := flag.Duration("ping-interval", envDurationOrDefault("LABKEEPER_PING_INTERVAL", 10*time.Second), "interval between websocket ping messages")
	flag.Parse()

	paths := pki.DefaultPaths()
	if err := pki.EnsureAssets(paths); err != nil {
		log.Fatalf("prepare local PKI assets: %v", err)
	}

	tlsConfig, err := pki.LoadServerTLSConfig(paths)
	if err != nil {
		log.Fatalf("load server TLS config: %v", err)
	}

	mux := http.NewServeMux()
	mux.Handle(httpapi.WebSocketPath, websocketHandler(*pingInterval))

	listener, err := net.Listen("tcp", *addr)
	if err != nil {
		log.Fatalf("listen on %s: %v", *addr, err)
	}

	websocketURL := listenerWebSocketURL(listener)
	if err := os.WriteFile(httpapi.ServerURLFilePath(), []byte(websocketURL+"\n"), 0o600); err != nil {
		log.Printf("write server URL file: %v", err)
	}

	log.Printf("server listening on %s", websocketURL)
	log.Printf("server URL file: %s", httpapi.ServerURLFilePath())
	log.Printf("PKI directory: %s", paths.Dir)
	log.Printf("CA certificate: %s", paths.CACert)
	log.Printf("server certificate: %s", paths.ServerCert)
	log.Printf("agent client certificate: %s", paths.ClientCert)

	server := &http.Server{
		Handler:   mux,
		TLSConfig: tlsConfig,
	}
	if err := server.Serve(tls.NewListener(listener, tlsConfig)); err != nil && err != http.ErrServerClosed {
		log.Fatalf("serve websocket server: %v", err)
	}
}

func websocketHandler(pingInterval time.Duration) http.Handler {
	upgrader := websocket.Upgrader{
		CheckOrigin: func(request *http.Request) bool { return true },
	}

	return http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		certificate, err := peerCertificate(request)
		if err != nil {
			http.Error(response, err.Error(), http.StatusUnauthorized)
			return
		}

		connection, err := upgrader.Upgrade(response, request, nil)
		if err != nil {
			log.Printf("upgrade websocket connection: %v", err)
			return
		}
		defer connection.Close()

		subject := clientSubject(certificate)
		fingerprint := pki.FingerprintCertificate(certificate)
		log.Printf("agent connected: subject=%s fingerprint=%s remote=%s", subject, fingerprint, request.RemoteAddr)

		readErrors := make(chan error, 1)
		go readLoop(connection, subject, readErrors)

		if err := sendPing(connection); err != nil {
			log.Printf("send initial ping to %s: %v", subject, err)
			return
		}

		ticker := time.NewTicker(pingInterval)
		defer ticker.Stop()

		for {
			select {
			case err := <-readErrors:
				log.Printf("agent disconnected: subject=%s err=%v", subject, err)
				return
			case <-ticker.C:
				if err := sendPing(connection); err != nil {
					log.Printf("send ping to %s: %v", subject, err)
					return
				}
			}
		}
	})
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

func listenerWebSocketURL(listener net.Listener) string {
	host, port, err := net.SplitHostPort(listener.Addr().String())
	if err != nil {
		return "wss://" + listener.Addr().String() + httpapi.WebSocketPath
	}

	switch strings.Trim(host, "[]") {
	case "", "0.0.0.0", "::":
		host = "127.0.0.1"
	}

	return fmt.Sprintf("wss://%s%s", net.JoinHostPort(host, port), httpapi.WebSocketPath)
}

func peerCertificate(request *http.Request) (*x509.Certificate, error) {
	if request.TLS == nil || len(request.TLS.PeerCertificates) == 0 {
		return nil, fmt.Errorf("client certificate is required")
	}

	return request.TLS.PeerCertificates[0], nil
}

func clientSubject(certificate *x509.Certificate) string {
	if certificate == nil {
		return ""
	}
	if certificate.Subject.CommonName != "" {
		return certificate.Subject.CommonName
	}

	return certificate.Subject.String()
}

func readLoop(connection *websocket.Conn, subject string, readErrors chan<- error) {
	for {
		var message httpapi.Message
		if err := connection.ReadJSON(&message); err != nil {
			readErrors <- err
			return
		}

		switch message.Type {
		case httpapi.MessageTypePong:
			log.Printf("pong received: subject=%s id=%s time=%s note=%s", subject, message.ID, message.Time, message.Message)
		default:
			log.Printf("message received: subject=%s type=%s id=%s body=%s", subject, message.Type, message.ID, message.Message)
		}
	}
}

func sendPing(connection *websocket.Conn) error {
	messageID, err := randomID()
	if err != nil {
		return err
	}

	message := httpapi.Message{
		Type:    httpapi.MessageTypePing,
		ID:      messageID,
		From:    "server",
		Time:    time.Now().UTC().Format(time.RFC3339),
		Message: "ping",
	}
	if err := connection.WriteJSON(message); err != nil {
		return err
	}

	log.Printf("ping sent: id=%s", messageID)
	return nil
}

func randomID() (string, error) {
	bytes := make([]byte, 12)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("generate message ID: %w", err)
	}

	return base64.RawURLEncoding.EncodeToString(bytes), nil
}
