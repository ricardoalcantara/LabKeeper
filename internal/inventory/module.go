package inventory

import "github.com/go-minstack/go-minstack/core"

func Register(app *core.App) {
	app.Provide(NewRegistry)
	app.Provide(NewController)
	app.Provide(NewHub)
	app.Invoke(RegisterRoutes)
	app.Invoke(StartHub)
}
