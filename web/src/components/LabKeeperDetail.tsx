import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Plus, Server } from "lucide-react"
import { fetchSites } from "../lib/api"
import { useInventoryTree } from "../lib/inventoryTree"
import { SessionExpiredError } from "../lib/oidc"
import { CredentialsPage } from "../pages/CredentialsPage"

export function LabKeeperDetail() {
  const { refreshKey } = useInventoryTree()
  const [siteCount, setSiteCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const response = await fetchSites()
        if (!cancelled) {
          setSiteCount(response.sites.length)
          setError(null)
        }
      } catch (err) {
        if (cancelled || err instanceof SessionExpiredError) {
          return
        }
        setError(err instanceof Error ? err.message : "Failed to load overview")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="inline-flex items-center gap-2 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          <Server className="h-5 w-5 opacity-70" strokeWidth={1.75} />
          LabKeeper
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Global control plane — vault credentials and inventory overview for this Admin.
        </p>
      </div>

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2 rounded-lg border border-zinc-200 bg-zinc-100/80 p-4 text-sm dark:border-zinc-700 dark:bg-zinc-900/60">
        <dt className="font-medium text-zinc-600 dark:text-zinc-400">Sites</dt>
        <dd className="text-zinc-900 dark:text-zinc-100">{siteCount == null ? "…" : siteCount}</dd>
      </dl>

      <div>
        <Link
          to="/sites/new"
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-800 no-underline hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          Add site
        </Link>
      </div>

      <section className="border-t border-zinc-200 pt-6 dark:border-zinc-700">
        <CredentialsPage />
      </section>
    </div>
  )
}
