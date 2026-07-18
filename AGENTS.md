# LabKeeper Agent Context

Standards for AI and human contributors working in this repository.

## Product names

| Name | Meaning | Code |
|------|---------|------|
| **LabKeeper Agent** | Only the agent binary | `cmd/agent` |
| **Server** | Control-plane binary (Portal HTTP API + Agent WebSocket hub) | `cmd/server` |
| **Portal** | Browser SPA | `web/` |
| **LabKeeper Admin** | Server + Portal together | `cmd/server` + `web/` |
| **Inventory** | Collection of managed machines (Ansible-style) | `internal/inventory/`, `/api/inventory/...` |
| **Host** | One item in Inventory | `/api/inventory/hosts/:id` |

Do **not** call Inventory items “servers” — **Server** is the LabKeeper Admin backend only.

## Repository layout

- `web/` — Portal (Vite + TypeScript SPA)
- `cmd/server/` — Server (go-minstack HTTP + Agent mTLS WebSocket hub)
- `cmd/agent/` — LabKeeper Agent
- `internal/health/` — Portal health/ping API
- `internal/inventory/` — Inventory registry, Agent hub, Hosts API
- `internal/httpapi/`, `internal/pki/` — Agent wire protocol and local mTLS PKI
- `docker/` — min-idp Compose for local Portal auth (`v0.5.0-alpha`; override is gitignored)

## Go backend (go-minstack)

Follow [go-minstack AGENTS.example.md](https://github.com/go-minstack/go-minstack/blob/main/AGENTS.example.md).

- Import root: `github.com/go-minstack/go-minstack`
- Keep `cmd/*/main.go` thin
- Register domains via `internal/<domain>/module.go` with `Register(app *core.App)`
- Use constructor injection; avoid globals and `init()` wiring
- Portal API modules: `core` + `gin` + `portalauth` (no DB until needed)
- Route registration belongs in explicit `RegisterRoutes` invoked by `app.Invoke(...)`

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

- No Tailwind or shadcn for now; use plain CSS in `web/src/styles/`
- One component per file under `web/src/components/`
- Route-level screens live in `web/src/pages/`
- Shared non-UI logic lives in `web/src/lib/`
- `web/src/app/` holds router shell only
- Do not put multiple components in a single page file

### Auth UX rules

- `/` auto-redirects to SSO when unauthenticated; signed-in home shows Inventory Hosts
- `/login` stays on page and shows the SSO button (no auto redirect)
- `/callback` completes OIDC and returns to `/`
- Logout clears local session and uses min-idp RP logout with `post_logout_redirect_uri` = Portal `/login` (allowlisted on the OIDC client)

## Do not do this

- Do not add a database to the portal MVP unless required
- Do not serve the SPA from the Go API yet (Vite dev server is enough for now)
- Do not mix Agent mTLS auth with Portal OIDC auth
- Do not hide route registration inside constructors
- Do not commit `web/.env` or `docker-compose.override.yml`
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
