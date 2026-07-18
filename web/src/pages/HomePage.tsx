import { useEffect } from "react"
import { Link } from "react-router-dom"
import { AppHeader } from "../components/AppHeader"
import { HostList } from "../components/HostList"
import { UserSummary } from "../components/UserSummary"
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
  const userinfo = session.userinfo as
    | { name?: string; email?: string; preferred_username?: string; username?: string }
    | undefined

  return (
    <main className="card wide">
      <AppHeader
        title="LabKeeper Admin"
        subtitle="Inventory"
        actions={
          <>
            <Link className="link-button secondary" to="/credentials">
              Credentials
            </Link>
            <button type="button" className="secondary" onClick={() => void logout()}>
              Sign out
            </button>
          </>
        }
      />

      <UserSummary
        name={userinfo?.name}
        email={userinfo?.email}
        username={userinfo?.preferred_username || userinfo?.username}
      />

      <section className="inventory-section">
        <HostList accessToken={session.tokens!.access_token} />
      </section>
    </main>
  )
}
