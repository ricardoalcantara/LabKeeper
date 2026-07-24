package inventory

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/ricardoalcantara/LabKeeper/internal/httpapi"
	"github.com/ricardoalcantara/LabKeeper/internal/pki"
	"go.uber.org/fx"
)

var (
	ErrAgentNotConnected = errors.New("agent not connected")
	ErrShellOpenTimeout  = errors.New("agent shell open timed out")
	ErrShellClosed       = errors.New("shell session closed")
)

const shellOpenTimeout = 15 * time.Second

// Hub accepts Agent mTLS WebSocket connections and updates Inventory.
type Hub struct {
	service *Service
	log     *slog.Logger
	addr    string
	server  *http.Server

	mu     sync.Mutex
	agents map[string]*agentConn // fingerprint → connection
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
		agents:  make(map[string]*agentConn),
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

// OpenShell asks the connected Agent to open a local PTY shell session.
func (h *Hub) OpenShell(ctx context.Context, fingerprint string, cols, rows int) (*AgentShell, error) {
	fingerprint = strings.TrimSpace(fingerprint)
	if fingerprint == "" {
		return nil, ErrAgentNotConnected
	}
	if cols <= 0 {
		cols = 80
	}
	if rows <= 0 {
		rows = 24
	}

	h.mu.Lock()
	conn := h.agents[fingerprint]
	h.mu.Unlock()
	if conn == nil {
		return nil, ErrAgentNotConnected
	}

	sessionID := uuid.NewString()
	stdoutReader, stdoutWriter := io.Pipe()
	shell := &AgentShell{
		id:         sessionID,
		conn:       conn,
		stdout:     stdoutReader,
		stdoutW:    stdoutWriter,
		closed:     make(chan struct{}),
		openResult: make(chan error, 1),
	}

	conn.mu.Lock()
	conn.shells[sessionID] = shell
	conn.mu.Unlock()

	if err := conn.writeJSON(httpapi.Message{
		Type: httpapi.MessageTypeShellOpen,
		ID:   sessionID,
		From: "server",
		Time: time.Now().UTC().Format(time.RFC3339),
		Cols: cols,
		Rows: rows,
	}); err != nil {
		conn.removeShell(sessionID)
		_ = stdoutWriter.CloseWithError(err)
		return nil, err
	}

	timer := time.NewTimer(shellOpenTimeout)
	defer timer.Stop()

	select {
	case <-ctx.Done():
		_ = shell.Close()
		return nil, ctx.Err()
	case err := <-shell.openResult:
		if err != nil {
			_ = shell.Close()
			return nil, err
		}
		return shell, nil
	case <-timer.C:
		_ = shell.Close()
		return nil, ErrShellOpenTimeout
	}
}

func (h *Hub) registerAgent(fingerprint string, conn *agentConn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if prev := h.agents[fingerprint]; prev != nil && prev != conn {
		prev.shutdown(errors.New("replaced by new agent connection"))
	}
	h.agents[fingerprint] = conn
}

func (h *Hub) unregisterAgent(fingerprint string, conn *agentConn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if current := h.agents[fingerprint]; current == conn {
		delete(h.agents, fingerprint)
	}
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
		conn := &agentConn{
			conn:        connection,
			fingerprint: fingerprint,
			shells:      make(map[string]*AgentShell),
		}

		h.registerAgent(fingerprint, conn)
		defer func() {
			conn.shutdown(errors.New("agent disconnected"))
			h.unregisterAgent(fingerprint, conn)
		}()

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
			case httpapi.MessageTypeShellOpened:
				conn.handleShellOpened(message.ID)
			case httpapi.MessageTypeShellError:
				conn.handleShellError(message.ID, message.Message)
			case httpapi.MessageTypeShellData:
				conn.handleShellData(message.ID, message.Data)
			case httpapi.MessageTypeShellClose:
				conn.handleShellClose(message.ID)
			default:
				h.log.Info("unknown agent message", "type", message.Type, "subject", subject)
			}
		}
	})
}

