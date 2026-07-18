package inventory

import (
	"net/http"
	"sort"

	"github.com/gin-gonic/gin"
	"github.com/ricardoalcantara/LabKeeper/internal/inventory/dto"
)

type Controller struct {
	registry *Registry
}

func NewController(registry *Registry) *Controller {
	return &Controller{registry: registry}
}

func (c *Controller) listHosts(ctx *gin.Context) {
	hosts := c.registry.List()
	sort.Slice(hosts, func(i, j int) bool {
		if hosts[i].Online != hosts[j].Online {
			return hosts[i].Online
		}
		return hosts[i].Hostname < hosts[j].Hostname
	})

	response := dto.HostListResponse{Hosts: make([]dto.HostResponse, 0, len(hosts))}
	for _, host := range hosts {
		response.Hosts = append(response.Hosts, toHostResponse(host))
	}
	ctx.JSON(http.StatusOK, response)
}

func (c *Controller) getHost(ctx *gin.Context) {
	host, ok := c.registry.Get(ctx.Param("id"))
	if !ok {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "host not found"})
		return
	}
	ctx.JSON(http.StatusOK, toHostResponse(host))
}

func toHostResponse(host Host) dto.HostResponse {
	return dto.HostResponse{
		ID:          host.ID,
		Subject:     host.Subject,
		Hostname:    host.Hostname,
		OS:          host.OS,
		IPs:         host.IPs,
		RemoteAddr:  host.RemoteAddr,
		Online:      host.Online,
		ConnectedAt: host.ConnectedAt,
		LastSeen:    host.LastSeen,
	}
}
