package netprobe

import (
	"context"
	"net"
	"os/exec"
	"runtime"
	"sort"
	"strconv"
	"sync"
	"time"
)

const DefaultTCPTimeout = 300 * time.Millisecond

// Ping runs a single ICMP echo via the system ping binary.
func Ping(ctx context.Context, host string) bool {
	args := pingArgs(host)
	cmd := exec.CommandContext(ctx, args[0], args[1:]...)
	return cmd.Run() == nil
}

func pingArgs(host string) []string {
	switch runtime.GOOS {
	case "windows":
		return []string{"ping", "-n", "1", "-w", "1000", host}
	default:
		// Linux/iputils: -W timeout seconds; macOS uses -W in ms — use -c 1 -W 1.
		return []string{"ping", "-c", "1", "-W", "1", host}
	}
}

// TCPOpen dials a single TCP port and returns true if the connection succeeds.
func TCPOpen(ctx context.Context, host string, port int) bool {
	if port < 1 || port > 65535 {
		return false
	}
	dialer := net.Dialer{Timeout: DefaultTCPTimeout}
	conn, err := dialer.DialContext(ctx, "tcp", net.JoinHostPort(host, strconv.Itoa(port)))
	if err != nil {
		return false
	}
	_ = conn.Close()
	return true
}

// TCPPorts probes several ports in parallel and returns the open ones (sorted).
func TCPPorts(ctx context.Context, host string, ports []int) []int {
	open := make([]int, 0, len(ports))
	var mu sync.Mutex
	var wg sync.WaitGroup

	for _, port := range ports {
		wg.Add(1)
		go func(port int) {
			defer wg.Done()
			if !TCPOpen(ctx, host, port) {
				return
			}
			mu.Lock()
			open = append(open, port)
			mu.Unlock()
		}(port)
	}
	wg.Wait()
	sort.Ints(open)
	return open
}
