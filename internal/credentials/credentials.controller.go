package credentials

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/ricardoalcantara/LabKeeper/internal/credentials/dto"
	"github.com/ricardoalcantara/LabKeeper/internal/credentials/repositories"
)

type Controller struct {
	service *Service
}

func NewController(service *Service) *Controller {
	return &Controller{service: service}
}

func (c *Controller) list(ctx *gin.Context) {
	items, err := c.service.List()
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, dto.CredentialListResponse{Credentials: items})
}

func (c *Controller) get(ctx *gin.Context) {
	item, err := c.service.Get(ctx.Param("id"))
	if err != nil {
		writeServiceError(ctx, err)
		return
	}
	ctx.JSON(http.StatusOK, item)
}

func (c *Controller) create(ctx *gin.Context) {
	var req dto.CreateCredentialRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	item, err := c.service.Create(req)
	if err != nil {
		writeServiceError(ctx, err)
		return
	}
	ctx.JSON(http.StatusCreated, item)
}

func (c *Controller) generateSSHKey(ctx *gin.Context) {
	item, err := c.service.GenerateSSHKey()
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, item)
}

func (c *Controller) update(ctx *gin.Context) {
	var req dto.UpdateCredentialRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	item, err := c.service.Update(ctx.Param("id"), req)
	if err != nil {
		writeServiceError(ctx, err)
		return
	}
	ctx.JSON(http.StatusOK, item)
}

func (c *Controller) remove(ctx *gin.Context) {
	if err := c.service.Delete(ctx.Param("id")); err != nil {
		writeServiceError(ctx, err)
		return
	}
	ctx.Status(http.StatusNoContent)
}

func writeServiceError(ctx *gin.Context, err error) {
	switch {
	case errors.Is(err, repositories.ErrNotFound):
		ctx.JSON(http.StatusNotFound, gin.H{"error": "credential not found"})
	case errors.Is(err, ErrInvalidType), errors.Is(err, ErrMissingSecret), errors.Is(err, ErrInvalidKey):
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	default:
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
	}
}
