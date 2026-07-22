import { useEffect, useState } from "react"
import { KeyRound, Pencil, Plus, Trash2 } from "lucide-react"
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
    return <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading credentials…</p>
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          <KeyRound className="h-4 w-4 opacity-70" strokeWidth={1.75} />
          Stored credentials
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover dark:bg-neutral-200 dark:text-neutral-900 dark:hover:bg-white"
            onClick={onGenerateSSH}
          >
            <KeyRound className="h-3.5 w-3.5" strokeWidth={1.75} />
            Generate SSH key
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
            onClick={onCreate}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            Add credential
          </button>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      {credentials.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No credentials yet. Generate an SSH key for LabKeeper to hold, or add a password / existing
          key.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-700 text-left text-zinc-600 dark:text-zinc-400">
                <th className="px-2 py-2 font-semibold">Name</th>
                <th className="px-2 py-2 font-semibold">Type</th>
                <th className="px-2 py-2 font-semibold">Username</th>
                <th className="px-2 py-2 font-semibold">Become</th>
                <th className="px-2 py-2 font-semibold">Flags</th>
                <th className="px-2 py-2 font-semibold">Public key</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {credentials.map((credential) => (
                <tr key={credential.id} className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="px-2 py-2">{credential.name}</td>
                  <td className="px-2 py-2">{credential.type === "ssh_key" ? "SSH key" : "Password"}</td>
                  <td className="px-2 py-2">{credential.username}</td>
                  <td className="px-2 py-2">
                    {credential.become_method === "none"
                      ? "—"
                      : `${credential.become_method} → ${credential.become_user || "root"}`}
                  </td>
                  <td className="px-2 py-2 text-zinc-600 dark:text-zinc-400">
                    {[
                      credential.has_passphrase ? "passphrase" : null,
                      credential.has_become_secret ? "become secret" : null,
                    ]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </td>
                  <td className="max-w-[12rem] truncate px-2 py-2 font-mono text-xs">
                    {credential.public_key ? credential.public_key.slice(0, 48) + "…" : "—"}
                  </td>
                  <td className="space-x-1 whitespace-nowrap px-2 py-2 text-right">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                      onClick={() => onEdit(credential)}
                    >
                      <Pencil className="h-3 w-3" strokeWidth={1.75} />
                      Edit
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                      onClick={() => void handleDelete(credential)}
                    >
                      <Trash2 className="h-3 w-3" strokeWidth={1.75} />
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
