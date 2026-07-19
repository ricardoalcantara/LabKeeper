package discovery

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
)

type Controller struct {
	service *Service
}

func NewController(service *Service) *Controller {
	return &Controller{service: service}
}

func (c *Controller) status(ctx *gin.Context) {
	resp, err := c.service.Status()
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, resp)
}

func (c *Controller) scan(ctx *gin.Context) {
	var req ScanRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	resp, err := c.service.Scan(ctx.Request.Context(), req.CIDR)
	if err != nil {
		switch {
		case errors.Is(err, ErrDiscoveryDisabled):
			ctx.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		case errors.Is(err, ErrInvalidCIDR):
			ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		default:
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}
	ctx.JSON(http.StatusOK, resp)
}
