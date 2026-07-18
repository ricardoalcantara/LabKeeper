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

export async function fetchInventoryHosts(accessToken: string): Promise<HostListResponse> {
  const response = await fetch(`${apiUrl().replace(/\/$/, "")}/api/inventory/hosts`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  const body = await response.text()
  if (!response.ok) {
    throw new Error(body || `Inventory hosts failed: ${response.status}`)
  }

  return JSON.parse(body) as HostListResponse
}
