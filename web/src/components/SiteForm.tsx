import { useState, type FormEvent } from "react"
import { createSite, updateSite, type Site } from "../lib/api"
import { SessionExpiredError } from "../lib/oidc"

type Props = {
  site?: Site | null
  onCancel: () => void
  onSaved: (site: Site) => void
}

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-normal text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"

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
      let saved: Site
      if (editing && site) {
        saved = await updateSite(site.id, {
          name: trimmedName,
          discovery_enabled: discoveryEnabled,
        })
      } else {
        saved = await createSite({
          name: trimmedName,
          discovery_enabled: discoveryEnabled,
        })
      }
      onSaved(saved)
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
    <form className="max-w-lg space-y-4" onSubmit={(event) => void handleSubmit(event)}>
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{editing ? "Edit site" : "Add site"}</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          A site groups Hosts by place or cloud account (e.g. Default, DigitalOcean, AWS).
        </p>
      </div>

      <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
        Name
        <input
          className={inputClass}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Default"
          required
        />
      </label>

      <label className="flex items-center gap-2 text-sm font-normal text-zinc-800 dark:text-zinc-200">
        <input
          type="checkbox"
          checked={discoveryEnabled}
          onChange={(event) => setDiscoveryEnabled(event.target.checked)}
        />
        Enable LAN discovery for this site
      </label>

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
