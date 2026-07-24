package terminal

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/ricardoalcantara/LabKeeper/internal/inventory/entities"
	"github.com/ricardoalcantara/LabKeeper/internal/inventory/repositories"
	"golang.org/x/crypto/ssh"
)

type Controller struct {
	service *Service
	log     *slog.Logger
}

func NewController(service *Service, log *slog.Logger) *Controller {
	return &Controller{service: service, log: log}
}

type createTicketRequest struct {
	HostID string `json:"host_id"`
	Cols   int    `json:"cols"`
	Rows   int    `json:"rows"`
	Mode   Mode   `json:"mode"`
}

type createTicketResponse struct {
	Ticket    string `json:"ticket"`
	ExpiresIn int    `json:"expires_in"`
	Path      Path   `json:"path"`
}

type wsControlMessage struct {
	Type    string `json:"type"`
	Cols    int    `json:"cols,omitempty"`
	Rows    int    `json:"rows,omitempty"`
	Message string `json:"message,omitempty"`
}

func (c *Controller) createTicket(ctx *gin.Context) {
	var req createTicketRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	hostID := strings.TrimSpace(req.HostID)
	if hostID == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "host_id is required"})
		return
	}

	host, err := c.service.hosts.GetEntity(hostID)
	if err != nil {
		if err == repositories.ErrNotFound {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "host not found"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	path, err := c.service.resolvePath(host, req.Mode)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ticket, ttl, err := c.service.tickets.mint(hostID, path, req.Cols, req.Rows)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to mint ticket"})
		return
	}

	ctx.JSON(http.StatusOK, createTicketResponse{
		Ticket:    ticket,
		ExpiresIn: int(ttl.Seconds()),
		Path:      path,
	})
}

func (c *Controller) websocket(ctx *gin.Context) {
	ticketID := strings.TrimSpace(ctx.Query("ticket"))
	if ticketID == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "ticket is required"})
		return
	}

	t, err := c.service.tickets.consume(ticketID)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	upgrader := websocket.Upgrader{
		CheckOrigin: checkOrigin,
	}
	conn, err := upgrader.Upgrade(ctx.Writer, ctx.Request, nil)
	if err != nil {
		c.log.Error("terminal websocket upgrade", "error", err)
		return
	}
	defer conn.Close()

	host, err := c.service.hosts.GetEntity(t.HostID)
	if err != nil {
		_ = writeWSError(conn, "host not found")
		return
	}

	sessionCtx, cancel := context.WithCancel(ctx.Request.Context())
	defer cancel()

	var sessionErr error
	switch t.Path {
	case PathAgent:
		sessionErr = c.bridgeAgent(sessionCtx, conn, host, t.Cols, t.Rows)
	case PathSSH:
		sessionErr = c.bridgeSSH(sessionCtx, conn, host, t.Cols, t.Rows)
	default:
		sessionErr = fmt.Errorf("unknown path %q", t.Path)
		_ = writeWSError(conn, sessionErr.Error())
	}
	if sessionErr != nil {
		c.log.Info("terminal session ended", "host_id", t.HostID, "path", t.Path, "error", sessionErr)
	}
}

func (c *Controller) bridgeAgent(ctx context.Context, conn *websocket.Conn, host *entities.Host, cols, rows int) error {
	if host.AgentFingerprint == nil || strings.TrimSpace(*host.AgentFingerprint) == "" {
		_ = writeWSError(conn, errAgentOffline.Error())
		return errAgentOffline
	}

	shell, err := c.service.hub.OpenShell(ctx, *host.AgentFingerprint, cols, rows)
	if err != nil {
		_ = writeWSError(conn, err.Error())
		return err
	}
	defer shell.Close()

	return bridgeStreams(ctx, conn, shell, shell.Stdout(), shell.Resize)
}

