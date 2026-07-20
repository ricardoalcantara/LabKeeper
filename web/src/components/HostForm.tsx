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
    return <p>Loading host…</p>
  }

  return (
    <form className="credential-form" onSubmit={(event) => void handleSubmit(event)}>
      <h2>{editing ? "Edit host" : "Add host"}</h2>
      <p className="sub form-hint">
        Pre-enroll a Host with an address and vault credential for future SSH. Agents attach later
        by certificate fingerprint.
      </p>

      <label>
        Name (optional label)
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. nas — leave empty to use hostname"
        />
      </label>

      <label>
        Hostname
        <input
          value={hostname}
          onChange={(event) => setHostname(event.target.value)}
          placeholder={editing ? "Reported by Agent when connected" : "optional"}
        />
      </label>

      <label>
        Address (SSH / reachability)
        <input
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          placeholder="192.168.1.10 or host.lab"
        />
      </label>

      <label>
        OS
        <input value={os} onChange={(event) => setOs(event.target.value)} placeholder="linux/amd64" />
      </label>

      <label>
        Credential
        <select value={credentialId} onChange={(event) => setCredentialId(event.target.value)}>
          <option value="">None</option>
          {credentials.map((credential) => (
            <option key={credential.id} value={credential.id}>
              {credential.name} ({credential.type} · {credential.username})
            </option>
          ))}
        </select>
      </label>

      {editing && loadedHost ? (
        <p className="sub">
          Status: {loadedHost.online ? "online" : "offline"}
          {loadedHost.cpu_cores != null ? ` · CPU ${loadedHost.cpu_cores}` : ""}
          {loadedHost.memory_bytes != null ? ` · RAM ${formatMemory(loadedHost.memory_bytes)}` : ""}
          {loadedHost.agent_fingerprint
            ? ` · agent ${loadedHost.agent_fingerprint.slice(0, 12)}…`
            : " · no agent yet"}
        </p>
      ) : null}

      {error ? <p className="error">{error}</p> : null}

      <div className="header-actions">
        <button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" className="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  )
}
