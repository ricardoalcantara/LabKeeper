# LabKeeper

Automated homelab discovery and management for organizing and tracking your network's machines and VMs.

## Product names

| Name | Meaning |
|------|---------|
| **LabKeeper Admin** | **Server** + **Portal** (human control plane) |
| **Server** | `cmd/server` — Portal HTTP API + Agent mTLS WebSocket hub |
| **Portal** | `web/` — browser SPA (OIDC) |
| **LabKeeper Agent** | `cmd/agent` only — runs on each managed machine |
| **Inventory** | Collection of managed machines (Ansible-style) |
| **Host** | One item in Inventory |

Do not call Inventory items “servers” — that word means the **Server** binary.

## LabKeeper Admin

Minimal authenticated admin app:

- **Portal** — React SPA with OIDC PKCE via [min-idp](https://github.com/ricardoalcantara/min-idp)
- **Server** — go-minstack API that validates JWTs, persists Inventory Hosts + encrypted Credentials
- `GET /api/ping` — auth check
- `/api/inventory/hosts` — Inventory CRUD (JWT); Agents also upsert Hosts over mTLS
- `/api/inventory/discovery` — private LAN scan (JWT; Server-local; candidates only, no auto-add)
- `/api/credentials` — encrypted vault (password / SSH key; optional key passphrase; Ansible-style become `none|sudo|su` + become user/secret; JWT; secrets never returned on GET)
- Hosts may link one vault credential (`credential_id`) for future SSH; `cpu_cores` / `memory_bytes` reserved for Agent discovery

Discovery is enabled only when the Server has a private RFC1918 address. Scans accept interface CIDRs or a custom private CIDR up to `/23`, using ICMP (`ping`) plus TCP probes. The Portal **Discover** button prefills Add host — nothing is enrolled automatically.

### Run Admin locally

min-idp runs from Docker (`v0.5.0-alpha`) with hostnames `min-idp` and `labkeeper` (public PKCE bootstrap SP).

1. Map hostnames (once):

```bash
# /etc/hosts
127.0.0.1 min-idp labkeeper
```

2. Configure min-idp secrets (once):

```bash
cp docker/docker-compose.override.example.yml docker/docker-compose.override.yml
# set MIN_IDP_MASTER_KEY (openssl rand -base64 32) and optional SMTP
# override CORS / EXTERNAL_URL / redirect URIs here for LAN or domain access if needed
```

3. Start min-idp:

```bash
cd docker && docker compose up -d
```

4. Start Server:

```bash
cp .env.example .env
# set LABKEEPER_MASTER_KEY=$(openssl rand -base64 32)
# optional: LABKEEPER_DB_DRIVER / LABKEEPER_DB_DSN (default sqlite ./data/labkeeper.db)
go run ./cmd/server
```

Server listens for Portal HTTP (`MINSTACK_HTTP_PORT`, default `8080`) and Agents on mTLS WebSocket (`LABKEEPER_AGENT_ADDR`). It runs goose migrations, opens the DB, and writes the Agent URL to `$TMPDIR/labkeeper-server-url`. Wipe local SQLite with `rm -rf data/` after editing `migrations/00001_init.sql` or other schema resets.

5. Start Portal:

```bash
cd web
cp .env.example .env
npm install
npm run dev
```

Open [http://labkeeper:5173](http://labkeeper:5173). Home manages **Inventory** Hosts (add/edit, assign credential); **Credentials** manages the vault. `/login` shows a manual SSO button. Logout returns to `/login`.

If the IdP DB was bootstrapped with a different redirect URI, update the OIDC client or reset the Docker volume (`docker compose down -v`).

See [AGENTS.md](AGENTS.md) for contributor standards.

## LabKeeper Agent

The Agent dials Server over mTLS WebSocket, sends `hello` then periodic `heartbeat` messages (hostname, OS, IPs), and reconnects with backoff if Server goes away.

### Certificates

On first start, Server or Agent creates a local development CA plus server/client certificates under `$TMPDIR/labkeeper-ws-pki` (typically `/tmp/labkeeper-ws-pki`).

### Run an Agent

With Server already running:

```bash
go run ./cmd/agent
```

Useful env / flags:

- `LABKEEPER_SERVER_URL` / `-server-url` (otherwise read `$TMPDIR/labkeeper-server-url`)
- `LABKEEPER_HEARTBEAT_INTERVAL` / `-heartbeat-interval` (default `10s`)
- `LABKEEPER_RETRY_INTERVAL` / `-retry-interval`
- `LABKEEPER_CA_CERT`, `LABKEEPER_CLIENT_CERT`, `LABKEEPER_CLIENT_KEY`

Expected flow: Agent connects → durable Inventory Host (UUID) appears online, keyed by cert fingerprint → heartbeats keep `last_seen` fresh. Hosts survive Server restart (marked offline until reconnect). Pre-enroll Hosts in the Portal with address + credential before an Agent exists.

## Todo

### Done
- [x] Portal SPA with OIDC PKCE (min-idp)
- [x] Server JWT auth (`GET /api/ping`)
- [x] Local min-idp in Docker (`v0.5.0-alpha`, hostnames `min-idp` / `labkeeper`)
- [x] Agent mTLS WebSocket hub on Server (poc-server removed)
- [x] Inventory Hosts via hello/heartbeat + `GET /api/inventory/hosts`
- [x] Portal home shows Inventory Hosts
- [x] Encrypted Credentials vault (password / SSH key) + Portal UI
- [x] Credential key passphrase + become (sudo/su) secrets
- [x] Server DB (sqlite/mysql/postgres) + goose migrations
- [x] Persist Inventory Hosts + Portal CRUD
- [x] Assign credential → Host (`credential_id`)
- [x] Private LAN discovery (candidates; manual add)

### Next
- [ ] Server-side SSH login/probe with vault credentials
- [ ] Agent hardware discovery (`cpu_cores` / `memory_bytes`)
- [ ] Per-agent certificates / enrollment
- [ ] Serve Portal from Server (or reverse proxy) for non-dev deploys
- [ ] Inventory groups (Ansible-style)

### Later
- [ ] Real-time status monitoring
- [ ] Alerting
- [ ] Tags and topology view
- [ ] Allowlisted command channel

## Contributing

Contributions are welcome! The project is in its early stages, and we're open to suggestions and help.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
