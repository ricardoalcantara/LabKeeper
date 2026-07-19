import { useEffect, useState } from "react"
import {
  deleteCredential,
  fetchCredentials,
  type Credential,
} from "../lib/api"
import { SessionExpiredError } from "../lib/oidc"

type Props = {
  onEdit: (credential: Credential) => void
  onCreate: () => void
  onGenerateSSH: () => void
  refreshKey: number
}

export function CredentialList({ onEdit, onCreate, onGenerateSSH, refreshKey }: Props) {
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      setLoading(true)
      try {
        const response = await fetchCredentials()
        if (!cancelled) {
          setCredentials(response.credentials)
          setError(null)
        }
      } catch (err) {
        if (cancelled || err instanceof SessionExpiredError) {
          return
        }
        setError(err instanceof Error ? err.message : "Failed to load credentials")
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [refreshKey])

  const handleDelete = async (credential: Credential) => {
    if (!window.confirm(`Delete credential “${credential.name}”?`)) {
      return
    }
    try {
      await deleteCredential(credential.id)
      setCredentials((current) => current.filter((item) => item.id !== credential.id))
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        return
      }
      setError(err instanceof Error ? err.message : "Delete failed")
    }
  }

  if (loading) {
    return <p>Loading credentials…</p>
  }

  return (
    <section>
      <div className="section-toolbar">
        <h2>Stored credentials</h2>
        <div className="header-actions">
          <button type="button" onClick={onGenerateSSH}>
            Generate SSH key
          </button>
          <button type="button" className="secondary" onClick={onCreate}>
            Add credential
          </button>
        </div>
      </div>

      {error ? <p className="error">{error}</p> : null}

      {credentials.length === 0 ? (
        <p className="sub">
          No credentials yet. Generate an SSH key for LabKeeper to hold, or add a password / existing
          key.
        </p>
      ) : (
        <table className="host-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Username</th>
              <th>Public key</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {credentials.map((credential) => (
              <tr key={credential.id}>
                <td>{credential.name}</td>
                <td>{credential.type === "ssh_key" ? "SSH key" : "Password"}</td>
                <td>{credential.username}</td>
                <td className="mono-cell">
                  {credential.public_key ? credential.public_key.slice(0, 48) + "…" : "—"}
                </td>
                <td className="row-actions">
                  <button type="button" className="secondary" onClick={() => onEdit(credential)}>
                    Edit
                  </button>
                  <button type="button" className="secondary" onClick={() => void handleDelete(credential)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
