package inventory

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/ricardoalcantara/LabKeeper/internal/inventory/dto"
	"github.com/ricardoalcantara/LabKeeper/internal/inventory/repositories"
)

type Controller struct {
	service *Service
}

func NewController(service *Service) *Controller {
	return &Controller{service: service}
}

func (c *Controller) listHosts(ctx *gin.Context) {
	hosts, err := c.service.List(strings.TrimSpace(ctx.Query("site_id")))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, dto.HostListResponse{Hosts: hosts})
}

func (c *Controller) getHost(ctx *gin.Context) {
	host, err := c.service.Get(ctx.Param("id"))
	if err != nil {
		writeHostError(ctx, err)
		return
	}
	ctx.JSON(http.StatusOK, host)
}

func (c *Controller) createHost(ctx *gin.Context) {
	var req dto.CreateHostRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	host, err := c.service.Create(req)
	if err != nil {
		writeHostError(ctx, err)
		return
	}
	ctx.JSON(http.StatusCreated, host)
}

func (c *Controller) updateHost(ctx *gin.Context) {
	var req dto.UpdateHostRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	host, err := c.service.Update(ctx.Param("id"), req)
	if err != nil {
		writeHostError(ctx, err)
		return
	}
	ctx.JSON(http.StatusOK, host)
}

func (c *Controller) removeHost(ctx *gin.Context) {
	if err := c.service.Delete(ctx.Param("id")); err != nil {
		writeHostError(ctx, err)
		return
	}
	ctx.Status(http.StatusNoContent)
}

func writeHostError(ctx *gin.Context, err error) {
	switch {
	case errors.Is(err, repositories.ErrNotFound):
		ctx.JSON(http.StatusNotFound, gin.H{"error": "host not found"})
	case errors.Is(err, ErrInvalidCredential):
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "credential not found"})
	case errors.Is(err, ErrInvalidSite):
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "site not found"})
	case errors.Is(err, ErrMissingSite):
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	default:
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
	}
}
