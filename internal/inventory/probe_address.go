package inventory

import (
	"net"
	"strings"

	"github.com/ricardoalcantara/LabKeeper/internal/inventory/entities"
)

// probeAddress returns the best target for ICMP/TCP reachability checks:
// Portal-set Address first, otherwise the first usable IP reported by the Agent.
func probeAddress(host *entities.Host) string {
	if addr := strings.TrimSpace(host.Address); addr != "" {
		return addr
	}
	for _, ip := range decodeIPs(host.IPs) {
		ip = strings.TrimSpace(ip)
		if ip == "" || !isProbeableIP(ip) {
			continue
		}
		return ip
	}
	return ""
}

func isProbeableIP(raw string) bool {
	parsed := net.ParseIP(raw)
	if parsed == nil {
		return false
	}
	if parsed.IsLoopback() || parsed.IsLinkLocalUnicast() || parsed.IsUnspecified() {
		return false
	}
	return true
}

func hostHasProbeTarget(host *entities.Host) bool {
	return probeAddress(host) != ""
}
