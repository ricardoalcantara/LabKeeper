# LabKeeper

Automated homelab server discovery and management tool for organizing and tracking your network's machines and VMs.

## Overview

LabKeeper helps you keep track of all servers in your homelab environment by automatically discovering and organizing them.

## Portal (SPA + API + min-idp)

The portal is a minimal authenticated app:

- `web/` — React SPA with OIDC PKCE login through [min-idp](https://github.com/ricardoalcantara/min-idp)
- `cmd/server` — go-minstack API that validates JWTs from min-idp JWKS
- `GET /api/ping` — protected endpoint used to verify auth end-to-end

### Run the portal locally

LabKeeper is self-contained for local portal work: min-idp runs from Docker (`v0.5.0-alpha`) with Docker hostnames `min-idp` and `labkeeper` (public PKCE bootstrap SP).

1. Map hostnames (once):

```bash
# /etc/hosts
127.0.0.1 min-idp labkeeper
```

2. Configure min-idp secrets (once):

```bash
cp docker/docker-compose.override.example.yml docker/docker-compose.override.yml
# set MIN_IDP_MASTER_KEY (openssl rand -base64 32) and optional SMTP
# override CORS / EXTERNAL_URL / redirect URIs here for LAN access if needed
```

3. Start min-idp:

```bash
cd docker && docker compose up -d
```

Compose defaults: `MIN_IDP_EXTERNAL_URL=http://min-idp:8081`, redirect `http://labkeeper:5173/callback`, `MIN_IDP_BOOTSTRAP_SP_PUBLIC=true`. Bootstrap runs once on a fresh volume.

4. Start the API:

```bash
cp .env.example .env
go run ./cmd/server
```

5. Start the SPA:

```bash
cd web
cp .env.example .env
npm install
npm run dev
```

Open [http://labkeeper:5173](http://labkeeper:5173). Visiting `/` redirects to SSO when logged out. `/login` shows a manual SSO button. Logout returns to `/login` to avoid redirect loops.

If the DB was already bootstrapped with a different redirect URI, either update that OIDC client in min-idp or reset the Docker volume so bootstrap runs again (`docker compose down -v`).

See [AGENTS.md](AGENTS.md) for repo standards.

## Go TLS WebSocket POC

This repository also includes a small Go proof of concept with two binaries:

- `poc-server`: starts a TLS WebSocket endpoint and periodically sends `ping` messages.
- `agent`: connects to that endpoint with a dedicated client certificate, listens for messages, replies with `pong`, and retries forever if the server goes away.

### Default certificate flow

- The POC no longer uses SSH keys.
- On first start, whichever binary runs first creates a local development CA, one server certificate, and one client certificate in the system temp directory.
- On Linux that directory is typically `/tmp/labkeeper-ws-pki`.
- `poc-server` writes its resolved `wss://` URL to `/tmp/labkeeper-server-url`.

Both binaries also support flags and environment variables:

- `LABKEEPER_SERVER_ADDR` or `-addr`
- `LABKEEPER_SERVER_URL` or `-server-url`
- `LABKEEPER_PING_INTERVAL` or `-ping-interval`
- `LABKEEPER_RETRY_INTERVAL` or `-retry-interval`
- `LABKEEPER_CLIENT_TIMEOUT` or `-timeout`
- `LABKEEPER_CA_CERT` or `-ca-cert`
- `LABKEEPER_CLIENT_CERT` or `-client-cert`
- `LABKEEPER_CLIENT_KEY` or `-client-key`

### Run the POC

Start the websocket hub:

```bash
go run ./cmd/poc-server
```

By default it chooses a random free localhost port, serves `wss://`, writes its websocket URL to the system temp directory, and creates the dev certificates if they do not exist yet.

Start the agent:

```bash
go run ./cmd/agent
```

`agent` will automatically read the last URL written by `poc-server`, establish TLS with the generated client certificate, wait for websocket messages, and retry forever if the connection drops.

Expected output:

```text
poc-server: ping sent: id=<message id>
poc-server: pong received: subject=labkeeper-agent id=<same message id> ...
agent: ping received: id=<same message id> from=poc-server
```

### Verify a failure case

If `poc-server` is stopped, `agent` keeps retrying. When it comes back, `agent` reconnects and starts answering `ping` messages again. If either side uses the wrong CA or client certificate, the TLS handshake fails.

## Planned Features

### Core Features
- [ ] Network scanning for active machines
- [ ] Basic host information collection (IP, hostname, status)
- [ ] Host type identification (physical/virtual/container when possible)
- [ ] REST API endpoints
- [ ] Web dashboard

### Future Enhancements
- [ ] Real-time status monitoring
- [ ] Resource usage tracking (CPU, memory, disk)
- [ ] Basic alerting system
- [ ] Server tagging and organization
- [ ] Network topology visualization

## Contributing

Contributions are welcome! The project is in its early stages, and we're open to suggestions and help.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
