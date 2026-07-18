const DEFAULT_ISSUER = "http://min-idp:8081"
const DEFAULT_CLIENT_ID = "default"
const DEFAULT_REDIRECT_URI = "http://labkeeper:5173/callback"
const DEFAULT_POST_LOGOUT_REDIRECT_URI = "http://labkeeper:5173/login"
const DEFAULT_LOGIN_LABEL = "Login with SSO"
const DEFAULT_API_URL = "http://labkeeper:8080"

export function issuer(): string {
  return import.meta.env.VITE_OIDC_ISSUER ?? DEFAULT_ISSUER
}

export function clientId(): string {
  return import.meta.env.VITE_OIDC_CLIENT_ID ?? DEFAULT_CLIENT_ID
}

export function redirectUri(): string {
  return import.meta.env.VITE_OIDC_REDIRECT_URI ?? DEFAULT_REDIRECT_URI
}

export function postLogoutRedirectUri(): string {
  const configured = import.meta.env.VITE_OIDC_POST_LOGOUT_REDIRECT_URI
  if (configured) {
    return configured
  }
  const callback = redirectUri()
  if (callback.endsWith("/callback")) {
    return `${callback.slice(0, -"/callback".length)}/login`
  }
  return DEFAULT_POST_LOGOUT_REDIRECT_URI
}

export function loginLabel(): string {
  return import.meta.env.VITE_OIDC_LOGIN_LABEL ?? DEFAULT_LOGIN_LABEL
}

export function apiUrl(): string {
  return import.meta.env.VITE_API_URL ?? DEFAULT_API_URL
}
