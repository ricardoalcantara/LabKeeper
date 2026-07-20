import { useState, type FormEvent } from "react"
import { createSite, updateSite, type Site } from "../lib/api"
import { SessionExpiredError } from "../lib/oidc"

type Props = {
  site?: Site | null
  onCancel: () => void
  onSaved: () => void
}

export function SiteForm({ site, onCancel, onSaved }: Props) {
  const editing = Boolean(site)
  const [name, setName] = useState(site?.name ?? "")
  const [discoveryEnabled, setDiscoveryEnabled] = useState(site?.discovery_enabled ?? false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const trimmedName = name.trim()
      if (!trimmedName) {
        setError("Name is required")
        setSaving(false)
        return
      }
      if (editing && site) {
        await updateSite(site.id, {
          name: trimmedName,
          discovery_enabled: discoveryEnabled,
        })
      } else {
        await createSite({
          name: trimmedName,
          discovery_enabled: discoveryEnabled,
        })
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

  return (
    <form className="credential-form" onSubmit={(event) => void handleSubmit(event)}>
      <h2>{editing ? "Edit site" : "Add site"}</h2>
      <p className="sub form-hint">
        A site groups Hosts by place or cloud account (e.g. Default, DigitalOcean, AWS).
      </p>

      <label>
        Name
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Default"
          required
        />
      </label>

      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={discoveryEnabled}
          onChange={(event) => setDiscoveryEnabled(event.target.checked)}
        />
        Enable LAN discovery for this site
      </label>

      {error ? <p className="error">{error}</p> : null}

      <div className="header-actions">
        <button type="button" className="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  )
}