type agentConn struct {
	mu          sync.Mutex
	conn        *websocket.Conn
	fingerprint string
	shells      map[string]*AgentShell
}

func (c *agentConn) writeJSON(v any) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.conn.WriteJSON(v)
}

func (c *agentConn) removeShell(id string) *AgentShell {
	c.mu.Lock()
	defer c.mu.Unlock()
	shell := c.shells[id]
	delete(c.shells, id)
	return shell
}

func (c *agentConn) getShell(id string) *AgentShell {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.shells[id]
}

func (c *agentConn) shutdown(err error) {
	c.mu.Lock()
	shells := make([]*AgentShell, 0, len(c.shells))
	for id, shell := range c.shells {
		shells = append(shells, shell)
		delete(c.shells, id)
	}
	c.mu.Unlock()
	for _, shell := range shells {
		shell.failOpen(err)
		shell.teardown(err)
	}
}

func (c *agentConn) handleShellOpened(id string) {
	if shell := c.getShell(id); shell != nil {
		shell.failOpen(nil)
	}
}

func (c *agentConn) handleShellError(id, message string) {
	err := ErrShellClosed
	if strings.TrimSpace(message) != "" {
		err = fmt.Errorf("%w: %s", ErrShellClosed, message)
	}
	if shell := c.removeShell(id); shell != nil {
		shell.failOpen(err)
		shell.teardown(err)
	}
}

func (c *agentConn) handleShellData(id, data string) {
	shell := c.getShell(id)
	if shell == nil {
		return
	}
	raw, err := base64.StdEncoding.DecodeString(data)
	if err != nil {
		return
	}
	shell.writeStdout(raw)
}

func (c *agentConn) handleShellClose(id string) {
	if shell := c.removeShell(id); shell != nil {
		shell.teardown(io.EOF)
	}
}

// AgentShell is a Server-side handle for an Agent-local PTY session.
type AgentShell struct {
	id         string
	conn       *agentConn
	stdout     *io.PipeReader
	stdoutW    *io.PipeWriter
	closed     chan struct{}
	closeOnce  sync.Once
	openOnce   sync.Once
	openResult chan error
}

func (s *AgentShell) failOpen(err error) {
	s.openOnce.Do(func() {
		s.openResult <- err
	})
}

func (s *AgentShell) writeStdout(p []byte) {
	select {
	case <-s.closed:
		return
	default:
	}
	if _, err := s.stdoutW.Write(p); err != nil {
		_ = s.Close()
	}
}

func (s *AgentShell) Stdout() io.Reader {
	return s.stdout
}

func (s *AgentShell) Write(p []byte) (int, error) {
	select {
	case <-s.closed:
		return 0, ErrShellClosed
	default:
	}
	if err := s.conn.writeJSON(httpapi.Message{
		Type: httpapi.MessageTypeShellData,
		ID:   s.id,
		From: "server",
		Time: time.Now().UTC().Format(time.RFC3339),
		Data: base64.StdEncoding.EncodeToString(p),
	}); err != nil {
		return 0, err
	}
	return len(p), nil
}

func (s *AgentShell) Resize(cols, rows int) error {
	select {
	case <-s.closed:
		return ErrShellClosed
	default:
	}
	return s.conn.writeJSON(httpapi.Message{
		Type: httpapi.MessageTypeShellResize,
		ID:   s.id,
		From: "server",
		Time: time.Now().UTC().Format(time.RFC3339),
		Cols: cols,
		Rows: rows,
	})
}

func (s *AgentShell) Close() error {
	s.teardown(nil)
	return nil
}

func (s *AgentShell) teardown(err error) {
	s.closeOnce.Do(func() {
		close(s.closed)
		_ = s.conn.writeJSON(httpapi.Message{
			Type: httpapi.MessageTypeShellClose,
			ID:   s.id,
			From: "server",
			Time: time.Now().UTC().Format(time.RFC3339),
		})
		s.conn.removeShell(s.id)
		if err != nil {
			_ = s.stdoutW.CloseWithError(err)
		} else {
			_ = s.stdoutW.Close()
		}
	})
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
