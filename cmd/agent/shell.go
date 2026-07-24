package main

import (
	"encoding/base64"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"sync"
	"time"

	"github.com/creack/pty"
	"github.com/ricardoalcantara/LabKeeper/internal/httpapi"
)

type shellSession struct {
	id     string
	cmd    *exec.Cmd
	ptmx   *os.File
	closed chan struct{}
	once   sync.Once
}

func (s *shellSession) close() {
	s.once.Do(func() {
		close(s.closed)
		if s.ptmx != nil {
			_ = s.ptmx.Close()
		}
		if s.cmd != nil && s.cmd.Process != nil {
			_ = s.cmd.Process.Kill()
			_, _ = s.cmd.Process.Wait()
		}
	})
}

type shellManager struct {
	mu      sync.Mutex
	writer  *connWriter
	shells  map[string]*shellSession
	hostname string
}

func newShellManager(writer *connWriter, hostname string) *shellManager {
	return &shellManager{
		writer:   writer,
		shells:   make(map[string]*shellSession),
		hostname: hostname,
	}
}

func (m *shellManager) closeAll() {
	m.mu.Lock()
	ids := make([]string, 0, len(m.shells))
	for id := range m.shells {
		ids = append(ids, id)
	}
	m.mu.Unlock()
	for _, id := range ids {
		m.closeShell(id, false)
	}
}

func (m *shellManager) handle(message httpapi.Message) {
	switch message.Type {
	case httpapi.MessageTypeShellOpen:
		m.open(message.ID, message.Cols, message.Rows)
	case httpapi.MessageTypeShellData:
		m.write(message.ID, message.Data)
	case httpapi.MessageTypeShellResize:
		m.resize(message.ID, message.Cols, message.Rows)
	case httpapi.MessageTypeShellClose:
		m.closeShell(message.ID, false)
	}
}

func (m *shellManager) open(id string, cols, rows int) {
	if id == "" {
		return
	}
	if cols <= 0 {
		cols = 80
	}
	if rows <= 0 {
		rows = 24
	}

	shellPath := os.Getenv("SHELL")
	if shellPath == "" {
		shellPath = "/bin/bash"
	}
	if _, err := os.Stat(shellPath); err != nil {
		shellPath = "/bin/sh"
	}

	cmd := exec.Command(shellPath)
	cmd.Env = append(os.Environ(), "TERM=xterm-256color")
	ptmx, err := pty.Start(cmd)
	if err != nil {
		_ = m.writer.writeJSON(httpapi.Message{
			Type:    httpapi.MessageTypeShellError,
			ID:      id,
			From:    m.hostname,
			Time:    time.Now().UTC().Format(time.RFC3339),
			Message: fmt.Sprintf("open pty: %v", err),
		})
		return
	}

	_ = pty.Setsize(ptmx, &pty.Winsize{Cols: uint16(cols), Rows: uint16(rows)})

	session := &shellSession{
		id:     id,
		cmd:    cmd,
		ptmx:   ptmx,
		closed: make(chan struct{}),
	}

	m.mu.Lock()
	if prev := m.shells[id]; prev != nil {
		prev.close()
	}
	m.shells[id] = session
	m.mu.Unlock()

	if err := m.writer.writeJSON(httpapi.Message{
		Type: httpapi.MessageTypeShellOpened,
		ID:   id,
		From: m.hostname,
		Time: time.Now().UTC().Format(time.RFC3339),
	}); err != nil {
		m.closeShell(id, false)
		return
	}

	go m.pumpStdout(session)
	go m.waitExit(session)
}

func (m *shellManager) pumpStdout(session *shellSession) {
	buf := make([]byte, 32*1024)
	for {
		n, err := session.ptmx.Read(buf)
		if n > 0 {
			_ = m.writer.writeJSON(httpapi.Message{
				Type: httpapi.MessageTypeShellData,
				ID:   session.id,
				From: m.hostname,
				Time: time.Now().UTC().Format(time.RFC3339),
				Data: base64.StdEncoding.EncodeToString(buf[:n]),
			})
		}
		if err != nil {
			if err != io.EOF {
				log.Printf("shell stdout: id=%s err=%v", session.id, err)
			}
			m.closeShell(session.id, true)
			return
		}
	}
}

func (m *shellManager) waitExit(session *shellSession) {
	_ = session.cmd.Wait()
	m.closeShell(session.id, true)
}

func (m *shellManager) write(id, data string) {
	m.mu.Lock()
	session := m.shells[id]
	m.mu.Unlock()
	if session == nil {
		return
	}
	raw, err := base64.StdEncoding.DecodeString(data)
	if err != nil {
		return
	}
	if _, err := session.ptmx.Write(raw); err != nil {
		m.closeShell(id, true)
	}
}

func (m *shellManager) resize(id string, cols, rows int) {
	if cols <= 0 || rows <= 0 {
		return
	}
	m.mu.Lock()
	session := m.shells[id]
	m.mu.Unlock()
	if session == nil {
		return
	}
	_ = pty.Setsize(session.ptmx, &pty.Winsize{Cols: uint16(cols), Rows: uint16(rows)})
}

func (m *shellManager) closeShell(id string, notify bool) {
	m.mu.Lock()
	session := m.shells[id]
	delete(m.shells, id)
	m.mu.Unlock()
	if session == nil {
		return
	}
	session.close()
	if notify {
		_ = m.writer.writeJSON(httpapi.Message{
			Type: httpapi.MessageTypeShellClose,
			ID:   id,
			From: m.hostname,
			Time: time.Now().UTC().Format(time.RFC3339),
		})
	}
}
