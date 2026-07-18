package crypto

import "github.com/go-minstack/go-minstack/core"

func Register(app *core.App) {
	app.Provide(NewCryptoServiceFromEnv)
}
