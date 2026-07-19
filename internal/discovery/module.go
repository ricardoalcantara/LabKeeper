package discovery

import "github.com/go-minstack/go-minstack/core"

func Register(app *core.App) {
	app.Provide(NewService)
	app.Provide(NewController)
	app.Invoke(RegisterRoutes)
}
