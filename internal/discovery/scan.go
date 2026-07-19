package discovery

import (
	"context"
	"fmt"
	"net"
	"net/netip"
	"os/exec"
	"runtime"
	"sort"
	"strconv"
	"sync"
	"time"
)

const (
	maxHosts       = 512
	scanWorkers    = 64
	tcpTimeout     = 300 * time.Millisecond
	dnsTimeout     = 400 * time.Millisecond
	overallTimeout = 60 * time.Second
)

var tcpPorts = []int{22, 80, 443, 445}

// Candidate is one live address found during a scan.
type Candidate struct {
	IP           string   `json:"ip"`
	Hostname     string   `json:"hostname,omitempty"`
	RTTMs        int64    `json:"rtt_ms,omitempty"`
	OpenPorts    []int    `json:"open_ports,omitempty"`
	Methods      []string `json:"methods,omitempty"`
	AlreadyKnown bool     `json:"already_known"`
}

func validateScanCIDR(cidr string) (netip.Prefix, error) {
	prefix, err := netip.ParsePrefix(cidr)
	if err != nil {
		return netip.Prefix{}, fmt.Errorf("invalid cidr: %w", err)
	}
	if !prefix.Addr().Is4() {
		return netip.Prefix{}, fmt.Errorf("only IPv4 CIDRs are supported")
	}
	prefix = prefix.Masked()
	if !isPrivateIPv4(prefix.Addr()) {
		return netip.Prefix{}, fmt.Errorf("cidr must be a private RFC1918 network")
	}
	// Host bits: allow /23 and longer (≤ 512 addresses).
	if prefix.Bits() < 23 {
		return netip.Prefix{}, fmt.Errorf("cidr too large: max /23 (%d hosts)", maxHosts)
	}
	return prefix, nil
}

func expandHosts(prefix netip.Prefix) []netip.Addr {
	prefix = prefix.Masked()
	var hosts []netip.Addr

	addr := prefix.Addr()
	if !addr.Is4() {
		return nil
	}

	// Single address.
	if prefix.Bits() == 32 {
		return []netip.Addr{addr}
	}

	start := prefix.Addr()
	// Iterate all addresses in prefix.
	for ip := start; prefix.Contains(ip); {
		hosts = append(hosts, ip)
		next, ok := nextIPv4(ip)
		if !ok {
			break
		}
		ip = next
		if len(hosts) > maxHosts {
			break
		}
	}

	// Skip network + broadcast for prefixes with usable host space.
	if prefix.Bits() <= 30 && len(hosts) >= 2 {
		hosts = hosts[1 : len(hosts)-1]
	}
	return hosts
}

func nextIPv4(ip netip.Addr) (netip.Addr, bool) {
	a := ip.As4()
	for i := 3; i >= 0; i-- {
		a[i]++
		if a[i] != 0 {
			return netip.AddrFrom4(a), true
		}
	}
	return netip.Addr{}, false
}

func scanCIDR(ctx context.Context, prefix netip.Prefix, known map[string]struct{}) ([]Candidate, error) {
	hosts := expandHosts(prefix)
	if len(hosts) == 0 {
		return nil, nil
	}
	if len(hosts) > maxHosts {
		return nil, fmt.Errorf("too many hosts to scan (%d > %d)", len(hosts), maxHosts)
	}

	scanCtx, cancel := context.WithTimeout(ctx, overallTimeout)
	defer cancel()

	jobs := make(chan netip.Addr, scanWorkers)
	var (
		mu   sync.Mutex
		out  []Candidate
		wg   sync.WaitGroup
	)

	worker := func() {
		defer wg.Done()
		for ip := range jobs {
			if scanCtx.Err() != nil {
				return
			}
			cand, ok := probeHost(scanCtx, ip)
			if !ok {
				continue
			}
			if _, exists := known[cand.IP]; exists {
				cand.AlreadyKnown = true
			}
			mu.Lock()
			out = append(out, cand)
			mu.Unlock()
		}
	}

	for i := 0; i < scanWorkers; i++ {
		wg.Add(1)
		go worker()
	}
	for _, ip := range hosts {
		select {
		case <-scanCtx.Done():
			close(jobs)
			wg.Wait()
			return out, scanCtx.Err()
		case jobs <- ip:
		}
	}
	close(jobs)
	wg.Wait()

	sort.Slice(out, func(i, j int) bool {
		return out[i].IP < out[j].IP
	})
	return out, nil
}

func probeHost(ctx context.Context, ip netip.Addr) (Candidate, bool) {
	ipStr := ip.String()
	cand := Candidate{IP: ipStr}
	methods := make([]string, 0, 2)

	start := time.Now()
	if pingHost(ctx, ipStr) {
		methods = append(methods, "icmp")
		cand.RTTMs = time.Since(start).Milliseconds()
	}

	ports := probeTCP(ctx, ipStr)
	if len(ports) > 0 {
		methods = append(methods, "tcp")
		cand.OpenPorts = ports
		if cand.RTTMs == 0 {
			cand.RTTMs = time.Since(start).Milliseconds()
		}
	}

	if len(methods) == 0 {
		return Candidate{}, false
	}
	cand.Methods = methods
	cand.Hostname = lookupHostname(ctx, ipStr)
	return cand, true
}

func pingHost(ctx context.Context, ip string) bool {
	args := pingArgs(ip)
	cmd := exec.CommandContext(ctx, args[0], args[1:]...)
	if err := cmd.Run(); err != nil {
		return false
	}
	return true
}

func pingArgs(ip string) []string {
	switch runtime.GOOS {
	case "windows":
		return []string{"ping", "-n", "1", "-w", "1000", ip}
	default:
		// Linux/iputils: -W timeout seconds; macOS uses -W in ms — use -c 1 -W 1.
		return []string{"ping", "-c", "1", "-W", "1", ip}
	}
}

func probeTCP(ctx context.Context, ip string) []int {
	open := make([]int, 0, len(tcpPorts))
	var mu sync.Mutex
	var wg sync.WaitGroup

	for _, port := range tcpPorts {
		wg.Add(1)
		go func(port int) {
			defer wg.Done()
			dialer := net.Dialer{Timeout: tcpTimeout}
			conn, err := dialer.DialContext(ctx, "tcp", net.JoinHostPort(ip, strconv.Itoa(port)))
			if err != nil {
				return
			}
			_ = conn.Close()
			mu.Lock()
			open = append(open, port)
			mu.Unlock()
		}(port)
	}
	wg.Wait()
	sort.Ints(open)
	return open
}

func lookupHostname(ctx context.Context, ip string) string {
	lookupCtx, cancel := context.WithTimeout(ctx, dnsTimeout)
	defer cancel()
	names, err := net.DefaultResolver.LookupAddr(lookupCtx, ip)
	if err != nil || len(names) == 0 {
		return ""
	}
	name := names[0]
	if len(name) > 0 && name[len(name)-1] == '.' {
		name = name[:len(name)-1]
	}
	return name
}
