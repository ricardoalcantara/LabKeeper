package credentials

import (
	"github.com/go-minstack/go-minstack/core"
	"github.com/ricardoalcantara/LabKeeper/internal/credentials/repositories"
)

func Register(app *core.App) {
	app.Provide(repositories.NewCredentialRepository)
	app.Provide(NewService)
	app.Provide(NewController)
	app.Invoke(RegisterRoutes)
}
