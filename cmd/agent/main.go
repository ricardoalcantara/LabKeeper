package main

import (
	"flag"
	"fmt"
	"log"
	"net"
	"os"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/ricardoalcantara/LabKeeper/internal/httpapi"
	"github.com/ricardoalcantara/LabKeeper/internal/pki"
)

func main() {
	serverURLFlag := flag.String("server-url", envOrDefault("LABKEEPER_SERVER_URL", ""), "websocket URL exposed by the Server")
	retryInterval := flag.Duration("retry-interval", envDurationOrDefault("LABKEEPER_RETRY_INTERVAL", 5*time.Second), "base delay between reconnect attempts")
	heartbeatInterval := flag.Duration("heartbeat-interval", envDurationOrDefault("LABKEEPER_HEARTBEAT_INTERVAL", 10*time.Second), "interval between host heartbeats")
	handshakeTimeout := flag.Duration("timeout", envDurationOrDefault("LABKEEPER_CLIENT_TIMEOUT", 5*time.Second), "websocket handshake timeout")
	defaultPaths := pki.DefaultPaths()
	caCertPath := flag.String("ca-cert", envOrDefault("LABKEEPER_CA_CERT", defaultPaths.CACert), "certificate authority file for the Server")
	clientCertPath := flag.String("client-cert", envOrDefault("LABKEEPER_CLIENT_CERT", defaultPaths.ClientCert), "client certificate used for mTLS")
	clientKeyPath := flag.String("client-key", envOrDefault("LABKEEPER_CLIENT_KEY", defaultPaths.ClientKey), "client private key used for mTLS")
	flag.Parse()

	if err := pki.EnsureAssets(defaultPaths); err != nil {
		log.Fatalf("prepare local PKI assets: %v", err)
	}

	tlsConfig, err := pki.LoadClientTLSConfig(pki.Paths{
		CACert:     *caCertPath,
		ClientCert: *clientCertPath,
		ClientKey:  *clientKeyPath,
	})
	if err != nil {
		log.Fatalf("load client TLS config: %v", err)
	}

	hostname, err := os.Hostname()
	if err != nil {
		log.Printf("resolve hostname: %v", err)
		hostname = "labkeeper-agent"
	}

	dialer := websocket.Dialer{
		TLSClientConfig:  tlsConfig,
		HandshakeTimeout: *handshakeTimeout,
	}

	log.Printf("agent reconnect loop started")
	log.Printf("server URL file: %s", httpapi.ServerURLFilePath())
	log.Printf("PKI directory: %s", defaultPaths.Dir)
	log.Printf("agent certificate: %s", *clientCertPath)

	attempt := 0
	for {
		serverURL, err := resolveServerURL(*serverURLFlag)
		if err != nil {
			log.Printf("resolve server URL: %v", err)
			sleep := backoff(*retryInterval, attempt)
			attempt++
			time.Sleep(sleep)
			continue
		}

		log.Printf("connecting to %s", serverURL)
		connection, _, err := dialer.Dial(serverURL, nil)
		if err != nil {
			log.Printf("connect failed: %v", err)
			sleep := backoff(*retryInterval, attempt)
			attempt++
			time.Sleep(sleep)
			continue
		}

		attempt = 0
		log.Printf("connected to %s", serverURL)
		err = handleConnection(connection, hostname, *heartbeatInterval)
		connection.Close()
		log.Printf("connection closed: %v", err)
		time.Sleep(*retryInterval)
	}
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

func backoff(base time.Duration, attempt int) time.Duration {
	if attempt <= 0 {
		return base
	}
	maxShift := 4
	shift := attempt
	if shift > maxShift {
		shift = maxShift
	}
	return base * time.Duration(1<<shift)
}

func resolveServerURL(explicit string) (string, error) {
	if explicit != "" {
		return explicit, nil
	}

	path := httpapi.ServerURLFilePath()
	data, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("set LABKEEPER_SERVER_URL/-server-url or start Server first so it writes %s: %w", path, err)
	}
	return strings.TrimSpace(string(data)), nil
}

func localIPs() []string {
	interfaces, err := net.Interfaces()
	if err != nil {
		return nil
	}

	var ips []string
	for _, iface := range interfaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			var ip net.IP
			switch value := addr.(type) {
			case *net.IPNet:
				ip = value.IP
			case *net.IPAddr:
				ip = value.IP
			}
			if ip == nil || ip.IsLoopback() {
				continue
			}
			if v4 := ip.To4(); v4 != nil {
				ips = append(ips, v4.String())
			}
		}
	}
	return ips
}

type connWriter struct {
	mu   sync.Mutex
	conn *websocket.Conn
}

func (w *connWriter) writeJSON(v any) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.conn.WriteJSON(v)
}

func handleConnection(connection *websocket.Conn, hostname string, heartbeatInterval time.Duration) error {
	writer := &connWriter{conn: connection}
	shells := newShellManager(writer, hostname)
	defer shells.closeAll()

	facts := func() (string, string, []string) {
		return hostname, runtime.GOOS + "/" + runtime.GOARCH, localIPs()
	}

	host, osName, ips := facts()
	if err := writer.writeJSON(httpapi.Message{
		Type:     httpapi.MessageTypeHello,
		From:     hostname,
		Time:     time.Now().UTC().Format(time.RFC3339),
		Hostname: host,
		OS:       osName,
		IPs:      ips,
	}); err != nil {
		return err
	}

	errors := make(chan error, 1)
	go func() {
		for {
			var message httpapi.Message
			if err := connection.ReadJSON(&message); err != nil {
				errors <- err
				return
			}
			switch message.Type {
			case httpapi.MessageTypePing:
				log.Printf("ping received: id=%s from=%s", message.ID, message.From)
				if err := writer.writeJSON(httpapi.Message{
					Type:    httpapi.MessageTypePong,
					ID:      message.ID,
					From:    hostname,
					Time:    time.Now().UTC().Format(time.RFC3339),
					Message: "pong",
				}); err != nil {
					errors <- err
					return
				}
			case httpapi.MessageTypeShellOpen,
				httpapi.MessageTypeShellData,
				httpapi.MessageTypeShellResize,
				httpapi.MessageTypeShellClose:
				shells.handle(message)
			default:
				log.Printf("message received: type=%s id=%s body=%s", message.Type, message.ID, message.Message)
			}
		}
	}()

	ticker := time.NewTicker(heartbeatInterval)
	defer ticker.Stop()

	for {
		select {
		case err := <-errors:
			return err
		case <-ticker.C:
			host, osName, ips := facts()
			if err := writer.writeJSON(httpapi.Message{
				Type:     httpapi.MessageTypeHeartbeat,
				From:     hostname,
				Time:     time.Now().UTC().Format(time.RFC3339),
				Hostname: host,
				OS:       osName,
				IPs:      ips,
			}); err != nil {
				return err
			}
			log.Printf("heartbeat sent: hostname=%s ips=%v", host, ips)
		}
	}
}
