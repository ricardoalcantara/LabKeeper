import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { AppHeader } from "../components/AppHeader"
import { HostForm } from "../components/HostForm"
import { SiteForm } from "../components/SiteForm"
import { SiteList } from "../components/SiteList"
import { UserSummary } from "../components/UserSummary"
import { type Host, type Site } from "../lib/api"
import { isAuthenticated, loadSession, logout, startLogin } from "../lib/oidc"

type Mode = "list" | "createSite" | "editSite" | "createHost" | "editHost"

export function HomePage() {
  const [mode, setMode] = useState<Mode>("list")
  const [activeSite, setActiveSite] = useState<Site | null>(null)
  const [editingSite, setEditingSite] = useState<Site | null>(null)
  const [editingHost, setEditingHost] = useState<Host | null>(null)
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

  const backToList = () => {
    setMode("list")
    setActiveSite(null)
    setEditingSite(null)
    setEditingHost(null)
  }

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
          <SiteList
            refreshKey={refreshKey}
            onCreateSite={() => {
              setEditingSite(null)
              setMode("createSite")
            }}
            onEditSite={(site) => {
              setEditingSite(site)
              setMode("editSite")
            }}
            onCreateHost={(site) => {
              setActiveSite(site)
              setEditingHost(null)
              setMode("createHost")
            }}
            onEditHost={(site, host) => {
              setActiveSite(site)
              setEditingHost(host)
              setMode("editHost")
            }}
            onHostsChanged={() => {
              setRefreshKey((value) => value + 1)
            }}
          />
        ) : null}

        {mode === "createSite" || mode === "editSite" ? (
          <SiteForm
            site={mode === "editSite" ? editingSite : null}
            onCancel={backToList}
            onSaved={() => {
              backToList()
              setRefreshKey((value) => value + 1)
            }}
          />
        ) : null}

        {mode === "createHost" && activeSite ? (
          <HostForm
            siteId={activeSite.id}
            onCancel={backToList}
            onSaved={() => {
              backToList()
              setRefreshKey((value) => value + 1)
            }}
          />
        ) : null}

        {mode === "editHost" && activeSite && editingHost ? (
          <HostForm
            siteId={activeSite.id}
            host={editingHost}
            onCancel={backToList}
            onSaved={() => {
              backToList()
              setRefreshKey((value) => value + 1)
            }}
          />
        ) : null}
      </section>
    </main>
  )
}
