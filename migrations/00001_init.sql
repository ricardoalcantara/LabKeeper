-- +goose Up
CREATE TABLE IF NOT EXISTS credentials (
    id                       TEXT PRIMARY KEY,
    created_at               DATETIME NOT NULL,
    updated_at               DATETIME NOT NULL,
    name                     TEXT NOT NULL,
    type                     TEXT NOT NULL,
    username                 TEXT NOT NULL,
    secret_ciphertext        BLOB NOT NULL,
    public_key               TEXT,
    passphrase_ciphertext    BLOB,
    become_method            TEXT NOT NULL DEFAULT 'none',
    become_user              TEXT NOT NULL DEFAULT '',
    become_secret_ciphertext BLOB
);

CREATE INDEX IF NOT EXISTS idx_credentials_type ON credentials(type);
CREATE INDEX IF NOT EXISTS idx_credentials_name ON credentials(name);

CREATE TABLE IF NOT EXISTS sites (
    id                TEXT PRIMARY KEY,
    created_at        DATETIME NOT NULL,
    updated_at        DATETIME NOT NULL,
    name              TEXT NOT NULL UNIQUE,
    discovery_enabled INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sites_name ON sites(name);

INSERT INTO sites (id, created_at, updated_at, name, discovery_enabled)
VALUES (
    '00000000-0000-4000-8000-000000000001',
    datetime('now'),
    datetime('now'),
    'Default',
    1
);

CREATE TABLE IF NOT EXISTS hosts (
    id                 TEXT PRIMARY KEY,
    created_at         DATETIME NOT NULL,
    updated_at         DATETIME NOT NULL,
    site_id            TEXT NOT NULL,
    name               TEXT NOT NULL DEFAULT '',
    hostname           TEXT NOT NULL DEFAULT '',
    address            TEXT NOT NULL DEFAULT '',
    os                 TEXT NOT NULL DEFAULT '',
    ips                TEXT NOT NULL DEFAULT '[]',
    remote_addr        TEXT NOT NULL DEFAULT '',
    subject            TEXT NOT NULL DEFAULT '',
    agent_fingerprint  TEXT UNIQUE,
    online             INTEGER NOT NULL DEFAULT 0,
    agent_online       INTEGER NOT NULL DEFAULT 0,
    connected_at       DATETIME,
    last_seen          DATETIME,
    last_probe_at      DATETIME,
    probe_method       TEXT NOT NULL DEFAULT 'icmp',
    probe_port         INTEGER NOT NULL DEFAULT 22,
    cpu_cores          INTEGER,
    memory_bytes       INTEGER,
    credential_id      TEXT,
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE RESTRICT,
    FOREIGN KEY (credential_id) REFERENCES credentials(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_hosts_name ON hosts(name);
CREATE INDEX IF NOT EXISTS idx_hosts_site_id ON hosts(site_id);
CREATE INDEX IF NOT EXISTS idx_hosts_credential_id ON hosts(credential_id);
CREATE INDEX IF NOT EXISTS idx_hosts_agent_fingerprint ON hosts(agent_fingerprint);

-- +goose Down
DROP TABLE IF EXISTS hosts;
DROP TABLE IF EXISTS sites;
DROP TABLE IF EXISTS credentials;
