package credentials

import (
	"github.com/gin-gonic/gin"
	"github.com/ricardoalcantara/LabKeeper/internal/portalauth"
)

func RegisterRoutes(r *gin.Engine, c *Controller, validator *portalauth.Validator) {
	api := r.Group("/api", portalauth.Authenticate(validator))
	api.GET("/credentials", c.list)
	api.GET("/credentials/:id", c.get)
	api.POST("/credentials", c.create)
	api.PUT("/credentials/:id", c.update)
	api.DELETE("/credentials/:id", c.remove)
}
