# LabKeeper Agent Context

Standards for AI and human contributors working in this repository.

## Product names

| Name | Meaning | Code |
|------|---------|------|
| **LabKeeper Agent** | Only the agent binary | `cmd/agent` |
| **Server** | Control-plane binary (Portal HTTP API + Agent WebSocket hub) | `cmd/server` |
| **Portal** | Browser SPA | `web/` |
| **LabKeeper Admin** | Server + Portal together | `cmd/server` + `web/` |
| **Inventory** | Collection of managed Hosts (Ansible-style) | `internal/inventory/`, `/api/inventory` |
| **Site** | Place/account bucket grouping Hosts | `internal/site/`, `/api/site`, `site_id` on Host |
| **Host** | One Inventory item | `/api/inventory/:id` |

Do **not** call Inventory items “servers” — **Server** is the LabKeeper Admin backend only.

## Repository layout

- `web/` — Portal (Vite + TypeScript SPA)
- `cmd/server/` — Server (go-minstack HTTP + Agent mTLS WebSocket hub)
- `cmd/agent/` — LabKeeper Agent
- `internal/health/` — Portal health/ping API
- `internal/site/` — Sites CRUD API (`/api/site`)
- `internal/inventory/` — Inventory Hosts (DB), Agent hub, Hosts CRUD API (`/api/inventory`)
- `internal/discovery/` — private LAN discovery (ICMP + TCP; JWT; `/api/discovery`)
- `internal/netprobe/` — shared ICMP ping + TCP dial used by discovery and inventory probe
- `internal/credentials/` — encrypted Credentials vault (password / SSH key + optional key passphrase + Ansible-style become)
- `internal/crypto/` — `CryptoService` (AES-GCM via `LABKEEPER_MASTER_KEY`)
- `internal/storage/` — multi-driver GORM (`LABKEEPER_DB_*`)
- `migrations/` — goose SQL migrations (embedded)
- `internal/httpapi/`, `internal/pki/` — Agent wire protocol and local mTLS PKI
- `docker/` — min-idp Compose for local Portal auth (`v0.5.0-alpha`; override is gitignored)

## Go backend (go-minstack)

