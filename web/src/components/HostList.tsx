import { useEffect, useState } from "react"
import { fetchInventoryHosts, type Host } from "../lib/api"
import { SessionExpiredError } from "../lib/oidc"

export function HostList() {
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
  }, [])

  if (loading) {
    return <p>Loading inventory…</p>
  }

  if (error) {
    return <p className="error">{error}</p>
  }

  if (hosts.length === 0) {
    return (
      <p className="sub">
        No hosts yet. Start an Agent (`go run ./cmd/agent`) so it can heartbeat into Inventory.
      </p>
    )
  }

  return (
    <table className="host-table">
      <thead>
        <tr>
          <th>Status</th>
          <th>Hostname</th>
          <th>OS</th>
          <th>IPs</th>
          <th>Last seen</th>
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
            <td>{host.hostname || host.subject || host.id.slice(0, 12)}</td>
            <td>{host.os || "—"}</td>
            <td>{host.ips?.join(", ") || "—"}</td>
            <td>{new Date(host.last_seen).toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
