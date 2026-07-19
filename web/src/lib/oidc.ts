import { sha256 } from "./sha256"
import { clientId, issuer, postLogoutRedirectUri, redirectUri } from "./config"

const STORAGE_KEY = "labkeeper_portal"
/** Refresh a minute before access token exp to avoid mid-request 401s. */
const EXPIRY_SKEW_MS = 60_000

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
  /** Epoch ms when access_token expires (set client-side). */
  expires_at?: number
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

export class SessionExpiredError extends Error {
  constructor(message = "Session expired") {
    super(message)
    this.name = "SessionExpiredError"
  }
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

/** Prefer client expires_at; fall back to JWT exp for older sessions. */
export function accessTokenExpiresAt(tokens: TokenSet): number | null {
  if (typeof tokens.expires_at === "number" && tokens.expires_at > 0) {
    return tokens.expires_at
  }
  const exp = readJwtExpMs(tokens.access_token)
  if (exp != null) {
    return exp
  }
  return null
}

function readJwtExpMs(accessToken: string): number | null {
  try {
    const parts = accessToken.split(".")
    if (parts.length < 2) {
      return null
    }
    const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
    const payload = JSON.parse(json) as { exp?: number }
    if (typeof payload.exp === "number") {
      return payload.exp * 1000
    }
  } catch {
    // ignore malformed token
  }
  return null
}

export function isAccessTokenFresh(skewMs = EXPIRY_SKEW_MS): boolean {
  const tokens = loadSession().tokens
  if (!tokens?.access_token) {
    return false
  }
  const expiresAt = accessTokenExpiresAt(tokens)
  if (expiresAt == null) {
    // Unknown expiry — allow until API returns 401.
    return true
  }
  return Date.now() < expiresAt - skewMs
}

export function isAuthenticated(): boolean {
  const tokens = loadSession().tokens
  if (!tokens?.access_token) {
    return false
  }
  if (isAccessTokenFresh()) {
    return true
  }
  // Stale access token is OK if we can refresh silently.
  return Boolean(tokens.refresh_token)
}

function stampExpiry(tokens: TokenSet): TokenSet {
  const expiresIn = tokens.expires_in > 0 ? tokens.expires_in : 3600
  return {
    ...tokens,
    expires_in: expiresIn,
    expires_at: Date.now() + expiresIn * 1000,
  }
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

// The auth code is single-use; React StrictMode mounts effects twice in dev,
// so concurrent calls for the same code must share one exchange.
const pendingExchanges = new Map<string, Promise<SessionData>>()

export function handleCallback(search: string): Promise<SessionData> {
  const code = new URLSearchParams(search).get("code") ?? search
  let exchange = pendingExchanges.get(code)
  if (!exchange) {
    exchange = doHandleCallback(search)
    pendingExchanges.set(code, exchange)
  }
  return exchange
}

async function doHandleCallback(search: string): Promise<SessionData> {
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

  const tokens = stampExpiry((await res.json()) as TokenSet)
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

let refreshInFlight: Promise<TokenSet> | null = null

/**
 * Exchange refresh_token for a new access_token (min-idp rotates refresh tokens).
 * Concurrent callers share one in-flight refresh.
 */
export async function refreshAccessToken(): Promise<TokenSet> {
  if (refreshInFlight) {
    return refreshInFlight
  }
  refreshInFlight = doRefreshAccessToken().finally(() => {
    refreshInFlight = null
  })
  return refreshInFlight
}

async function doRefreshAccessToken(): Promise<TokenSet> {
  const session = loadSession()
  const refreshToken = session.tokens?.refresh_token
  if (!refreshToken) {
    throw new SessionExpiredError("No refresh token")
  }

  const doc = await discover()
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId(),
    refresh_token: refreshToken,
  })

  const res = await fetch(doc.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })

  if (!res.ok) {
    clearSession()
    throw new SessionExpiredError(`Refresh failed: ${res.status}`)
  }

  const next = stampExpiry((await res.json()) as TokenSet)
  // Keep prior refresh_token only if IdP omitted a new one (min-idp returns a new one).
  const tokens: TokenSet = {
    ...session.tokens,
    ...next,
    refresh_token: next.refresh_token || session.tokens?.refresh_token,
  }
  saveSession({ ...session, tokens })
  return tokens
}

/** Return a usable access token, refreshing silently when near expiry. */
export async function ensureAccessToken(): Promise<string> {
  const session = loadSession()
  if (!session.tokens?.access_token) {
    throw new SessionExpiredError("Not signed in")
  }
  if (isAccessTokenFresh()) {
    return session.tokens.access_token
  }
  if (!session.tokens.refresh_token) {
    clearSession()
    throw new SessionExpiredError("Access token expired")
  }
  const tokens = await refreshAccessToken()
  return tokens.access_token
}

/**
 * Clear local session and start OIDC login again.
 * Used after refresh failure or unrecoverable API 401.
 */
export async function handleSessionExpired(): Promise<void> {
  clearSession()
  await startLogin()
}

export async function logout(): Promise<void> {
  const session = loadSession()
  clearSession()

  const doc = await discover()
  const logoutURL = new URL(doc.end_session_endpoint ?? `${issuer().replace(/\/$/, "")}/oauth2/logout`)
  logoutURL.searchParams.set("post_logout_redirect_uri", postLogoutRedirectUri())
  if (session.tokens?.id_token) {
    logoutURL.searchParams.set("id_token_hint", session.tokens.id_token)
  }

  window.location.href = logoutURL.toString()
}
