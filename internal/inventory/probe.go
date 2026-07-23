package inventory

import (
	"context"
	"log/slog"
	"os"
	"strings"
	"time"

	"github.com/ricardoalcantara/LabKeeper/internal/inventory/entities"
	"github.com/ricardoalcantara/LabKeeper/internal/netprobe"
	"go.uber.org/fx"
)

const defaultProbeInterval = 15 * time.Second

type ProbeLoop struct {
	service  *Service
	log      *slog.Logger
	interval time.Duration
	cancel   context.CancelFunc
}

func NewProbeLoop(service *Service, log *slog.Logger) *ProbeLoop {
	interval := defaultProbeInterval
	if raw := strings.TrimSpace(os.Getenv("LABKEEPER_PROBE_INTERVAL")); raw != "" {
		if parsed, err := time.ParseDuration(raw); err == nil && parsed > 0 {
			interval = parsed
		} else {
			log.Warn("invalid LABKEEPER_PROBE_INTERVAL, using default", "value", raw, "default", defaultProbeInterval)
		}
	}
	return &ProbeLoop{service: service, log: log, interval: interval}
}

func StartProbeLoop(lc fx.Lifecycle, loop *ProbeLoop) {
	lc.Append(fx.Hook{
		OnStart: func(ctx context.Context) error {
			runCtx, cancel := context.WithCancel(context.Background())
			loop.cancel = cancel
			go loop.run(runCtx)
			loop.log.Info("inventory probe loop started", "interval", loop.interval)
			return nil
		},
		OnStop: func(ctx context.Context) error {
			if loop.cancel != nil {
				loop.cancel()
			}
			return nil
		},
	})
}

func (l *ProbeLoop) run(ctx context.Context) {
	l.tick(ctx)
	ticker := time.NewTicker(l.interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			l.tick(ctx)
		}
	}
}

func (l *ProbeLoop) tick(ctx context.Context) {
	targets, err := l.service.ListProbeTargets()
	if err != nil {
		l.log.Error("list probe targets", "error", err)
		return
	}
	for i := range targets {
		if ctx.Err() != nil {
			return
		}
		host := &targets[i]
		ok := probeHost(ctx, host)
		if err := l.service.ApplyProbeResult(host.ID, ok); err != nil {
			l.log.Error("apply probe result", "host_id", host.ID, "error", err)
		}
	}
}

func probeHost(ctx context.Context, host *entities.Host) bool {
	addr := probeAddress(host)
	if addr == "" {
		return false
	}
	probeCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()

	switch strings.ToLower(strings.TrimSpace(host.ProbeMethod)) {
	case entities.ProbeMethodTCP:
		port := host.ProbePort
		if port == 0 {
			port = entities.DefaultProbePort
		}
		return netprobe.TCPOpen(probeCtx, addr, port)
	default:
		return netprobe.Ping(probeCtx, addr)
	}
}
