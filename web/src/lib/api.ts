import { apiUrl } from "./config"
import {
  ensureAccessToken,
  handleSessionExpired,
  refreshAccessToken,
  SessionExpiredError,
} from "./oidc"

export type HostCredentialSummary = {
  id: string
  name: string
  type: "password" | "ssh_key"
  username: string
}

export type Host = {
  id: string
  name: string
  hostname: string
  address?: string
  subject?: string
  agent_fingerprint?: string
  os?: string
  ips?: string[]
  remote_addr?: string
  online: boolean
  connected_at?: string
  last_seen?: string
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
  name?: string
  hostname?: string
  address?: string
  os?: string
  credential_id?: string
}

export type UpdateHostInput = {
  name?: string
  hostname?: string
  address?: string
  os?: string
  credential_id?: string
}

export type Credential = {
  id: string
  name: string
  type: "password" | "ssh_key"
  username: string
  public_key?: string
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
}

export type UpdateCredentialInput = {
  name?: string
  username?: string
  password?: string
  private_key?: string
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

export async function fetchInventoryHosts(): Promise<HostListResponse> {
  const response = await apiFetch("/api/inventory/hosts")
  if (!response.ok) {
    throw new Error(await readError(response, "Inventory hosts failed"))
  }
  return JSON.parse(await response.text()) as HostListResponse
}

export async function fetchHost(id: string): Promise<Host> {
  const response = await apiFetch(`/api/inventory/hosts/${encodeURIComponent(id)}`)
  if (!response.ok) {
    throw new Error(await readError(response, "Host get failed"))
  }
  return JSON.parse(await response.text()) as Host
}

export async function createHost(input: CreateHostInput): Promise<Host> {
  const response = await apiFetch("/api/inventory/hosts", {
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
  const response = await apiFetch(`/api/inventory/hosts/${encodeURIComponent(id)}`, {
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
  const response = await apiFetch(`/api/inventory/hosts/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
  if (!response.ok) {
    throw new Error(await readError(response, "Delete host failed"))
  }
}

export async function fetchDiscoveryStatus(): Promise<DiscoveryStatus> {
  const response = await apiFetch("/api/inventory/discovery/status")
  if (!response.ok) {
    throw new Error(await readError(response, "Discovery status failed"))
  }
  return JSON.parse(await response.text()) as DiscoveryStatus
}

export async function scanDiscovery(cidr: string): Promise<DiscoveryScanResult> {
  const response = await apiFetch("/api/inventory/discovery/scan", {
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
