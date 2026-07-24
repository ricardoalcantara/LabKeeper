package terminal

import (
	"fmt"
	"net"
	"strings"

	"github.com/ricardoalcantara/LabKeeper/internal/credentials"
	"github.com/ricardoalcantara/LabKeeper/internal/inventory"
	"github.com/ricardoalcantara/LabKeeper/internal/inventory/entities"
)

var (
	errNoPath         = fmt.Errorf("no terminal path available")
	errAgentOffline   = fmt.Errorf("agent is offline")
	errSSHUnavailable = fmt.Errorf("ssh path unavailable: need credential and dial address")
)

type Service struct {
	hosts       *inventory.Service
	hub         *inventory.Hub
	credentials *credentials.Service
	tickets     *ticketStore
}

func NewService(hosts *inventory.Service, hub *inventory.Hub, creds *credentials.Service) *Service {
	return &Service{
		hosts:       hosts,
		hub:         hub,
		credentials: creds,
		tickets:     newTicketStore(),
	}
}

func (s *Service) resolvePath(host *entities.Host, mode Mode) (Path, error) {
	agentOK := host.AgentOnline && host.AgentFingerprint != nil && strings.TrimSpace(*host.AgentFingerprint) != ""
	sshOK := host.CredentialID != nil && strings.TrimSpace(*host.CredentialID) != "" && inventory.DialAddress(host) != ""

	switch mode {
	case ModeAgent:
		if !agentOK {
			return "", errAgentOffline
		}
		return PathAgent, nil
	case ModeSSH:
		if !sshOK {
			return "", errSSHUnavailable
		}
		return PathSSH, nil
	case ModeAuto, "":
		if agentOK {
			return PathAgent, nil
		}
		if sshOK {
			return PathSSH, nil
		}
		return "", errNoPath
	default:
		return "", fmt.Errorf("invalid mode %q", mode)
	}
}

func sshDialTarget(host *entities.Host) (string, error) {
	addr := inventory.DialAddress(host)
	if addr == "" {
		return "", errSSHUnavailable
	}
	if h, port, err := net.SplitHostPort(addr); err == nil {
		return net.JoinHostPort(h, port), nil
	}
	return net.JoinHostPort(addr, "22"), nil
}
