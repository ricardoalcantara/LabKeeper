package inventory

import (
	"sync"
	"time"
)

// Host is one item in the Inventory (Ansible-style).
type Host struct {
	ID          string    `json:"id"`
	Subject     string    `json:"subject"`
	Hostname    string    `json:"hostname"`
	OS          string    `json:"os,omitempty"`
	IPs         []string  `json:"ips,omitempty"`
	RemoteAddr  string    `json:"remote_addr,omitempty"`
	Online      bool      `json:"online"`
	ConnectedAt time.Time `json:"connected_at"`
	LastSeen    time.Time `json:"last_seen"`
}

// Registry is the in-memory Inventory of Hosts.
type Registry struct {
	mu    sync.RWMutex
	hosts map[string]*Host
}

func NewRegistry() *Registry {
	return &Registry{hosts: make(map[string]*Host)}
}

func (r *Registry) UpsertConnected(id, subject, remoteAddr, hostname, osName string, ips []string) Host {
	now := time.Now().UTC()
	r.mu.Lock()
	defer r.mu.Unlock()

	host, ok := r.hosts[id]
	if !ok {
		host = &Host{
			ID:          id,
			ConnectedAt: now,
		}
		r.hosts[id] = host
	}

	host.Subject = subject
	host.RemoteAddr = remoteAddr
	host.Hostname = hostname
	host.OS = osName
	host.IPs = append([]string(nil), ips...)
	host.Online = true
	host.LastSeen = now
	if host.ConnectedAt.IsZero() {
		host.ConnectedAt = now
	}

	return cloneHost(host)
}

func (r *Registry) Heartbeat(id string, hostname, osName string, ips []string) (Host, bool) {
	now := time.Now().UTC()
	r.mu.Lock()
	defer r.mu.Unlock()

	host, ok := r.hosts[id]
	if !ok {
		return Host{}, false
	}

	if hostname != "" {
		host.Hostname = hostname
	}
	if osName != "" {
		host.OS = osName
	}
	if ips != nil {
		host.IPs = append([]string(nil), ips...)
	}
	host.Online = true
	host.LastSeen = now

	return cloneHost(host), true
}

func (r *Registry) MarkOffline(id string) {
	r.mu.Lock()
	defer r.mu.Unlock()

	host, ok := r.hosts[id]
	if !ok {
		return
	}
	host.Online = false
	host.LastSeen = time.Now().UTC()
}

func (r *Registry) List() []Host {
	r.mu.RLock()
	defer r.mu.RUnlock()

	out := make([]Host, 0, len(r.hosts))
	for _, host := range r.hosts {
		out = append(out, cloneHost(host))
	}
	return out
}

func (r *Registry) Get(id string) (Host, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	host, ok := r.hosts[id]
	if !ok {
		return Host{}, false
	}
	return cloneHost(host), true
}

func cloneHost(host *Host) Host {
	copyHost := *host
	if host.IPs != nil {
		copyHost.IPs = append([]string(nil), host.IPs...)
	}
	return copyHost
}
