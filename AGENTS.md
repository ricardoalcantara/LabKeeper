# LabKeeper Agent Context

Standards for AI and human contributors working in this repository.

## Repository layout

- `web/` — React SPA portal (Vite + TypeScript)
- `cmd/server/` — go-minstack HTTP API for the portal
- `cmd/poc-server/` — TLS WebSocket hub for the agent proof of concept
- `cmd/agent/` — agent client that connects to `cmd/poc-server`
- `internal/health/` — portal API domain modules
- `internal/httpapi/`, `internal/pki/` — agent POC shared code
- `docker/` — optional compose files (not required; prefer standalone min-idp)

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

## Local development

Prefer a standalone min-idp process (see `/home/ricardo/min-idp/.env`), not Docker.

1. Ensure min-idp is running with CORS for the SPA origin and a **public** bootstrap SP (`MIN_IDP_BOOTSTRAP_SP_PUBLIC=true`) whose redirect/client id match `web/.env`
2. API: `go run ./cmd/server`
3. SPA: `cd web && npm install && npm run dev`
4. Open the SPA via the LAN host in `VITE_OIDC_REDIRECT_URI`, not bare `localhost`

Do not use `scripts/register-portal-sp.sh` — the OIDC client comes from min-idp bootstrap env (`MIN_IDP_BOOTSTRAP_SP_*`, including `MIN_IDP_BOOTSTRAP_SP_PUBLIC=true` for the SPA).

## References

- go-minstack: `/home/ricardo/go-minstack-monorepo/AGENTS.example.md`
- min-idp: `/home/ricardo/min-idp/AGENTS.md`
- min-idp local env: `/home/ricardo/min-idp/.env`
- OIDC SPA example: `/home/ricardo/min-idp/apps/oidc-public-test-sp`
