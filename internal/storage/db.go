package storage

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"

	"github.com/glebarez/sqlite"
	"go.uber.org/fx"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

type Params struct {
	fx.In

	LC  fx.Lifecycle
	Log *slog.Logger
}

func NewDB(p Params) (*gorm.DB, error) {
	driver := os.Getenv("LABKEEPER_DB_DRIVER")
	if driver == "" {
		driver = "sqlite"
	}
	dsn := os.Getenv("LABKEEPER_DB_DSN")
	if dsn == "" {
		dsn = "./data/labkeeper.db"
	}

	if driver == "sqlite" || driver == "sqlite3" {
		if dir := filepath.Dir(dsn); dir != "" && dir != "." {
			if err := os.MkdirAll(dir, 0o700); err != nil {
				return nil, fmt.Errorf("storage: create db directory: %w", err)
			}
		}
	}

	var dialector gorm.Dialector
	switch driver {
	case "sqlite", "sqlite3":
		dialector = sqlite.Open(dsn)
	case "mysql":
		dialector = mysql.Open(dsn)
	case "postgres", "postgresql":
		dialector = postgres.Open(dsn)
	default:
		return nil, fmt.Errorf("storage: unsupported db driver %q", driver)
	}

	db, err := gorm.Open(dialector, &gorm.Config{
		Logger: gormlogger.Default.LogMode(gormlogger.Silent),
	})
	if err != nil {
		return nil, fmt.Errorf("storage: open db: %w", err)
	}

	if driver == "sqlite" || driver == "sqlite3" {
		if err := db.Exec("PRAGMA journal_mode=WAL").Error; err != nil {
			return nil, fmt.Errorf("storage: sqlite pragma journal_mode: %w", err)
		}
		if err := db.Exec("PRAGMA foreign_keys=ON").Error; err != nil {
			return nil, fmt.Errorf("storage: sqlite pragma foreign_keys: %w", err)
		}
	}

	p.LC.Append(fx.Hook{
		OnStop: func(_ context.Context) error {
			p.Log.Info("closing database")
			sqlDB, err := db.DB()
			if err != nil {
				return err
			}
			return sqlDB.Close()
		},
	})

	return db, nil
}

func Module() fx.Option {
	return fx.Module("storage",
		fx.Provide(NewDB),
	)
}
