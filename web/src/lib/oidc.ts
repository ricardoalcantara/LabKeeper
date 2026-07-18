import { sha256 } from "./sha256"
import { clientId, issuer, redirectUri } from "./config"

const STORAGE_KEY = "labkeeper_portal"

export type OIDCDiscovery = {
  issuer: string
  authorization_endpoint: string
  token_endpoint: string
  userinfo_endpoint: string
  end_session_endpoint?: string
}

export type TokenSet = {
  access_token: string
  id_token?: string
  refresh_token?: string
  token_type: string
  expires_in: number
}

export type UserInfo = {
  sub: string
  email?: string
  name?: string
  username?: string
  roles?: string[]
}

type PendingAuth = {
  codeVerifier: string
  state: string
  nonce: string
}

export type SessionData = {
  tokens?: TokenSet
  userinfo?: UserInfo
}

function randomString(bytes = 32): string {
  const buf = new Uint8Array(bytes)
  crypto.getRandomValues(buf)
  return base64UrlEncode(buf)
}

function base64UrlEncode(buf: Uint8Array): string {
  let str = ""
  for (const b of buf) {
    str += String.fromCharCode(b)
  }
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier)
  const digest = await sha256(data)
  return base64UrlEncode(digest)
}

let discoveryCache: OIDCDiscovery | null = null

export async function discover(): Promise<OIDCDiscovery> {
  if (discoveryCache) return discoveryCache
  const url = `${issuer().replace(/\/$/, "")}/.well-known/openid-configuration`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Discovery failed: ${res.status}`)
  }
  discoveryCache = await res.json()
  return discoveryCache!
}

function pendingKey(): string {
  return `${STORAGE_KEY}:pending`
}

function sessionKey(): string {
  return `${STORAGE_KEY}:session`
}

export function loadSession(): SessionData {
  const raw = sessionStorage.getItem(sessionKey())
  if (!raw) return {}
  try {
    return JSON.parse(raw) as SessionData
  } catch {
    return {}
  }
}

export function saveSession(data: SessionData): void {
  sessionStorage.setItem(sessionKey(), JSON.stringify(data))
}

export function clearSession(): void {
  sessionStorage.removeItem(sessionKey())
  sessionStorage.removeItem(pendingKey())
}

export function isAuthenticated(): boolean {
  return Boolean(loadSession().tokens?.access_token)
}

export async function startLogin(): Promise<void> {
  const doc = await discover()
  const codeVerifier = randomString(32)
  const codeChallenge = await pkceChallenge(codeVerifier)
  const state = randomString(16)
  const nonce = randomString(16)

  const pending: PendingAuth = { codeVerifier, state, nonce }
  sessionStorage.setItem(pendingKey(), JSON.stringify(pending))

  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "openid profile email",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    nonce,
  })

  window.location.href = `${doc.authorization_endpoint}?${params}`
}

export async function handleCallback(search: string): Promise<SessionData> {
  const params = new URLSearchParams(search)
  const error = params.get("error")
  if (error) {
    throw new Error(params.get("error_description") ?? error)
  }

  const code = params.get("code")
  const state = params.get("state")
  if (!code || !state) {
    throw new Error("Missing code or state")
  }

  const pendingRaw = sessionStorage.getItem(pendingKey())
  if (!pendingRaw) {
    throw new Error("Missing PKCE session — start login again")
  }
  const pending = JSON.parse(pendingRaw) as PendingAuth
  if (pending.state !== state) {
    throw new Error("State mismatch")
  }

  const doc = await discover()
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId(),
    code,
    redirect_uri: redirectUri(),
    code_verifier: pending.codeVerifier,
  })

  const res = await fetch(doc.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Token exchange failed: ${res.status} ${text}`)
  }

  const tokens = (await res.json()) as TokenSet
  sessionStorage.removeItem(pendingKey())

  let userinfo: UserInfo | undefined
  if (tokens.access_token) {
    const uiRes = await fetch(doc.userinfo_endpoint, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    if (uiRes.ok) {
      userinfo = await uiRes.json()
    }
  }

  const session: SessionData = { tokens, userinfo }
  saveSession(session)
  return session
}

export async function logout(): Promise<void> {
  const session = loadSession()
  clearSession()

  const doc = await discover()
  const logoutURL = new URL(doc.end_session_endpoint ?? `${issuer().replace(/\/$/, "")}/oauth2/logout`)
  const postLogoutRedirect = new URL("/login", window.location.origin).toString()
  logoutURL.searchParams.set("post_logout_redirect_uri", postLogoutRedirect)
  if (session.tokens?.id_token) {
    logoutURL.searchParams.set("id_token_hint", session.tokens.id_token)
  }

  window.location.href = logoutURL.toString()
}
