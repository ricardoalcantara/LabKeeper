import { useState } from "react"
import { LoginButton } from "../components/LoginButton"
import { clientId, issuer, loginLabel, redirectUri } from "../lib/config"
import { isAuthenticated } from "../lib/oidc"

export function LoginPage() {
  const [error, setError] = useState<string | null>(null)

  return (
    <main className="card">
      <h1>LabKeeper Admin</h1>
      <p className="sub">Sign in to manage your Inventory.</p>

      <dl className="config">
        <dt>Issuer</dt>
        <dd>{issuer()}</dd>
        <dt>Client ID</dt>
        <dd>{clientId()}</dd>
        <dt>Redirect URI</dt>
        <dd>{redirectUri()}</dd>
      </dl>

      {error ? <p className="error">{error}</p> : null}

      {isAuthenticated() ? (
        <>
          <p>You are already signed in.</p>
          <a className="link-button" href="/">
            Go to home
          </a>
        </>
      ) : (
        <LoginButton label={loginLabel()} onError={setError} />
      )}
    </main>
  )
}
