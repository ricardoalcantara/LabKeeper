import { apiUrl } from "./config"

export type Host = {
  id: string
  subject: string
  hostname: string
  os?: string
  ips?: string[]
  remote_addr?: string
  online: boolean
  connected_at: string
  last_seen: string
}

export type HostListResponse = {
  hosts: Host[]
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

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` }
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

export async function fetchInventoryHosts(accessToken: string): Promise<HostListResponse> {
  const response = await fetch(`${apiBase()}/api/inventory/hosts`, {
    headers: authHeaders(accessToken),
  })

  if (!response.ok) {
    throw new Error(await readError(response, "Inventory hosts failed"))
  }

  return JSON.parse(await response.text()) as HostListResponse
}

export async function fetchCredentials(accessToken: string): Promise<CredentialListResponse> {
  const response = await fetch(`${apiBase()}/api/credentials`, {
    headers: authHeaders(accessToken),
  })
  if (!response.ok) {
    throw new Error(await readError(response, "Credentials list failed"))
  }
  return JSON.parse(await response.text()) as CredentialListResponse
}

export async function createCredential(
  accessToken: string,
  input: CreateCredentialInput,
): Promise<Credential> {
  const response = await fetch(`${apiBase()}/api/credentials`, {
    method: "POST",
    headers: {
      ...authHeaders(accessToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    throw new Error(await readError(response, "Create credential failed"))
  }
  return JSON.parse(await response.text()) as Credential
}

export async function updateCredential(
  accessToken: string,
  id: string,
  input: UpdateCredentialInput,
): Promise<Credential> {
  const response = await fetch(`${apiBase()}/api/credentials/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: {
      ...authHeaders(accessToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    throw new Error(await readError(response, "Update credential failed"))
  }
  return JSON.parse(await response.text()) as Credential
}

export async function deleteCredential(accessToken: string, id: string): Promise<void> {
  const response = await fetch(`${apiBase()}/api/credentials/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
  })
  if (!response.ok) {
    throw new Error(await readError(response, "Delete credential failed"))
  }
}
