import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { AppHeader } from "../components/AppHeader"
import { HostForm } from "../components/HostForm"
import { HostList } from "../components/HostList"
import { UserSummary } from "../components/UserSummary"
import type { Host } from "../lib/api"
import { isAuthenticated, loadSession, logout, startLogin } from "../lib/oidc"

export function HomePage() {
  const [mode, setMode] = useState<"list" | "create" | "edit">("list")
  const [editing, setEditing] = useState<Host | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

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
        {mode === "list" ? (
          <HostList
            refreshKey={refreshKey}
            onCreate={() => {
              setEditing(null)
              setMode("create")
            }}
            onEdit={(host) => {
              setEditing(host)
              setMode("edit")
            }}
          />
        ) : (
          <HostForm
            host={mode === "edit" ? editing : null}
            onCancel={() => {
              setEditing(null)
              setMode("list")
            }}
            onSaved={() => {
              setEditing(null)
              setMode("list")
              setRefreshKey((value) => value + 1)
            }}
          />
        )}
      </section>
    </main>
  )
}
