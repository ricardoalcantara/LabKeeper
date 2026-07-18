package health

import "github.com/go-minstack/go-minstack/core"

func Register(app *core.App) {
	app.Provide(NewController)
	app.Invoke(RegisterRoutes)
}
