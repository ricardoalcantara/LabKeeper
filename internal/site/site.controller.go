package site

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/ricardoalcantara/LabKeeper/internal/site/dto"
	"github.com/ricardoalcantara/LabKeeper/internal/site/repositories"
)

type Controller struct {
	service *Service
}

func NewController(service *Service) *Controller {
	return &Controller{service: service}
}

func (c *Controller) list(ctx *gin.Context) {
	sites, err := c.service.List()
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, dto.SiteListResponse{Sites: sites})
}

func (c *Controller) get(ctx *gin.Context) {
	site, err := c.service.Get(ctx.Param("id"))
	if err != nil {
		writeSiteError(ctx, err)
		return
	}
	ctx.JSON(http.StatusOK, site)
}

func (c *Controller) create(ctx *gin.Context) {
	var req dto.CreateSiteRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	site, err := c.service.Create(req)
	if err != nil {
		writeSiteError(ctx, err)
		return
	}
	ctx.JSON(http.StatusCreated, site)
}

func (c *Controller) update(ctx *gin.Context) {
	var req dto.UpdateSiteRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	site, err := c.service.Update(ctx.Param("id"), req)
	if err != nil {
		writeSiteError(ctx, err)
		return
	}
	ctx.JSON(http.StatusOK, site)
}

func (c *Controller) remove(ctx *gin.Context) {
	if err := c.service.Delete(ctx.Param("id")); err != nil {
		writeSiteError(ctx, err)
		return
	}
	ctx.Status(http.StatusNoContent)
}

func writeSiteError(ctx *gin.Context, err error) {
	switch {
	case errors.Is(err, repositories.ErrNotFound):
		ctx.JSON(http.StatusNotFound, gin.H{"error": "site not found"})
	case errors.Is(err, ErrSiteHasHosts):
		ctx.JSON(http.StatusConflict, gin.H{"error": "site has hosts"})
	case errors.Is(err, ErrMissingName):
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	default:
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
	}
}
