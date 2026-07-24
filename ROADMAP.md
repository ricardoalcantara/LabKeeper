# LabKeeper Roadmap

This document tracks planned features. Items are grouped by theme, not strict priority — implementation order will depend on what's most needed at the time.

---

## Current snapshot

What ships today (homelab control plane):

- **Portal** — OIDC PKCE SPA (min-idp), Proxmox-like shell (LabKeeper → Credentials + Sites → Hosts), Tailwind + Lucide, light/dark
- **Server** — go-minstack HTTP API (JWT) + Agent mTLS WebSocket hub
- **Sites & Inventory** — persisted Hosts with CRUD, `site_id`, lazy tree load, Default site for Agent upserts
- **Credentials vault** — password / SSH key, optional key passphrase, Ansible-style become fields; secrets never returned on GET
- **Discovery** — per-Site private LAN scan (ICMP + TCP), candidates only, manual enroll; **Server-local today** (see Agent-side Discovery on the roadmap for multi-Site LANs)
- **Reachability** — `agent_online` (WebSocket) plus Server ICMP/TCP probe when the Agent is offline; Host detail status UX
- **Host Console** — xterm.js over ticket-auth WebSocket; **Agent** path (local PTY on the host) or **SSH** path (Server dials with vault credential); Auto prefers Agent when online

See [AGENTS.md](AGENTS.md) for contributor standards and API conventions.

---

## Tier 1 — Console & remote access

### SSH host-key verification
Replace `ssh.InsecureIgnoreHostKey` with a known-hosts store (per Host or global), first-connect trust prompts in the Portal, and clear errors on key mismatch.

### Dedicated SSH port
Persist `ssh_port` (or parse `address:port`) instead of assuming port 22 for Console SSH dials and future remote ops.

### Become / sudo in Console and exec
Use vault `become_method` / `become_user` / become secret so a Console session or ad-hoc command can escalate after login (Ansible-style), not only as the login user.

### Multi-session Console
Multiple concurrent shells per Host, reconnect with local scrollback restore, and clearer disconnect/reconnect UX beyond a single panel session.

### Agent jump / remote SSH via Agent
When the Server cannot route to the Host but the Agent is online, open SSH (or a proxied channel) from the Agent toward another address — beyond today's local-PTY-only Agent path.

---

## Tier 2 — Agent & enrollment

### Enrollment UI
Stop dumping new Agents into the Default Site only. Let operators pick Site, name, and credential at enroll time (claim/approve flow).

### Agent install & bootstrap token
Documented install packages (or a one-liner), short-lived bootstrap tokens, and per-Agent certificates instead of shared local-dev PKI for real fleets.

### One-click Agent install (via vault credential)
On a Host that already has address + credential (and SSH reachable), add a Portal action that installs the Agent in one click: Server uses the vault secret to SSH in, push/download the Agent binary (or install script), write config (Server URL + bootstrap material), and enable a systemd (or equivalent) service — then the Host should appear `agent_online` without a manual shell session. Pair with enrollment tokens so the new Agent lands on the correct Site. Console “install over SSH” and Agent-path shells remain available as fallbacks when automation fails.

### Agent auto-update
Publish signed Agent releases from LabKeeper Admin (or a release URL). Connected Agents check/apply updates (or receive a push) so fleets do not stay stuck on the binary from one-click install. Report version in heartbeat; Portal shows outdated Agents and can trigger update. Prefer staged rollout and rollback on failed start.

### Hardware discovery
Fill reserved `cpu_cores` / `memory_bytes` (and related facts) from Agent `hello` / `heartbeat` so Host overview shows live capacity, not placeholders.

### Local telemetry store + sync for visualization
Keep time-series metrics **on the Host** under Agent control (CPU, memory, disk, net, …) using simple **flat files** — not a local SQL DB. Rotate, compress, and purge by retention so each machine owns its history without burdening Server disk. Periodically (or on demand) **sync summaries / windows** to Server only for Portal charts and alerts; Server is a visualization/cache layer, not the system of record for raw samples. Prefer append-only segments or similar file layouts over inventing a mini-database.

### Richer Agent RPC
Generalize beyond `hello` / `heartbeat` / `shell_*` into a multiplexed command channel (exec, file transfer, metrics, integration plugins) with request IDs and backpressure. This is the foundation for Docker, Agent-side Discovery, and other on-host integrations.

### Agent-side Discovery
Today LAN Discovery runs on the **Server** and only sees networks that Server can reach. With one Server and many Sites, remote labs are invisible unless they share that LAN. Run ICMP/TCP (and later other) scans **on an Agent in the Site**, stream candidates back over the Agent channel, and keep Site-scoped Discover in the Portal. Server-local discovery can remain as a fallback for the Site where Admin itself lives.

### Package updates (apt / dnf / pacman)
Proxmox-style Host updates: with an Agent installed, query pending packages from the local package manager (**apt**, **dnf**/yum, **pacman**) and show counts/lists in Portal. Allow installing selected or all updates through the Agent (audited). Prefer running as the Agent service user / root on the Host — **do not store package-manager credentials on the Agent**; if escalation is needed, use become via an ephemeral Server→Agent instruction from the vault rather than persisting secrets on disk. Sync is “check what’s pending / apply,” not a second credentials store.

