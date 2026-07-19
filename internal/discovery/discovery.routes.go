package discovery

import (
	"github.com/gin-gonic/gin"
	"github.com/ricardoalcantara/LabKeeper/internal/portalauth"
)

func RegisterRoutes(r *gin.Engine, c *Controller, validator *portalauth.Validator) {
	api := r.Group("/api", portalauth.Authenticate(validator))
	api.GET("/inventory/discovery/status", c.status)
	api.POST("/inventory/discovery/scan", c.scan)
}
