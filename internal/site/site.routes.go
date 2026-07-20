package site

import (
	"github.com/gin-gonic/gin"
	"github.com/ricardoalcantara/LabKeeper/internal/portalauth"
)

func RegisterRoutes(r *gin.Engine, c *Controller, validator *portalauth.Validator) {
	api := r.Group("/api", portalauth.Authenticate(validator))
	api.GET("/site", c.list)
	api.POST("/site", c.create)
	api.GET("/site/:id", c.get)
	api.PUT("/site/:id", c.update)
	api.DELETE("/site/:id", c.remove)
}
