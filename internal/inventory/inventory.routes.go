package inventory

import (
	"github.com/gin-gonic/gin"
	"github.com/ricardoalcantara/LabKeeper/internal/portalauth"
)

func RegisterRoutes(r *gin.Engine, c *Controller, validator *portalauth.Validator) {
	api := r.Group("/api", portalauth.Authenticate(validator))
	api.GET("/inventory/hosts", c.listHosts)
	api.POST("/inventory/hosts", c.createHost)
	api.GET("/inventory/hosts/:id", c.getHost)
	api.PUT("/inventory/hosts/:id", c.updateHost)
	api.DELETE("/inventory/hosts/:id", c.removeHost)
}