---

## Tier 3 — Integrations

Homelabs rarely stop at SSH shells. With an Agent already on the machine (or credentials to reach a service), LabKeeper can grow typed inventory items and operator UIs for common local services.

### Docker (via Agent)
Very common on managed Hosts. When the Agent can talk to the local Docker engine (`docker.sock` or a configured endpoint), expose container/image/volume/network inventory, logs, start/stop/restart, and (later) compose project awareness — all proxied through the existing Agent channel so the Server need not reach the Docker API directly.

### Storage inventory types
Today Inventory is Host-centric. Add first-class **resource types** (or typed inventory items) for network-reachable storage, each with its own detail UI and credential binding:

- **Object storage buckets** — S3-compatible (MinIO, AWS, etc.): list buckets/objects, basic browse/upload/download where safe
- **SMB/Samba shares** — browse and manage files on LAN shares using vault credentials
- **NFS exports** — mount/browse lab NFS shares the same way (common alongside Samba)
- **SFTP** — SSH-backed file transfer as an inventory/browse surface (related to Host SSH, but oriented around files rather than an interactive shell)

Remote file browsing may later reuse patterns from Console/SFTP; treat “see server files” as an explicit product choice (read-only browse first, write ops gated and audited).

### Proxmox API client
A later, higher-level integration: talk to a Proxmox VE API (cluster/nodes/VMs/CTs) for inventory and common power/console actions. Useful for labs that already run Proxmox and for comparing LabKeeper’s Host model against a hypervisor control plane — not required for early Agent/Docker work, but worth keeping on the map.

---

## Tier 4 — Inventory & ops

### Bulk enroll from Discovery
Select many Discovery candidates and create Hosts in one action (Site + optional credential defaults), still without silent auto-add on scan.

### Ad-hoc commands & playbooks
Run Ansible-style commands or small playbooks against Inventory using vault credentials and become — building on Console transport patterns without requiring a full CI product.

### Inventory groups & tags
Ansible-style groups, tags, and (later) a simple topology view for Sites/Hosts (and storage/integration resources).

### Serve Portal from Server
Ship the built SPA from the Go process (or a documented reverse-proxy layout) so non-dev deploys do not depend on a separate Vite server.

### Admin TLS certificates (Portal-managed)
LabKeeper Admin should ship with a built-in TLS certificate story (dev CA today is Agent-oriented; production needs Server/Portal HTTPS). Like Proxmox’s certificate UI: view current cert, upload/replace certificate + key (or ACME later) **from the browser**, without SSHing to the Admin host. Cover Portal HTTP and, where relevant, Agent listener TLS material with clear rotation steps.

### Host TLS / certificate inventory
Discover or report TLS certificates in use on managed Hosts (and later reverse proxies): expiry dates, SANs, and warnings into the alert path before certs die. Complements Admin’s own cert UI — this item is about **inventory Hosts**, not LabKeeper’s listening cert.

### Admin backup
First-class **backup** of LabKeeper Admin state (Sites, Inventory metadata, encrypted Credentials vault ciphertext, settings) to a downloadable or scheduled archive — restore path included. Prefer backup/restore over a casual “export JSON”; document master-key handling so a backup is useless without the key and restorable with it. This is disaster recovery for the control plane, not Host filesystem backup.

---

## Tier 5 — Audit, email & alerting

### Audit log
Record security- and ops-relevant activity in a queryable store: Console open/close (path Agent/SSH), credential create/update/delete (never secret values), inventory and integration mutations, Discovery scans, Docker actions, file browse/download where enabled. Portal UI with filters (actor, host/resource, action, time) and retention settings.

### Email notifications (foundation)
SMTP (or provider) configuration and templates — prerequisite for alerts and optional digests. Align with how operators already run min-idp mail where useful, but keep LabKeeper’s own outbound config for product alerts.

### Alerts on Host availability
Notify when a Host becomes unreachable (probe fail and/or Agent offline beyond a threshold), recovers, or repeatedly flaps. Also feed cert-expiry and (later) package-update urgency into the same pipeline. Tie alert state to existing `online` / `agent_online` signals so Portal status and notifications stay consistent.

### Alert channels (email + webhooks)
Ship **email** first (see foundation above). Add **webhooks** next (Discord, Telegram, ntfy, generic HTTP) so labs can route availability and cert alerts without living in an inbox. Per-Site or global channel config; shared payload shape across channels.

---

## Tier 6 — Quality & DX

### Unit and E2E tests
Coverage for inventory, credentials crypto boundaries, terminal ticket/WS bridges, discovery scan limits, probe loop behavior, and (as they land) integration RPC handlers.

### OpenAPI + docs UI
Publish an OpenAPI spec for Portal APIs and serve a Swagger-style explorer (same idea as min-idp `/docs`).

### Multi-OS Agent PTY
First-class Windows/macOS local shell support (or clear unsupported messaging) where `creack/pty` / platform shells differ from Linux.
