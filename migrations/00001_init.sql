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

CREATE TABLE IF NOT EXISTS hosts (
    id                 TEXT PRIMARY KEY,
    created_at         DATETIME NOT NULL,
    updated_at         DATETIME NOT NULL,
    name               TEXT NOT NULL DEFAULT '',
    hostname           TEXT NOT NULL DEFAULT '',
    address            TEXT NOT NULL DEFAULT '',
    os                 TEXT NOT NULL DEFAULT '',
    ips                TEXT NOT NULL DEFAULT '[]',
    remote_addr        TEXT NOT NULL DEFAULT '',
    subject            TEXT NOT NULL DEFAULT '',
    agent_fingerprint  TEXT UNIQUE,
    online             INTEGER NOT NULL DEFAULT 0,
    connected_at       DATETIME,
    last_seen          DATETIME,
    cpu_cores          INTEGER,
    memory_bytes       INTEGER,
    credential_id      TEXT,
    FOREIGN KEY (credential_id) REFERENCES credentials(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_hosts_name ON hosts(name);
CREATE INDEX IF NOT EXISTS idx_hosts_credential_id ON hosts(credential_id);
CREATE INDEX IF NOT EXISTS idx_hosts_agent_fingerprint ON hosts(agent_fingerprint);

-- +goose Down
DROP TABLE IF EXISTS hosts;
DROP TABLE IF EXISTS credentials;
