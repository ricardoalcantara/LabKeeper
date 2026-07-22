package inventory

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/ricardoalcantara/LabKeeper/internal/httpapi"
	"github.com/ricardoalcantara/LabKeeper/internal/pki"
	"go.uber.org/fx"
)

// Hub accepts Agent mTLS WebSocket connections and updates Inventory.
type Hub struct {
	service *Service
	log     *slog.Logger
	addr    string
	server  *http.Server
}

func NewHub(service *Service, log *slog.Logger) *Hub {
	addr := os.Getenv("LABKEEPER_AGENT_ADDR")
	if addr == "" {
		addr = httpapi.DefaultAgentAddr
	}
	return &Hub{
		service: service,
		log:     log,
		addr:    addr,
	}
}

func StartHub(lc fx.Lifecycle, hub *Hub) {
	lc.Append(fx.Hook{
		OnStart: func(ctx context.Context) error {
			return hub.start()
		},
		OnStop: func(ctx context.Context) error {
			if hub.server == nil {
				return nil
			}
			return hub.server.Shutdown(ctx)
		},
	})
}

func (h *Hub) start() error {
	if err := h.service.MarkAllAgentsOffline(); err != nil {
		return fmt.Errorf("mark agents offline: %w", err)
	}

	paths := pki.DefaultPaths()
	if err := pki.EnsureAssets(paths); err != nil {
		return fmt.Errorf("prepare local PKI assets: %w", err)
	}

	tlsConfig, err := pki.LoadServerTLSConfig(paths)
	if err != nil {
		return fmt.Errorf("load server TLS config: %w", err)
	}

	mux := http.NewServeMux()
	mux.Handle(httpapi.WebSocketPath, h.websocketHandler())

	listener, err := net.Listen("tcp", h.addr)
	if err != nil {
		return fmt.Errorf("listen agent addr %s: %w", h.addr, err)
	}

	websocketURL := listenerWebSocketURL(listener)
	if err := os.WriteFile(httpapi.ServerURLFilePath(), []byte(websocketURL+"\n"), 0o600); err != nil {
		h.log.Warn("write server URL file", "error", err)
	}

	h.log.Info("agent websocket listening",
		"url", websocketURL,
		"url_file", httpapi.ServerURLFilePath(),
		"pki_dir", paths.Dir,
	)

	h.server = &http.Server{
		Handler:   mux,
		TLSConfig: tlsConfig,
	}

	go func() {
		if err := h.server.Serve(tls.NewListener(listener, tlsConfig)); err != nil && err != http.ErrServerClosed {
			h.log.Error("agent websocket serve failed", "error", err)
		}
	}()

	return nil
}

func (h *Hub) websocketHandler() http.Handler {
	upgrader := websocket.Upgrader{
		CheckOrigin: func(_ *http.Request) bool { return true },
	}

	return http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		certificate, err := peerCertificate(request)
		if err != nil {
			http.Error(response, err.Error(), http.StatusUnauthorized)
			return
		}

		connection, err := upgrader.Upgrade(response, request, nil)
		if err != nil {
			h.log.Error("upgrade websocket", "error", err)
			return
		}
		defer connection.Close()

		subject := clientSubject(certificate)
		fingerprint := pki.FingerprintCertificate(certificate)
		conn := &agentConn{conn: connection}

		h.log.Info("agent connected",
			"subject", subject,
			"fingerprint", fingerprint,
			"remote", request.RemoteAddr,
		)

		if _, err := h.service.UpsertFromAgent(fingerprint, subject, request.RemoteAddr, "", "", nil); err != nil {
			h.log.Error("inventory upsert on connect", "error", err)
		}
		defer func() {
			if err := h.service.MarkAgentOffline(fingerprint); err != nil {
				h.log.Error("inventory mark offline", "error", err)
			}
		}()

		for {
			var message httpapi.Message
			if err := connection.ReadJSON(&message); err != nil {
				h.log.Info("agent disconnected", "subject", subject, "error", err)
				return
			}

			switch message.Type {
			case httpapi.MessageTypeHello:
				host, err := h.service.UpsertFromAgent(
					fingerprint,
					subject,
					request.RemoteAddr,
					message.Hostname,
					message.OS,
					message.IPs,
				)
				if err != nil {
					h.log.Error("inventory hello upsert", "error", err)
					break
				}
				h.log.Info("host hello",
					"id", host.ID,
					"fingerprint", fingerprint,
					"hostname", message.Hostname,
					"os", message.OS,
				)
			case httpapi.MessageTypeHeartbeat:
				_, ok, err := h.service.Heartbeat(fingerprint, message.Hostname, message.OS, message.IPs)
				if err != nil {
					h.log.Error("inventory heartbeat", "error", err)
					break
				}
				if !ok {
					if _, err := h.service.UpsertFromAgent(
						fingerprint,
						subject,
						request.RemoteAddr,
						message.Hostname,
						message.OS,
						message.IPs,
					); err != nil {
						h.log.Error("inventory heartbeat upsert", "error", err)
					}
				}
			case httpapi.MessageTypePong:
				h.log.Debug("pong received", "subject", subject, "id", message.ID)
			case httpapi.MessageTypePing:
				_ = conn.writeJSON(httpapi.Message{
					Type:    httpapi.MessageTypePong,
					ID:      message.ID,
					From:    "server",
					Time:    time.Now().UTC().Format(time.RFC3339),
					Message: "pong",
				})
			default:
				h.log.Info("unknown agent message", "type", message.Type, "subject", subject)
			}
		}
	})
}

type agentConn struct {
	mu   sync.Mutex
	conn *websocket.Conn
}

func (c *agentConn) writeJSON(v any) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.conn.WriteJSON(v)
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
