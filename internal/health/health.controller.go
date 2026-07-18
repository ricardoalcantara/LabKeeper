package health

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/ricardoalcantara/LabKeeper/internal/health/dto"
	"github.com/ricardoalcantara/LabKeeper/internal/portalauth"
)

type Controller struct{}

func NewController() *Controller {
	return &Controller{}
}

func (c *Controller) ping(ctx *gin.Context) {
	claims, _ := portalauth.ClaimsFromContext(ctx)
	response := dto.PingResponse{
		Status:  "ok",
		Message: "pong",
		Time:    time.Now().UTC().Format(time.RFC3339),
	}
	if claims != nil {
		response.Subject = claims.Subject
		response.Name = claims.Name
		response.Roles = claims.Roles
		if len(claims.Flatten) > 0 {
			response.Claims = claims.Flatten
		}
	}

	ctx.JSON(http.StatusOK, response)
}
