import { apiUrl } from "./config"

export type PingResponse = {
  status: string
  message: string
  time: string
  subject?: string
  name?: string
  roles?: string[]
  claims?: Record<string, unknown>
}

export async function fetchPing(accessToken: string): Promise<PingResponse> {
  const response = await fetch(`${apiUrl().replace(/\/$/, "")}/api/ping`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  const body = await response.text()
  if (!response.ok) {
    throw new Error(body || `API ping failed: ${response.status}`)
  }

  return JSON.parse(body) as PingResponse
}
