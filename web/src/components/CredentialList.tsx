import { useEffect, useState } from "react"
import {
  deleteCredential,
  fetchCredentials,
  type Credential,
} from "../lib/api"

type Props = {
  accessToken: string
  onEdit: (credential: Credential) => void
  onCreate: () => void
  refreshKey: number
}

export function CredentialList({ accessToken, onEdit, onCreate, refreshKey }: Props) {
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      setLoading(true)
      try {
        const response = await fetchCredentials(accessToken)
        if (!cancelled) {
          setCredentials(response.credentials)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load credentials")
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [accessToken, refreshKey])

  const handleDelete = async (credential: Credential) => {
    if (!window.confirm(`Delete credential “${credential.name}”?`)) {
      return
    }
    try {
      await deleteCredential(accessToken, credential.id)
      setCredentials((current) => current.filter((item) => item.id !== credential.id))
    } catch (err) {
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
        <button type="button" onClick={onCreate}>
          Add credential
        </button>
      </div>

      {error ? <p className="error">{error}</p> : null}

      {credentials.length === 0 ? (
        <p className="sub">No credentials yet. Add a password or SSH key for future Host access.</p>
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
