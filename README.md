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
- **Server** — go-minstack API that validates JWTs and maintains Inventory from Agents
- `GET /api/ping` — auth check
- `GET /api/inventory/hosts` — list Hosts (JWT)

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
go run ./cmd/server
```

Server listens for Portal HTTP (`MINSTACK_HTTP_PORT`, default `8080`) and Agents on mTLS WebSocket (`LABKEEPER_AGENT_ADDR`, default `127.0.0.1:8443`). It writes the Agent URL to `$TMPDIR/labkeeper-server-url`.

5. Start Portal:

```bash
cd web
cp .env.example .env
npm install
npm run dev
```

Open [http://labkeeper:5173](http://labkeeper:5173). Home shows **Inventory** Hosts after sign-in. `/login` shows a manual SSO button. Logout returns to `/login`.

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

Expected flow: Agent connects → Inventory Host appears online in Portal → heartbeats keep `last_seen` fresh. If Server stops, Agent keeps retrying; when Server returns, Host comes back online.

## Todo

### Done
- [x] Portal SPA with OIDC PKCE (min-idp)
- [x] Server JWT auth (`GET /api/ping`)
- [x] Local min-idp in Docker (`v0.5.0-alpha`, hostnames `min-idp` / `labkeeper`)
- [x] Agent mTLS WebSocket hub on Server (poc-server removed)
- [x] Inventory Hosts via hello/heartbeat + `GET /api/inventory/hosts`
- [x] Portal home shows Inventory Hosts

### Next
- [ ] Per-agent certificates / enrollment
- [ ] Persist Inventory (DB when needed)
- [ ] Network / LAN discovery for candidate Hosts
- [ ] Serve Portal from Server (or reverse proxy) for non-dev deploys
- [ ] Inventory groups (Ansible-style)

### Later
- [ ] Real-time status monitoring
- [ ] Resource usage (CPU, memory, disk)
- [ ] Alerting
- [ ] Tags and topology view
- [ ] Allowlisted command channel

## Contributing

Contributions are welcome! The project is in its early stages, and we're open to suggestions and help.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