Follow [go-minstack AGENTS.example.md](https://github.com/go-minstack/go-minstack/blob/main/AGENTS.example.md).

- Import root: `github.com/go-minstack/go-minstack`
- Keep `cmd/*/main.go` thin
- Register domains via `internal/<domain>/module.go` with `Register(app *core.App)`
- Use constructor injection; avoid globals and `init()` wiring
- Portal API modules: `core` + `gin` + `portalauth` + `storage` + `migration` when persistence is needed
- Route registration belongs in explicit `RegisterRoutes` invoked by `app.Invoke(...)`
- Schema changes go through goose migrations under `migrations/` (not AutoMigrate for production tables)

### Portal REST API

- **Collection path = resource name** — `/api/site`, `/api/inventory`, `/api/credentials`. Do not nest the entity twice (`/api/inventory/hosts`).
- **Item path = collection + id** — `/api/inventory/:id`.
- **Filters on collection GET** — query params (`GET /api/inventory?site_id=`), not extra path segments.
- **Non-CRUD actions** — separate namespace (`/api/discovery/scan`, `/api/credentials/ssh-keygen`).
- **Product names vs paths** — “Host” is the entity; `/api/inventory` is the host collection (maps to `hosts` table). Do not expose duplicate `/api/host` and `/api/inventory`.
- **Avoid redundant joins** — Host list/get returns `site_id` only; site names come from `GET /api/site` on the client.
- **Secrets** — list/get never return decrypted credential fields.

### Auth boundaries

- **Portal** (humans): OIDC PKCE in the SPA (`web/src/lib/oidc.ts`); Server validates Bearer JWTs via `MINSTACK_JWKS_URL`
- **Agent**: mTLS client certificates on a dedicated WebSocket listener (`LABKEEPER_AGENT_ADDR`, default `127.0.0.1:8443`)
- Do not mix Portal OIDC with Agent mTLS
- Do not reuse SSH keys or `authorized_keys` for Portal auth

### Environment variables

Server (`.env`):

- `MINSTACK_HTTP_PORT` — Portal HTTP API
- `MINSTACK_CORS_ORIGIN`
- `MINSTACK_JWKS_URL`
- `MINSTACK_LOG_LEVEL`
- `LABKEEPER_AGENT_ADDR` — Agent mTLS WebSocket listen address
- `LABKEEPER_DB_DRIVER` — `sqlite` | `mysql` | `postgres` (default `sqlite`)
- `LABKEEPER_DB_DSN` — e.g. `./data/labkeeper.db`
- `LABKEEPER_MASTER_KEY` — base64 32-byte AES key (`openssl rand -base64 32`)
- `LABKEEPER_PROBE_INTERVAL` — inventory reachability probe tick (default `15s`)

Portal (`web/.env`):

- `VITE_OIDC_ISSUER`
- `VITE_OIDC_CLIENT_ID`
- `VITE_OIDC_REDIRECT_URI`
- `VITE_OIDC_POST_LOGOUT_REDIRECT_URI` (Portal `/login`; must be allowlisted on min-idp)
- `VITE_OIDC_LOGIN_LABEL`
- `VITE_API_URL`

Agent:

- `LABKEEPER_SERVER_URL` (or URL file written by Server)
- `LABKEEPER_HEARTBEAT_INTERVAL`
- `LABKEEPER_RETRY_INTERVAL`
- `LABKEEPER_CA_CERT` / `LABKEEPER_CLIENT_CERT` / `LABKEEPER_CLIENT_KEY`

## React SPA (Portal)

- Use Tailwind CSS (`@tailwindcss/vite`) for Portal layout and UI; Lucide (`lucide-react`) for icons; no shadcn for now
- One component per file under `web/src/components/`
- Route-level screens live in `web/src/pages/` (thin wrappers or auth-only pages)
- Shared non-UI logic lives in `web/src/lib/`
- `web/src/app/` holds router shell only (`AppShell` layout + routes)
- Do not put multiple components in a single page file

### Auth UX rules

- `/` auto-redirects to SSO when unauthenticated; authenticated users land on `/labkeeper`
- Portal shell is Proxmox-like: left tree rooted at **LabKeeper** (Sites → Hosts); right detail pane
- Routes: `/labkeeper` (global overview + Credentials vault), `/sites/:siteId`, `/hosts/:hostId`
- Clicking **LabKeeper** in the tree shows global config including Credentials (not a separate tree node)
- Hosts load lazily when a Site is expanded in the tree (`GET /api/inventory?site_id=`)
- Portal follows system color scheme by default (`prefers-color-scheme`); users can toggle light/dark via the header button (stored in `localStorage`)
- `/credentials` redirects to `/labkeeper`
- Credentials vault (login secret; optional SSH key passphrase; optional `become_method` / `become_user` / become secret) is managed on the LabKeeper detail. List/get never return secrets — only `has_passphrase` / `has_become_secret` flags.
- Inventory Hosts are persisted (`hosts` table) with required `site_id`. Agents upsert by `agent_fingerprint` (client cert) into the default Site (`Default`) until enrollment UI exists. Optional `credential_id` links one vault credential for future SSH. `cpu_cores` / `memory_bytes` are reserved for Agent discovery.
- **Reachability**: `agent_online` = Agent WebSocket connected; `online` = Agent connected **or** Server probe succeeded. Per-host `probe_method` (`icmp` default | `tcp`) + `probe_port` (TCP only). Server goroutine probes agent-offline hosts using Portal `address` or, if empty, the first usable Agent-reported IP (`LABKEEPER_PROBE_INTERVAL`). Portal only polls inventory (no run-probe API). Tree/detail: green = Agent up; amber “reachable · Agent offline” when probe succeeds without Agent; red = offline.
- After editing embedded goose SQL in `migrations/00001_init.sql`, wipe local SQLite with `rm -rf data/` before restart.
- LAN **Discover** is on-demand from a Site detail when that Site has `discovery_enabled` and the Server has a private (RFC1918) interface. Scans run on the Server (`/api/discovery/*`), max `/23`, ICMP (`ping`) + TCP `22/80/443/445`; results are candidates — never auto-added.
- `/login` stays on page and shows the SSO button (no auto redirect)
- `/callback` completes OIDC and returns to `/labkeeper`
- Logout clears local session and uses min-idp RP logout with `post_logout_redirect_uri` = Portal `/login` (allowlisted on the OIDC client)

## Do not do this

- Do not return decrypted credential secrets from list/get APIs
- Do not use package-level crypto helpers — inject `*crypto.CryptoService`
- Do not serve the SPA from the Go API yet (Vite dev server is enough for now)
- Do not mix Agent mTLS auth with Portal OIDC auth
- Do not hide route registration inside constructors
- Do not commit `web/.env`, `docker-compose.override.yml`, `data/`, or `LABKEEPER_MASTER_KEY` values
- **NEVER** add `Co-Authored-By` / `Co-authored-by` (or any co-author trailer) to git commits — not for Cursor, AI agents, bots, or tools. If a hook or tool injects one, strip it before committing or amend it out before push.

## Local development

LabKeeper Admin runs alone for local work: min-idp via Docker, then Server + Portal on the host; Agents dial Server over mTLS.

Default browser hostnames (add `127.0.0.1 min-idp labkeeper` to `/etc/hosts`):

- IdP: `http://min-idp:8081`
- Portal / redirect: `http://labkeeper:5173` (callback `/callback`)

1. Copy `docker/docker-compose.override.example.yml` → `docker/docker-compose.override.yml` and set secrets (and LAN URL overrides if not using the hostnames above).
2. Start min-idp: `cd docker && docker compose up -d`
3. Server: `go run ./cmd/server` (Portal HTTP + Agent WSS)
4. Portal: `cd web && npm install && npm run dev`
5. Agent (optional): `go run ./cmd/agent`
6. Open `http://labkeeper:5173` → Inventory

Do not use `scripts/register-portal-sp.sh` — the OIDC client comes from min-idp bootstrap env (`MIN_IDP_BOOTSTRAP_SP_*`, including `MIN_IDP_BOOTSTRAP_SP_PUBLIC=true` for the Portal).

## References

- go-minstack: `/home/ricardo/go-minstack-monorepo/AGENTS.example.md`
- min-idp: `/home/ricardo/min-idp/AGENTS.md`
- min-idp image: `ghcr.io/ricardoalcantara/min-idp:v0.5.0-alpha`
- OIDC SPA example: `/home/ricardo/min-idp/apps/oidc-public-test-sp`
