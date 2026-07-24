# LabKeeper

Automated homelab discovery and management for organizing and tracking your network's machines and VMs.

## Product names

| Name | Meaning |
|------|---------|
| **LabKeeper Admin** | **Server** + **Portal** (human control plane) |
| **Server** | `cmd/server` — Portal HTTP API + Agent mTLS WebSocket hub |
| **Portal** | `web/` — browser SPA (OIDC) |
| **LabKeeper Agent** | `cmd/agent` only — runs on each managed machine |
| **Inventory** | Collection of managed Hosts (Ansible-style) |
| **Site** | Place/account bucket grouping Hosts (Default, cloud provider, …) |
| **Host** | One item in Inventory |

Do not call Inventory items “servers” — that word means the **Server** binary.

## LabKeeper Admin

Minimal authenticated admin app:

- **Portal** — React SPA (Tailwind) with OIDC PKCE via [min-idp](https://github.com/ricardoalcantara/min-idp); Proxmox-like shell rooted at **LabKeeper** (Credentials + Sites → Hosts in the left tree; detail pane on the right)
- **Server** — go-minstack API that validates JWTs, persists Inventory Hosts + encrypted Credentials
- `GET /api/ping` — auth check
- `/api/site` — Sites CRUD (JWT)
- `/api/inventory` — Hosts CRUD (JWT); optional `?site_id=` filter; Agents also upsert Hosts over mTLS
- `/api/discovery` — private LAN scan (JWT; Server-local; candidates only, no auto-add)
- `/api/credentials` — encrypted vault (password / SSH key; optional key passphrase; Ansible-style become `none|sudo|su` + become user/secret; JWT; secrets never returned on GET)
- `/api/terminal` — Host Console tickets + WebSocket (JWT mint; ticket upgrade); Agent local PTY or Server SSH with vault credential
- Hosts belong to one Site (`site_id`); may link one vault credential (`credential_id`) for SSH Console; `cpu_cores` / `memory_bytes` reserved for Agent discovery
- Per-host reachability probe (`probe_method` `icmp`|`tcp`, default ICMP): Server loop updates `online` when the Agent is offline; `agent_online` tracks WebSocket presence. Portal polls inventory only.
- Host detail **Console** tab (`@xterm/xterm`): path Auto / Agent / SSH over `/api/terminal`

Discovery is enabled per Site (`discovery_enabled`) when the Server has a private RFC1918 address. Scans accept interface CIDRs or a custom private CIDR up to `/23`, using ICMP (`ping`) plus TCP probes. The Portal **Discover** panel (inside an enabled Site) prefills Add host — nothing is enrolled automatically.

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

Open [http://labkeeper:5173](http://labkeeper:5173). Signed-in UI is a split Inventory shell: left tree (**LabKeeper** → Credentials + Sites → Hosts), right detail pane. `/login` shows a manual SSO button. Logout returns to `/login`.

If the IdP DB was bootstrapped with a different redirect URI, update the OIDC client or reset the Docker volume (`docker compose down -v`).

See [AGENTS.md](AGENTS.md) for contributor standards and [ROADMAP.md](ROADMAP.md) for planned work.

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

Expected flow: Agent connects → durable Inventory Host (UUID) appears online with `agent_online`, keyed by cert fingerprint → heartbeats keep `last_seen` fresh. On disconnect or Server restart, `agent_online` clears; the Server probe loop (ICMP/TCP per host, `LABKEEPER_PROBE_INTERVAL` default `15s`) may keep `online` true when the address answers. When online, Console can open a local PTY via the Agent. Pre-enroll Hosts in the Portal with address + credential + probe settings before an Agent exists (enables SSH Console without Agent).

## Todo

### Done
- [x] Portal SPA with OIDC PKCE (min-idp)
- [x] Server JWT auth (`GET /api/ping`)
- [x] Local min-idp in Docker (`v0.5.0-alpha`, hostnames `min-idp` / `labkeeper`)
- [x] Agent mTLS WebSocket hub on Server (poc-server removed)
- [x] Inventory Hosts via hello/heartbeat + `GET /api/inventory`
- [x] Portal home shows Inventory Hosts grouped by Site
- [x] Encrypted Credentials vault (password / SSH key) + Portal UI
- [x] Credential key passphrase + become (sudo/su) secrets
- [x] Server DB (sqlite/mysql/postgres) + goose migrations
- [x] Persist Inventory Hosts + Portal CRUD
- [x] Assign credential → Host (`credential_id`)
- [x] Private LAN discovery (candidates; manual add)
- [x] Inventory Sites (Default site, cloud accounts; lazy-loaded hosts per site)
- [x] Portal Proxmox-style shell (Tailwind; LabKeeper root → Credentials + Sites → Hosts)
- [x] Inventory reachability probe (Agent presence + ICMP/TCP fallback; Portal status poll only)
- [x] Host Console (xterm.js; Agent PTY + Server SSH over ticket WebSocket)

### Next / later

Tracked in [ROADMAP.md](ROADMAP.md) (Console, Agent, integrations, ops, audit/alerts, quality). Highlights:

- [ ] SSH host-key verification + dedicated SSH port
- [ ] Agent enrollment UI / bootstrap tokens
- [ ] Agent hardware discovery + local flat-file telemetry (rotate/compress/purge) synced for Portal charts
- [ ] One-click Agent install over SSH; Agent auto-update
- [ ] Agent-side Discovery (scan from Agents so multi-Site LANs work with one Server)
- [ ] Package updates via Agent (apt/dnf/pacman check + install, Proxmox-style)
- [ ] Docker integration via Agent; storage inventory (S3/SMB/NFS/SFTP); later Proxmox API
- [ ] Admin TLS certs in Portal; Host cert inventory / expiry alerts
- [ ] Audit log; email + webhook alerts when Hosts go unavailable
- [ ] Admin backup/restore of control-plane state
- [ ] Ad-hoc commands / playbooks; inventory groups & tags
- [ ] Serve Portal from Server; OpenAPI docs

## Contributing

Contributions are welcome! The project is in its early stages, and we're open to suggestions and help.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
