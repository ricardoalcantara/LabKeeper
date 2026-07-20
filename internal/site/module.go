package site

import (
	"github.com/go-minstack/go-minstack/core"
	"github.com/ricardoalcantara/LabKeeper/internal/site/repositories"
)

func Register(app *core.App) {
	app.Provide(repositories.NewSiteRepository)
	app.Provide(NewService)
	app.Provide(NewController)
	app.Invoke(RegisterRoutes)
}
