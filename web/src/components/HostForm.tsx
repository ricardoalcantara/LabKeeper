import { useEffect, useState, type FormEvent } from "react"
import {
  createHost,
  fetchCredentials,
  fetchHost,
  updateHost,
  type CreateHostInput,
  type Credential,
  type Host,
} from "../lib/api"
import { SessionExpiredError } from "../lib/oidc"

type Props = {
  siteId: string
  host?: Host | null
  hostId?: string | null
  onCancel: () => void
  onSaved: () => void
}

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-normal text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"

function formatMemory(bytes?: number): string {
  if (bytes == null || bytes <= 0) {
    return ""
  }
  const gib = bytes / (1024 * 1024 * 1024)
  if (gib >= 1) {
    return `${gib.toFixed(1)} GiB`
  }
  const mib = bytes / (1024 * 1024)
  return `${mib.toFixed(0)} MiB`
}

export function HostForm({ siteId, host, hostId, onCancel, onSaved }: Props) {
  const editing = Boolean(host || hostId)
  const [loadedHost, setLoadedHost] = useState<Host | null>(host ?? null)
  const [name, setName] = useState(host?.name ?? "")
  const [hostname, setHostname] = useState(host?.hostname ?? "")
  const [address, setAddress] = useState(host?.address ?? "")
  const [os, setOs] = useState(host?.os ?? "")
  const [credentialId, setCredentialId] = useState(host?.credential_id ?? "")
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(Boolean(hostId && !host))

  useEffect(() => {
    if (host) {
      setLoadedHost(host)
      setName(host.name ?? "")
      setHostname(host.hostname ?? "")
      setAddress(host.address ?? "")
      setOs(host.os ?? "")
      setCredentialId(host.credential_id ?? "")
      setLoading(false)
      return
    }
    if (!hostId) {
      setLoadedHost(null)
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const row = await fetchHost(hostId)
        if (!cancelled) {
          setLoadedHost(row)
          setName(row.name ?? "")
          setHostname(row.hostname ?? "")
          setAddress(row.address ?? "")
          setOs(row.os ?? "")
          setCredentialId(row.credential_id ?? "")
        }
      } catch (err) {
        if (cancelled || err instanceof SessionExpiredError) {
          return
        }
        setError(err instanceof Error ? err.message : "Failed to load host")
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [host, hostId])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const response = await fetchCredentials()
        if (!cancelled) {
          setCredentials(response.credentials)
        }
      } catch (err) {
        if (cancelled || err instanceof SessionExpiredError) {
          return
        }
        setError(err instanceof Error ? err.message : "Failed to load credentials")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const trimmedName = name.trim()
      const trimmedHostname = hostname.trim()
      const trimmedAddress = address.trim()
      if (!trimmedName && !trimmedHostname && !trimmedAddress) {
        setError("Provide a name, hostname, or address")
        setSaving(false)
        return
      }
      if (editing && loadedHost) {
        await updateHost(loadedHost.id, {
          name: trimmedName,
          hostname: trimmedHostname,
          address: trimmedAddress,
          os: os.trim(),
          credential_id: credentialId,
        })
      } else {
        const input: CreateHostInput = {
          site_id: siteId,
          name: trimmedName || undefined,
          hostname: trimmedHostname || undefined,
          address: trimmedAddress || undefined,
          os: os.trim() || undefined,
        }
        if (credentialId) {
          input.credential_id = credentialId
        }
        await createHost(input)
      }
      onSaved()
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        return
      }
      setError(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading host…</p>
  }

  return (
    <form className="max-w-lg space-y-4" onSubmit={(event) => void handleSubmit(event)}>
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{editing ? "Edit host" : "Add host"}</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Pre-enroll a Host with an address and vault credential for future SSH. Agents attach later
          by certificate fingerprint.
        </p>
      </div>

      <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
        Name (optional label)
        <input
          className={inputClass}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. nas — leave empty to use hostname"
        />
      </label>

      <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
        Hostname
        <input
          className={inputClass}
          value={hostname}
          onChange={(event) => setHostname(event.target.value)}
          placeholder={editing ? "Reported by Agent when connected" : "optional"}
        />
      </label>

      <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
        Address (SSH / reachability)
        <input
          className={inputClass}
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          placeholder="192.168.1.10 or host.lab"
        />
      </label>

      <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
        OS
        <input
          className={inputClass}
          value={os}
          onChange={(event) => setOs(event.target.value)}
          placeholder="linux/amd64"
        />
      </label>

      <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
        Credential
        <select
          className={inputClass}
          value={credentialId}
          onChange={(event) => setCredentialId(event.target.value)}
        >
          <option value="">None</option>
          {credentials.map((credential) => (
            <option key={credential.id} value={credential.id}>
              {credential.name} ({credential.type} · {credential.username})
            </option>
          ))}
        </select>
      </label>

      {editing && loadedHost ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Status: {loadedHost.online ? "online" : "offline"}
          {loadedHost.cpu_cores != null ? ` · CPU ${loadedHost.cpu_cores}` : ""}
          {loadedHost.memory_bytes != null ? ` · RAM ${formatMemory(loadedHost.memory_bytes)}` : ""}
          {loadedHost.agent_fingerprint
            ? ` · agent ${loadedHost.agent_fingerprint.slice(0, 12)}…`
            : " · no agent yet"}
        </p>
      ) : null}

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover dark:bg-neutral-200 dark:text-neutral-900 dark:hover:bg-white disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
