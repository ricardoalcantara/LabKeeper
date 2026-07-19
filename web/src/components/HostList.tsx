import { useEffect, useState } from "react"
import { deleteHost, fetchInventoryHosts, type Host } from "../lib/api"
import { SessionExpiredError } from "../lib/oidc"

type Props = {
  onCreate: () => void
  onEdit: (host: Host) => void
  refreshKey: number
}

function formatMemory(bytes?: number): string {
  if (bytes == null) {
    return "—"
  }
  const gib = bytes / (1024 * 1024 * 1024)
  if (gib >= 1) {
    return `${gib.toFixed(1)} GiB`
  }
  const mib = bytes / (1024 * 1024)
  return `${mib.toFixed(0)} MiB`
}

function displayName(host: Host): string {
  return host.name || host.hostname || host.subject || host.id.slice(0, 12)
}

function showHostnameSub(host: Host): boolean {
  const label = host.name?.trim()
  const hn = host.hostname?.trim()
  return Boolean(label && hn && label !== hn)
}

export function HostList({ onCreate, onEdit, refreshKey }: Props) {
  const [hosts, setHosts] = useState<Host[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const response = await fetchInventoryHosts()
        if (!cancelled) {
          setHosts(response.hosts)
          setError(null)
        }
      } catch (err) {
        if (cancelled || err instanceof SessionExpiredError) {
          return
        }
        setError(err instanceof Error ? err.message : "Failed to load inventory")
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()
    const timer = window.setInterval(() => {
      void load()
    }, 5000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [refreshKey])

  const handleDelete = async (host: Host) => {
    if (!window.confirm(`Delete host “${displayName(host)}”?`)) {
      return
    }
    try {
      await deleteHost(host.id)
      setHosts((current) => current.filter((item) => item.id !== host.id))
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        return
      }
      setError(err instanceof Error ? err.message : "Delete failed")
    }
  }

  if (loading) {
    return <p>Loading inventory…</p>
  }

  return (
    <section>
      <div className="section-toolbar">
        <h2>Inventory hosts</h2>
        <button type="button" onClick={onCreate}>
          Add host
        </button>
      </div>

      {error ? <p className="error">{error}</p> : null}

      {hosts.length === 0 ? (
        <p className="sub">
          No hosts yet. Add one for future SSH, or start an Agent (`go run ./cmd/agent`) so it can
          register itself.
        </p>
      ) : (
        <table className="host-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Name</th>
              <th>Address</th>
              <th>OS</th>
              <th>CPU</th>
              <th>Memory</th>
              <th>Credential</th>
              <th>Last seen</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {hosts.map((host) => (
              <tr key={host.id}>
                <td>
                  <span className={host.online ? "status-online" : "status-offline"}>
                    {host.online ? "online" : "offline"}
                  </span>
                </td>
                <td>
                  {displayName(host)}
                  {showHostnameSub(host) ? <div className="sub">{host.hostname}</div> : null}
                </td>
                <td>{host.address || host.ips?.join(", ") || "—"}</td>
                <td>{host.os || "—"}</td>
                <td>{host.cpu_cores != null ? host.cpu_cores : "—"}</td>
                <td>{formatMemory(host.memory_bytes)}</td>
                <td>{host.credential?.name || "—"}</td>
                <td>{host.last_seen ? new Date(host.last_seen).toLocaleString() : "—"}</td>
                <td className="row-actions">
                  <button type="button" className="secondary" onClick={() => onEdit(host)}>
                    Edit
                  </button>
                  <button type="button" className="secondary" onClick={() => void handleDelete(host)}>
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
