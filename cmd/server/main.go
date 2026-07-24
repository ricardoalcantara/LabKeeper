package main

import (
	"github.com/go-minstack/go-minstack/core"
	mgin "github.com/go-minstack/go-minstack/gin"
	"github.com/go-minstack/go-minstack/migration"
	"github.com/ricardoalcantara/LabKeeper/internal/credentials"
	"github.com/ricardoalcantara/LabKeeper/internal/crypto"
	"github.com/ricardoalcantara/LabKeeper/internal/discovery"
	"github.com/ricardoalcantara/LabKeeper/internal/health"
	"github.com/ricardoalcantara/LabKeeper/internal/inventory"
	"github.com/ricardoalcantara/LabKeeper/internal/portalauth"
	"github.com/ricardoalcantara/LabKeeper/internal/site"
	"github.com/ricardoalcantara/LabKeeper/internal/storage"
	"github.com/ricardoalcantara/LabKeeper/internal/terminal"
	"github.com/ricardoalcantara/LabKeeper/migrations"
)

func main() {
	app := core.New(
		mgin.Module(),
		storage.Module(),
		migration.Module(migrations.FS),
	)

	portalauth.Register(app)
	crypto.Register(app)
	health.Register(app)
	credentials.Register(app)
	site.Register(app)
	inventory.Register(app)
	discovery.Register(app)
	terminal.Register(app)

	app.Invoke(migration.Run)
	app.Run()
}
