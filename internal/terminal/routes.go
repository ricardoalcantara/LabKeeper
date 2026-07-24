package terminal

import (
	"github.com/gin-gonic/gin"
	"github.com/ricardoalcantara/LabKeeper/internal/portalauth"
)

func RegisterRoutes(r *gin.Engine, c *Controller, validator *portalauth.Validator) {
	api := r.Group("/api", portalauth.Authenticate(validator))
	api.POST("/terminal", c.createTicket)

	// Ticket-authenticated WebSocket (browsers cannot send Authorization on upgrade).
	r.GET("/api/terminal/ws", c.websocket)
}