func (c *Controller) bridgeSSH(ctx context.Context, conn *websocket.Conn, host *entities.Host, cols, rows int) error {
	if host.CredentialID == nil || strings.TrimSpace(*host.CredentialID) == "" {
		_ = writeWSError(conn, errSSHUnavailable.Error())
		return errSSHUnavailable
	}

	target, err := sshDialTarget(host)
	if err != nil {
		_ = writeWSError(conn, err.Error())
		return err
	}

	user, methods, err := c.service.credentials.SSHAuth(*host.CredentialID)
	if err != nil {
		_ = writeWSError(conn, fmt.Sprintf("credential: %v", err))
		return err
	}

	config := &ssh.ClientConfig{
		User:            user,
		Auth:            methods,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(), // lab v1; replace with known_hosts later
		Timeout:         15 * time.Second,
	}

	client, err := ssh.Dial("tcp", target, config)
	if err != nil {
		_ = writeWSError(conn, fmt.Sprintf("ssh dial: %v", err))
		return err
	}
	defer client.Close()

	session, err := client.NewSession()
	if err != nil {
		_ = writeWSError(conn, fmt.Sprintf("ssh session: %v", err))
		return err
	}
	defer session.Close()

	if cols <= 0 {
		cols = 80
	}
	if rows <= 0 {
		rows = 24
	}
	modes := ssh.TerminalModes{
		ssh.ECHO:          1,
		ssh.TTY_OP_ISPEED: 14400,
		ssh.TTY_OP_OSPEED: 14400,
	}
	if err := session.RequestPty("xterm-256color", rows, cols, modes); err != nil {
		_ = writeWSError(conn, fmt.Sprintf("request pty: %v", err))
		return err
	}

	stdout, err := session.StdoutPipe()
	if err != nil {
		_ = writeWSError(conn, err.Error())
		return err
	}
	stderr, err := session.StderrPipe()
	if err != nil {
		_ = writeWSError(conn, err.Error())
		return err
	}
	stdin, err := session.StdinPipe()
	if err != nil {
		_ = writeWSError(conn, err.Error())
		return err
	}

	if err := session.Shell(); err != nil {
		_ = writeWSError(conn, fmt.Sprintf("shell: %v", err))
		return err
	}

	merged := io.MultiReader(stdout, stderr)
	resize := func(cCols, cRows int) error {
		return session.WindowChange(cRows, cCols)
	}

	errCh := make(chan error, 1)
	go func() {
		errCh <- session.Wait()
	}()

	bridgeErr := bridgeStreams(ctx, conn, stdin, merged, resize)
	_ = stdin.Close()
	_ = session.Close()
	select {
	case <-errCh:
	case <-time.After(2 * time.Second):
	}
	return bridgeErr
}

func checkOrigin(r *http.Request) bool {
	allowed := strings.TrimSpace(os.Getenv("MINSTACK_CORS_ORIGIN"))
	origin := r.Header.Get("Origin")
	if allowed == "" || origin == "" {
		return true
	}
	for _, part := range strings.Split(allowed, ",") {
		if strings.TrimSpace(part) == origin {
			return true
		}
	}
	return false
}

func writeWSError(conn *websocket.Conn, message string) error {
	payload, _ := json.Marshal(wsControlMessage{Type: "error", Message: message})
	return conn.WriteMessage(websocket.TextMessage, payload)
}

type resizer func(cols, rows int) error

type stdinWriter interface {
	Write(p []byte) (int, error)
}

func bridgeStreams(ctx context.Context, conn *websocket.Conn, stdin stdinWriter, stdout io.Reader, resize resizer) error {
	errCh := make(chan error, 2)

	go func() {
		buf := make([]byte, 32*1024)
		for {
			n, err := stdout.Read(buf)
			if n > 0 {
				if werr := conn.WriteMessage(websocket.BinaryMessage, buf[:n]); werr != nil {
					errCh <- werr
					return
				}
			}
			if err != nil {
				if err != io.EOF {
					errCh <- err
				} else {
					errCh <- nil
				}
				return
			}
		}
	}()

	go func() {
		for {
			msgType, data, err := conn.ReadMessage()
			if err != nil {
				errCh <- err
				return
			}
			switch msgType {
			case websocket.BinaryMessage:
				if _, werr := stdin.Write(data); werr != nil {
					errCh <- werr
					return
				}
			case websocket.TextMessage:
				var ctrl wsControlMessage
				if json.Unmarshal(data, &ctrl) != nil {
					continue
				}
				if ctrl.Type == "resize" && resize != nil {
					_ = resize(ctrl.Cols, ctrl.Rows)
				}
			}
		}
	}()

	select {
	case <-ctx.Done():
		return ctx.Err()
	case err := <-errCh:
		return err
	}
}
