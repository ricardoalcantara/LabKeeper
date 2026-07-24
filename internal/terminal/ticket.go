package terminal

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"sync"
	"time"
)

const ticketTTL = 60 * time.Second

type Path string

const (
	PathAgent Path = "agent"
	PathSSH   Path = "ssh"
)

type Mode string

const (
	ModeAuto  Mode = "auto"
	ModeAgent Mode = "agent"
	ModeSSH   Mode = "ssh"
)

type ticket struct {
	HostID string
	Path   Path
	Cols   int
	Rows   int
	Expiry time.Time
}

type ticketStore struct {
	mu      sync.Mutex
	tickets map[string]ticket
}

func newTicketStore() *ticketStore {
	return &ticketStore{tickets: make(map[string]ticket)}
}

func (s *ticketStore) mint(hostID string, path Path, cols, rows int) (string, time.Duration, error) {
	raw := make([]byte, 24)
	if _, err := rand.Read(raw); err != nil {
		return "", 0, err
	}
	id := hex.EncodeToString(raw)
	s.mu.Lock()
	defer s.mu.Unlock()
	s.purgeLocked(time.Now())
	s.tickets[id] = ticket{
		HostID: hostID,
		Path:   path,
		Cols:   cols,
		Rows:   rows,
		Expiry: time.Now().Add(ticketTTL),
	}
	return id, ticketTTL, nil
}

func (s *ticketStore) consume(id string) (ticket, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.purgeLocked(time.Now())
	t, ok := s.tickets[id]
	if !ok {
		return ticket{}, errors.New("invalid or expired ticket")
	}
	delete(s.tickets, id)
	if time.Now().After(t.Expiry) {
		return ticket{}, errors.New("invalid or expired ticket")
	}
	return t, nil
}

func (s *ticketStore) purgeLocked(now time.Time) {
	for id, t := range s.tickets {
		if now.After(t.Expiry) {
			delete(s.tickets, id)
		}
	}
}
