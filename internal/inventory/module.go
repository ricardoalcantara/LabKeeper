package inventory

import (
	"github.com/go-minstack/go-minstack/core"
	"github.com/ricardoalcantara/LabKeeper/internal/inventory/repositories"
)

func Register(app *core.App) {
	app.Provide(repositories.NewHostRepository)
	app.Provide(NewService)
	app.Provide(NewController)
	app.Provide(NewHub)
	app.Invoke(RegisterRoutes)
	app.Invoke(StartHub)
}
