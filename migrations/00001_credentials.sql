-- +goose Up
CREATE TABLE IF NOT EXISTS credentials (
    id                TEXT PRIMARY KEY,
    created_at        DATETIME NOT NULL,
    updated_at        DATETIME NOT NULL,
    name              TEXT NOT NULL,
    type              TEXT NOT NULL,
    username          TEXT NOT NULL,
    secret_ciphertext BLOB NOT NULL,
    public_key        TEXT
);

CREATE INDEX IF NOT EXISTS idx_credentials_type ON credentials(type);
CREATE INDEX IF NOT EXISTS idx_credentials_name ON credentials(name);

-- +goose Down
DROP TABLE IF EXISTS credentials;
