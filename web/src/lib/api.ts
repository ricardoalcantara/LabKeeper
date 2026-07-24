import { apiUrl } from "./config"
import {
  ensureAccessToken,
  handleSessionExpired,
  refreshAccessToken,
  SessionExpiredError,
} from "./oidc"

export type Site = {
  id: string
  name: string
  discovery_enabled: boolean
  created_at: string
  updated_at: string
}

export type SiteListResponse = {
  sites: Site[]
}

export type CreateSiteInput = {
  name: string
  discovery_enabled?: boolean
}

export type UpdateSiteInput = {
  name?: string
  discovery_enabled?: boolean
}

export type HostCredentialSummary = {
  id: string
  name: string
  type: "password" | "ssh_key"
  username: string
}

export type Host = {
  id: string
  site_id: string
  name: string
  hostname: string
  address?: string
  subject?: string
  agent_fingerprint?: string
  os?: string
  ips?: string[]
  remote_addr?: string
  online: boolean
  agent_online: boolean
  connected_at?: string
  last_seen?: string
  last_probe_at?: string
  probe_method: "icmp" | "tcp"
  probe_port: number
  cpu_cores?: number
  memory_bytes?: number
  credential_id?: string
  credential?: HostCredentialSummary
  created_at: string
  updated_at: string
}

export type HostListResponse = {
  hosts: Host[]
}

export type CreateHostInput = {
  site_id: string
  name?: string
  hostname?: string
  address?: string
  os?: string
  credential_id?: string
  probe_method?: "icmp" | "tcp"
  probe_port?: number
}

export type UpdateHostInput = {
  site_id?: string
  name?: string
  hostname?: string
  address?: string
  os?: string
  credential_id?: string
  probe_method?: "icmp" | "tcp"
  probe_port?: number
}

export type BecomeMethod = "none" | "sudo" | "su"

export type Credential = {
  id: string
  name: string
  type: "password" | "ssh_key"
  username: string
  public_key?: string
  has_passphrase: boolean
  become_method: BecomeMethod
  become_user?: string
  has_become_secret: boolean
  created_at: string
  updated_at: string
}

export type CredentialListResponse = {
  credentials: Credential[]
}

export type CreateCredentialInput = {
  name: string
  type: "password" | "ssh_key"
  username: string
  password?: string
  private_key?: string
  passphrase?: string
  become_method?: BecomeMethod
  become_user?: string
  become_secret?: string
}

export type UpdateCredentialInput = {
  name?: string
  username?: string
  password?: string
  private_key?: string
  passphrase?: string | null
  become_method?: BecomeMethod
  become_user?: string
  become_secret?: string | null
}

export type GeneratedSSHKey = {
  private_key: string
  public_key: string
}

export type DiscoveryNetwork = {
  iface: string
  cidr: string
  address: string
}

export type DiscoveryStatus = {
  enabled: boolean
  networks: DiscoveryNetwork[]
}

export type DiscoveryCandidate = {
  ip: string
  hostname?: string
  rtt_ms?: number
  open_ports?: number[]
  methods?: string[]
  already_known: boolean
}

export type DiscoveryScanResult = {
  cidr: string
  candidates: DiscoveryCandidate[]
}

function apiBase(): string {
  return apiUrl().replace(/\/$/, "")
}

async function readError(response: Response, fallback: string): Promise<string> {
  const body = await response.text()
  if (!body) {
    return `${fallback}: ${response.status}`
  }
  try {
    const parsed = JSON.parse(body) as { error?: string }
    if (parsed.error) {
      return parsed.error
    }
  } catch {
    // use raw body
  }
  return body
}

/**
 * Authenticated API fetch: refreshes access token when near expiry,
 * retries once on 401 after refresh, then redirects to SSO if still unauthorized.
 */
async function apiFetch(path: string, init: RequestInit = {}, retried = false): Promise<Response> {
  let accessToken: string
  try {
    accessToken = await ensureAccessToken()
  } catch (err) {
    if (err instanceof SessionExpiredError) {
      await handleSessionExpired()
    }
    throw err
  }

  const headers = new Headers(init.headers)
  headers.set("Authorization", `Bearer ${accessToken}`)

  const response = await fetch(`${apiBase()}${path}`, { ...init, headers })

  if (response.status !== 401) {
    return response
  }

  if (retried) {
    await handleSessionExpired()
    throw new SessionExpiredError("Unauthorized after refresh")
  }

  try {
    await refreshAccessToken()
  } catch {
    await handleSessionExpired()
    throw new SessionExpiredError("Unauthorized")
  }

  return apiFetch(path, init, true)
}

export async function fetchSites(): Promise<SiteListResponse> {
  const response = await apiFetch("/api/site")
  if (!response.ok) {
    throw new Error(await readError(response, "Sites list failed"))
  }
  return JSON.parse(await response.text()) as SiteListResponse
}

export async function fetchSite(id: string): Promise<Site> {
  const response = await apiFetch(`/api/site/${encodeURIComponent(id)}`)
  if (!response.ok) {
    throw new Error(await readError(response, "Site get failed"))
  }
  return JSON.parse(await response.text()) as Site
}

