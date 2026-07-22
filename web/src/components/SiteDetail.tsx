import { useEffect, useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { MapPin, Pencil, Plus, Radar, Trash2 } from "lucide-react"
import {
  deleteSite,
  fetchInventory,
  fetchSite,
  type Site,
} from "../lib/api"
import { useInventoryTree } from "../lib/inventoryTree"
import { SessionExpiredError } from "../lib/oidc"
import { DiscoveryPanel } from "./DiscoveryPanel"
import { HostForm } from "./HostForm"
import { SiteForm } from "./SiteForm"

type Mode = "view" | "edit" | "createHost" | "discover"

export function SiteDetail() {
  const { siteId } = useParams<{ siteId: string }>()
  const navigate = useNavigate()
  const { bumpRefresh, refreshKey } = useInventoryTree()
  const isNew = siteId === "new"
  const loadedSiteIdRef = useRef<string | null>(null)

  const [site, setSite] = useState<Site | null>(null)
  const [hostCount, setHostCount] = useState(0)
  const [mode, setMode] = useState<Mode>(isNew ? "edit" : "view")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(!isNew)

  useEffect(() => {
    if (isNew || !siteId) {
      setSite(null)
      setMode("edit")
      setLoading(false)
      loadedSiteIdRef.current = null
      return
    }

    let cancelled = false
    const siteChanged = loadedSiteIdRef.current !== siteId
    if (siteChanged) {
      setMode("view")
      setLoading(true)
    }

    ;(async () => {
      try {
        const [row, inventory] = await Promise.all([
          fetchSite(siteId),
          fetchInventory(siteId),
        ])
        if (!cancelled) {
          setSite(row)
          setHostCount(inventory.hosts.length)
          setError(null)
          loadedSiteIdRef.current = siteId
        }
      } catch (err) {
        if (cancelled || err instanceof SessionExpiredError) {
          return
        }
        setError(err instanceof Error ? err.message : "Failed to load site")
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [siteId, isNew, refreshKey])

  const handleDelete = async () => {
    if (!site || !window.confirm(`Delete site “${site.name}”?`)) {
      return
    }
    try {
      await deleteSite(site.id)
      bumpRefresh()
      navigate("/labkeeper")
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        return
      }
      setError(err instanceof Error ? err.message : "Delete failed")
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading site…</p>
  }

  if (mode === "edit" || isNew) {
    return (
      <SiteForm
        site={isNew ? null : site}
        onCancel={() => {
          if (isNew) {
            navigate("/labkeeper")
          } else {
            setMode("view")
          }
        }}
        onSaved={(saved) => {
          bumpRefresh()
          navigate(`/sites/${saved.id}`)
          setMode("view")
        }}
      />
    )
  }

  if (!site) {
    return <p className="text-sm text-red-600 dark:text-red-400">{error || "Site not found"}</p>
  }

  if (mode === "createHost") {
    return (
      <HostForm
        siteId={site.id}
        onCancel={() => setMode("view")}
        onSaved={() => {
          bumpRefresh()
          setMode("view")
        }}
      />
    )
  }

  if (mode === "discover") {
    return (
      <DiscoveryPanel
        siteId={site.id}
        onClose={() => setMode("view")}
        onAdded={() => {
          bumpRefresh()
        }}
      />
    )
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="inline-flex items-center gap-2 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            <MapPin className="h-5 w-5 opacity-70" strokeWidth={1.75} />
            {site.name}
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Site · Inventory place / account bucket</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {site.discovery_enabled ? (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover dark:bg-neutral-200 dark:text-neutral-900 dark:hover:bg-white"
              onClick={() => setMode("discover")}
            >
              <Radar className="h-3.5 w-3.5" strokeWidth={1.75} />
              Discover
            </button>
          ) : null}
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
            onClick={() => setMode("createHost")}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            Add host
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
            onClick={() => setMode("edit")}
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
        <dt className="font-medium text-zinc-600 dark:text-zinc-400">Hosts</dt>
        <dd>
          {hostCount}{" "}
          <span className="text-zinc-500 dark:text-zinc-400">(expand site in the tree to browse)</span>
        </dd>
        <dt className="font-medium text-zinc-600 dark:text-zinc-400">LAN discovery</dt>
        <dd>{site.discovery_enabled ? "Enabled" : "Disabled"}</dd>
        <dt className="font-medium text-zinc-600 dark:text-zinc-400">ID</dt>
        <dd className="font-mono text-xs text-zinc-700 dark:text-zinc-300">{site.id}</dd>
      </dl>

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Select a host in the sidebar, or{" "}
        <Link to={`/sites/${site.id}`} className="text-neutral-700 no-underline hover:underline dark:text-neutral-300">
          refresh this site
        </Link>
        .
      </p>
    </div>
  )
}
