package main

import (
	"github.com/go-minstack/go-minstack/core"
	mgin "github.com/go-minstack/go-minstack/gin"
	"github.com/ricardoalcantara/LabKeeper/internal/health"
	"github.com/ricardoalcantara/LabKeeper/internal/portalauth"
)

func main() {
	app := core.New(
		mgin.Module(),
	)

	portalauth.Register(app)
	health.Register(app)
	app.Run()
}
