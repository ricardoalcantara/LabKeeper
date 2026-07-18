# LabKeeper Agent Context

Standards for AI and human contributors working in this repository.

## Repository layout

- `web/` — React SPA portal (Vite + TypeScript)
- `cmd/server/` — go-minstack HTTP API for the portal
- `cmd/poc-server/` — TLS WebSocket hub for the agent proof of concept
- `cmd/agent/` — agent client that connects to `cmd/poc-server`
- `internal/health/` — portal API domain modules
- `internal/httpapi/`, `internal/pki/` — agent POC shared code
- `docker/` — min-idp Compose for local portal dev (`v0.5.0-alpha`; override is gitignored)

## Go backend (go-minstack)

Follow [go-minstack AGENTS.example.md](https://github.com/go-minstack/go-minstack/blob/main/AGENTS.example.md).

- Import root: `github.com/go-minstack/go-minstack`
- Keep `cmd/*/main.go` thin
- Register domains via `internal/<domain>/module.go` with `Register(app *core.App)`
- Use constructor injection; avoid globals and `init()` wiring
- Portal API modules: `core` + `gin` + `portalauth` (no DB until needed)
- Route registration belongs in explicit `RegisterRoutes` invoked by `app.Invoke(...)`

### Portal auth

- Browser OIDC PKCE lives in the SPA (`web/src/lib/oidc.ts`)
- API validates bearer JWTs via `MINSTACK_JWKS_URL` (min-idp JWKS, including ES256)
- `internal/portalauth` handles JWKS validation because min-idp signs with EC keys
- Do not reuse SSH keys or `authorized_keys` for portal auth

### Environment variables

Portal API (`.env`):

- `MINSTACK_HTTP_PORT`
- `MINSTACK_CORS_ORIGIN`
- `MINSTACK_JWKS_URL`
- `MINSTACK_LOG_LEVEL`

SPA (`web/.env`):

- `VITE_OIDC_ISSUER`
- `VITE_OIDC_CLIENT_ID`
- `VITE_OIDC_REDIRECT_URI`
- `VITE_OIDC_LOGIN_LABEL`
- `VITE_API_URL`

## React SPA

- No Tailwind or shadcn for now; use plain CSS in `web/src/styles/`
- One component per file under `web/src/components/`
- Route-level screens live in `web/src/pages/`
- Shared non-UI logic lives in `web/src/lib/`
- `web/src/app/` holds router shell only
- Do not put multiple components in a single page file

### Auth UX rules

- `/` auto-redirects to SSO when unauthenticated
- `/login` stays on page and shows the SSO button (no auto redirect)
- `/callback` completes OIDC and returns to `/`
- Logout clears local session and uses min-idp RP logout with `post_logout_redirect_uri=/login`

## Do not do this

- Do not add a database to the portal MVP unless required
- Do not serve the SPA from the Go API yet (Vite dev server is enough for now)
- Do not mix agent POC auth with portal OIDC auth
- Do not hide route registration inside constructors
- Do not commit `web/.env` or `docker-compose.override.yml`
- **NEVER** add `Co-Authored-By` / `Co-authored-by` (or any co-author trailer) to git commits — not for Cursor, AI agents, bots, or tools. If a hook or tool injects one, strip it before committing or amend it out before push.

## Local development

LabKeeper runs alone for local portal work: min-idp via Docker (`ghcr.io/ricardoalcantara/min-idp:v0.5.0-alpha`), then the API and SPA on the host.

Default browser hostnames (add `127.0.0.1 min-idp labkeeper` to `/etc/hosts`):

- IdP: `http://min-idp:8081`
- SPA / redirect: `http://labkeeper:5173` (callback `/callback`)

1. Copy `docker/docker-compose.override.example.yml` → `docker/docker-compose.override.yml` and set secrets (and LAN URL overrides if not using the hostnames above).
2. Start min-idp: `cd docker && docker compose up -d`
3. API: `go run ./cmd/server`
4. SPA: `cd web && npm install && npm run dev`
5. Open `http://labkeeper:5173`

Do not use `scripts/register-portal-sp.sh` — the OIDC client comes from min-idp bootstrap env (`MIN_IDP_BOOTSTRAP_SP_*`, including `MIN_IDP_BOOTSTRAP_SP_PUBLIC=true` for the SPA).

## References

- go-minstack: `/home/ricardo/go-minstack-monorepo/AGENTS.example.md`
- min-idp: `/home/ricardo/min-idp/AGENTS.md`
- min-idp image: `ghcr.io/ricardoalcantara/min-idp:v0.5.0-alpha`
- OIDC SPA example: `/home/ricardo/min-idp/apps/oidc-public-test-sp`
