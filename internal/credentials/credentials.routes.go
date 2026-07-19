package credentials

import (
	"github.com/gin-gonic/gin"
	"github.com/ricardoalcantara/LabKeeper/internal/portalauth"
)

func RegisterRoutes(r *gin.Engine, c *Controller, validator *portalauth.Validator) {
	api := r.Group("/api", portalauth.Authenticate(validator))
	api.GET("/credentials", c.list)
	api.POST("/credentials", c.create)
	api.POST("/credentials/ssh-keygen", c.generateSSHKey)
	api.GET("/credentials/:id", c.get)
	api.PUT("/credentials/:id", c.update)
	api.DELETE("/credentials/:id", c.remove)
}
