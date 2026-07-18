const DEFAULT_ISSUER = "http://192.168.1.107:8081"
const DEFAULT_CLIENT_ID = "default"
const DEFAULT_REDIRECT_URI = "http://192.168.1.107:5173/callback"
const DEFAULT_LOGIN_LABEL = "Login with SSO"
const DEFAULT_API_URL = "http://192.168.1.107:8080"

export function issuer(): string {
  return import.meta.env.VITE_OIDC_ISSUER ?? DEFAULT_ISSUER
}

export function clientId(): string {
  return import.meta.env.VITE_OIDC_CLIENT_ID ?? DEFAULT_CLIENT_ID
}

export function redirectUri(): string {
  return import.meta.env.VITE_OIDC_REDIRECT_URI ?? DEFAULT_REDIRECT_URI
}

export function loginLabel(): string {
  return import.meta.env.VITE_OIDC_LOGIN_LABEL ?? DEFAULT_LOGIN_LABEL
}

export function apiUrl(): string {
  return import.meta.env.VITE_API_URL ?? DEFAULT_API_URL
}