export async function createSite(input: CreateSiteInput): Promise<Site> {
  const response = await apiFetch("/api/site", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    throw new Error(await readError(response, "Create site failed"))
  }
  return JSON.parse(await response.text()) as Site
}

export async function updateSite(id: string, input: UpdateSiteInput): Promise<Site> {
  const response = await apiFetch(`/api/site/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    throw new Error(await readError(response, "Update site failed"))
  }
  return JSON.parse(await response.text()) as Site
}

export async function deleteSite(id: string): Promise<void> {
  const response = await apiFetch(`/api/site/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
  if (!response.ok) {
    throw new Error(await readError(response, "Delete site failed"))
  }
}

export async function fetchInventory(siteId?: string): Promise<HostListResponse> {
  const query = siteId ? `?site_id=${encodeURIComponent(siteId)}` : ""
  const response = await apiFetch(`/api/inventory${query}`)
  if (!response.ok) {
    throw new Error(await readError(response, "Inventory list failed"))
  }
  return JSON.parse(await response.text()) as HostListResponse
}

export async function fetchHost(id: string): Promise<Host> {
  const response = await apiFetch(`/api/inventory/${encodeURIComponent(id)}`)
  if (!response.ok) {
    throw new Error(await readError(response, "Host get failed"))
  }
  return JSON.parse(await response.text()) as Host
}

export async function createHost(input: CreateHostInput): Promise<Host> {
  const response = await apiFetch("/api/inventory", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    throw new Error(await readError(response, "Create host failed"))
  }
  return JSON.parse(await response.text()) as Host
}

export async function updateHost(id: string, input: UpdateHostInput): Promise<Host> {
  const response = await apiFetch(`/api/inventory/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    throw new Error(await readError(response, "Update host failed"))
  }
  return JSON.parse(await response.text()) as Host
}

export async function deleteHost(id: string): Promise<void> {
  const response = await apiFetch(`/api/inventory/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
  if (!response.ok) {
    throw new Error(await readError(response, "Delete host failed"))
  }
}

export async function fetchDiscoveryStatus(): Promise<DiscoveryStatus> {
  const response = await apiFetch("/api/discovery/status")
  if (!response.ok) {
    throw new Error(await readError(response, "Discovery status failed"))
  }
  return JSON.parse(await response.text()) as DiscoveryStatus
}

export async function scanDiscovery(cidr: string): Promise<DiscoveryScanResult> {
  const response = await apiFetch("/api/discovery/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cidr }),
  })
  if (!response.ok) {
    throw new Error(await readError(response, "Discovery scan failed"))
  }
  return JSON.parse(await response.text()) as DiscoveryScanResult
}

export async function fetchCredentials(): Promise<CredentialListResponse> {
  const response = await apiFetch("/api/credentials")
  if (!response.ok) {
    throw new Error(await readError(response, "Credentials list failed"))
  }
  return JSON.parse(await response.text()) as CredentialListResponse
}

export async function createCredential(input: CreateCredentialInput): Promise<Credential> {
  const response = await apiFetch("/api/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    throw new Error(await readError(response, "Create credential failed"))
  }
  return JSON.parse(await response.text()) as Credential
}

export async function updateCredential(id: string, input: UpdateCredentialInput): Promise<Credential> {
  const response = await apiFetch(`/api/credentials/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    throw new Error(await readError(response, "Update credential failed"))
  }
  return JSON.parse(await response.text()) as Credential
}

export async function deleteCredential(id: string): Promise<void> {
  const response = await apiFetch(`/api/credentials/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
  if (!response.ok) {
    throw new Error(await readError(response, "Delete credential failed"))
  }
}

export async function generateSSHKey(): Promise<GeneratedSSHKey> {
  const response = await apiFetch("/api/credentials/ssh-keygen", {
    method: "POST",
  })
  if (!response.ok) {
    throw new Error(await readError(response, "SSH key generation failed"))
  }
  return JSON.parse(await response.text()) as GeneratedSSHKey
}

export type TerminalMode = "auto" | "agent" | "ssh"
export type TerminalPath = "agent" | "ssh"

export type TerminalTicket = {
  ticket: string
  expires_in: number
  path: TerminalPath
}

export async function createTerminalTicket(input: {
  hostId: string
  cols: number
  rows: number
  mode?: TerminalMode
}): Promise<TerminalTicket> {
  const response = await apiFetch("/api/terminal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      host_id: input.hostId,
      cols: input.cols,
      rows: input.rows,
      mode: input.mode ?? "auto",
    }),
  })
  if (!response.ok) {
    throw new Error(await readError(response, "Terminal ticket failed"))
  }
  return JSON.parse(await response.text()) as TerminalTicket
}

export function terminalWebSocketURL(ticket: string): string {
  const httpBase = apiBase()
  const wsBase = httpBase.replace(/^http/i, (scheme) =>
    scheme.toLowerCase() === "https" ? "wss" : "ws",
  )
  return `${wsBase}/api/terminal/ws?ticket=${encodeURIComponent(ticket)}`
}
