import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { AppHeader } from "../components/AppHeader"
import { CredentialForm } from "../components/CredentialForm"
import { CredentialList } from "../components/CredentialList"
import { UserSummary } from "../components/UserSummary"
import type { Credential } from "../lib/api"
import { isAuthenticated, loadSession, logout, startLogin } from "../lib/oidc"

export function CredentialsPage() {
  const [mode, setMode] = useState<"list" | "create" | "edit">("list")
  const [editing, setEditing] = useState<Credential | null>(null)
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
  const accessToken = session.tokens!.access_token

  return (
    <main className="card wide">
      <AppHeader
        title="LabKeeper Admin"
        subtitle="Credentials"
        actions={
          <>
            <Link className="link-button secondary" to="/">
              Inventory
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

      {mode === "list" ? (
        <CredentialList
          accessToken={accessToken}
          refreshKey={refreshKey}
          onCreate={() => {
            setEditing(null)
            setMode("create")
          }}
          onEdit={(credential) => {
            setEditing(credential)
            setMode("edit")
          }}
        />
      ) : (
        <CredentialForm
          accessToken={accessToken}
          credential={mode === "edit" ? editing : null}
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
    </main>
  )
}
