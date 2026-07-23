import { useEffect, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Monitor, Pencil, Trash2 } from "lucide-react"
import { deleteHost, fetchHost, type Host } from "../lib/api"
import { useInventoryTree } from "../lib/inventoryTree"
import { SessionExpiredError } from "../lib/oidc"
import { HostForm } from "./HostForm"

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

function statusLabel(host: Host): string {
  if (host.online && host.agent_online) {
    return "online · Agent connected"
  }
  if (host.online) {
    return "reachable · Agent offline"
  }
  return "offline"
}

function statusClass(host: Host): string {
  if (host.online && host.agent_online) {
    return "font-medium text-status-online"
  }
  if (host.online) {
    return "font-medium text-status-reachable"
  }
  return "font-medium text-status-offline"
}

export function HostDetail() {
  const { hostId } = useParams<{ hostId: string }>()
  const navigate = useNavigate()
  const { bumpRefresh, refreshKey } = useInventoryTree()
  const [host, setHost] = useState<Host | null>(null)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const editingRef = useRef(editing)
  editingRef.current = editing

  useEffect(() => {
    if (!hostId) {
      return
    }
    let cancelled = false

    const load = async (showLoading: boolean) => {
      if (showLoading) {
        setLoading(true)
      }
      try {
        const row = await fetchHost(hostId)
        if (!cancelled) {
          setHost(row)
          setError(null)
          if (showLoading) {
            setEditing(false)
          }
        }
      } catch (err) {
        if (cancelled || err instanceof SessionExpiredError) {
          return
        }
        setError(err instanceof Error ? err.message : "Failed to load host")
      } finally {
        if (!cancelled && showLoading) {
          setLoading(false)
        }
      }
    }

    void load(true)
    const timer = window.setInterval(() => {
      if (!editingRef.current) {
        void load(false)
      }
    }, 5000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [hostId, refreshKey])

  const handleDelete = async () => {
    if (!host || !window.confirm(`Delete host “${displayName(host)}”?`)) {
      return
    }
    try {
      await deleteHost(host.id)
      bumpRefresh()
      navigate(host.site_id ? `/sites/${host.site_id}` : "/labkeeper")
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        return
      }
      setError(err instanceof Error ? err.message : "Delete failed")
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading host…</p>
  }

  if (!host) {
    return <p className="text-sm text-red-600 dark:text-red-400">{error || "Host not found"}</p>
  }

  if (editing) {
    return (
      <HostForm
        siteId={host.site_id}
        host={host}
        onCancel={() => setEditing(false)}
        onSaved={() => {
          bumpRefresh()
          setEditing(false)
        }}
      />
    )
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="inline-flex items-center gap-2 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            <Monitor className="h-5 w-5 opacity-70" strokeWidth={1.75} />
            {displayName(host)}
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Host · <span className={statusClass(host)}>{statusLabel(host)}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
            Edit
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950"
            onClick={() => void handleDelete()}
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
            Delete
          </button>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      <dl className="grid grid-cols-[10rem_1fr] gap-x-4 gap-y-2 rounded-lg border border-zinc-200 bg-zinc-100/80 p-4 text-sm dark:border-zinc-700 dark:bg-zinc-900/60">
        <dt className="font-medium text-zinc-600 dark:text-zinc-400">Hostname</dt>
        <dd>{host.hostname || "—"}</dd>
        <dt className="font-medium text-zinc-600 dark:text-zinc-400">Address</dt>
        <dd>{host.address || host.ips?.join(", ") || "—"}</dd>
        <dt className="font-medium text-zinc-600 dark:text-zinc-400">OS</dt>
        <dd>{host.os || "—"}</dd>
        <dt className="font-medium text-zinc-600 dark:text-zinc-400">CPU</dt>
        <dd>{host.cpu_cores != null ? host.cpu_cores : "—"}</dd>
        <dt className="font-medium text-zinc-600 dark:text-zinc-400">Memory</dt>
        <dd>{formatMemory(host.memory_bytes)}</dd>
        <dt className="font-medium text-zinc-600 dark:text-zinc-400">Credential</dt>
        <dd>{host.credential?.name || "—"}</dd>
        <dt className="font-medium text-zinc-600 dark:text-zinc-400">Last seen</dt>
        <dd>{host.last_seen ? new Date(host.last_seen).toLocaleString() : "—"}</dd>
        <dt className="font-medium text-zinc-600 dark:text-zinc-400">Probe</dt>
        <dd>
          {host.probe_method === "tcp" ? `TCP :${host.probe_port}` : "ICMP"}
          {host.last_probe_at
            ? ` · last ${new Date(host.last_probe_at).toLocaleString()}`
            : ""}
        </dd>
        <dt className="font-medium text-zinc-600 dark:text-zinc-400">Agent</dt>
        <dd className="font-mono text-xs">
          {host.agent_online
            ? "connected"
            : host.agent_fingerprint
              ? "offline"
              : "none"}
          {host.agent_fingerprint ? ` · ${host.agent_fingerprint.slice(0, 16)}…` : ""}
        </dd>
        <dt className="font-medium text-zinc-600 dark:text-zinc-400">ID</dt>
        <dd className="font-mono text-xs text-zinc-700 dark:text-zinc-300">{host.id}</dd>
      </dl>
    </div>
  )
}
