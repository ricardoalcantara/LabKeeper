import { useEffect } from "react"
import { PingResult } from "../components/PingResult"
import { isAuthenticated, loadSession, logout, startLogin } from "../lib/oidc"

export function HomePage() {
  useEffect(() => {
    if (!isAuthenticated()) {
      void startLogin().catch((error) => {
        console.error("auto login redirect failed", error)
      })
    }
  }, [])

  if (!isAuthenticated()) {
    return (
      <main className="card">
        <p>Redirecting to sign in…</p>
      </main>
    )
  }

  const session = loadSession()

  return (
    <main className="card">
      <header className="page-header">
        <div>
          <h1>LabKeeper Portal</h1>
          <p className="sub">Authenticated home</p>
        </div>
        <button type="button" className="secondary" onClick={() => void logout()}>
          Sign out
        </button>
      </header>

      {session.userinfo ? (
        <section>
          <h2>Signed in as</h2>
          <pre>{JSON.stringify(session.userinfo, null, 2)}</pre>
        </section>
      ) : null}

      <PingResult accessToken={session.tokens!.access_token} />
    </main>
  )
}
