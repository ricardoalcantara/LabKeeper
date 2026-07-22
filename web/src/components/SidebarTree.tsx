import { useEffect, useState } from "react"
import {
  Box,
  ChevronDown,
  ChevronRight,
  MapPin,
  Monitor,
  Plus,
} from "lucide-react"
import { NavLink, useNavigate, useParams } from "react-router-dom"
import { fetchInventory, fetchSites, type Host, type Site } from "../lib/api"
import { useInventoryTree } from "../lib/inventoryTree"
import { SessionExpiredError } from "../lib/oidc"

const iconClass = "h-3.5 w-3.5 shrink-0 opacity-70"

function hostLabel(host: Host): string {
  return host.name || host.hostname || host.subject || host.id.slice(0, 8)
}

function hostStatusTitle(host: Host): string {
  if (host.online && host.agent_online) {
    return "Online · Agent connected"
  }
  if (host.online) {
    return "Reachable · Agent offline"
  }
  return "Offline"
}

function hostStatusColor(host: Host): string {
  if (host.online && host.agent_online) {
    return "var(--color-status-online)"
  }
  if (host.online) {
    return "var(--color-status-reachable)"
  }
  return "var(--color-status-offline)"
}

export function SidebarTree() {
  const { refreshKey } = useInventoryTree()
  const navigate = useNavigate()
  const params = useParams<{ siteId?: string; hostId?: string }>()
  const [sites, setSites] = useState<Site[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [hostsBySite, setHostsBySite] = useState<Record<string, Host[]>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const response = await fetchSites()
        if (!cancelled) {
          setSites(response.sites)
          setError(null)
        }
      } catch (err) {
        if (cancelled || err instanceof SessionExpiredError) {
          return
        }
        setError(err instanceof Error ? err.message : "Failed to load sites")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  useEffect(() => {
    if (params.siteId) {
      setExpanded((current) => {
        if (current.has(params.siteId!)) {
          return current
        }
        const next = new Set(current)
        next.add(params.siteId!)
        return next
      })
    }
  }, [params.siteId])

  useEffect(() => {
    const siteIds = [...expanded]
    if (siteIds.length === 0) {
      return
    }

    let cancelled = false

    const loadHosts = async () => {
      try {
        const entries = await Promise.all(
          siteIds.map(async (siteId) => {
            const response = await fetchInventory(siteId)
            return [siteId, response.hosts] as const
          }),
        )
        if (!cancelled) {
          setHostsBySite((current) => {
            const next = { ...current }
            for (const [siteId, hosts] of entries) {
              next[siteId] = hosts
            }
            return next
          })
        }
      } catch (err) {
        if (cancelled || err instanceof SessionExpiredError) {
          return
        }
        setError(err instanceof Error ? err.message : "Failed to load hosts")
      }
    }

    void loadHosts()
    const timer = window.setInterval(() => {
      void loadHosts()
    }, 5000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [expanded, refreshKey])

  const toggleSite = (siteId: string) => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(siteId)) {
        next.delete(siteId)
      } else {
        next.add(siteId)
      }
      return next
    })
  }

  const treeLinkClass = ({ isActive }: { isActive: boolean }) =>
    [
      "flex min-w-0 items-center gap-1.5 truncate rounded px-1.5 py-1 text-sm no-underline",
      isActive
        ? "bg-sidebar-active font-medium text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
        : "text-zinc-800 hover:bg-sidebar-hover dark:text-zinc-200 dark:hover:bg-zinc-800",
    ].join(" ")

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-sidebar-border px-1.5 py-2 dark:border-zinc-700">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Inventory
        </span>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded border border-zinc-300 bg-white px-2 py-0.5 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          onClick={() => navigate("/sites/new")}
        >
          <Plus className="h-3 w-3" strokeWidth={2} />
          Add site
        </button>
      </div>

      <nav className="flex-1 overflow-auto px-1 py-1.5 text-sm">
        {error ? <p className="mb-2 px-1 text-xs text-red-600 dark:text-red-400">{error}</p> : null}

        <NavLink to="/labkeeper" end className={treeLinkClass}>
          <Box className={iconClass} strokeWidth={1.75} aria-hidden />
          <span className="truncate">LabKeeper</span>
        </NavLink>

        <div className="ml-1.5 mt-0.5 space-y-0.5 border-l border-zinc-200 pl-1 dark:border-zinc-700">
          {sites.map((site) => {
            const isExpanded = expanded.has(site.id)
            const hosts = hostsBySite[site.id] ?? []
            return (
              <div key={site.id}>
                <div className="flex items-stretch gap-0.5">
                  <button
                    type="button"
                    className="inline-flex w-4 shrink-0 items-center justify-center rounded text-zinc-500 hover:bg-sidebar-hover dark:text-zinc-400 dark:hover:bg-zinc-800"
                    aria-label={isExpanded ? "Collapse site" : "Expand site"}
                    onClick={() => toggleSite(site.id)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                    )}
                  </button>
                  <NavLink to={`/sites/${site.id}`} className={treeLinkClass}>
                    <MapPin className={iconClass} strokeWidth={1.75} aria-hidden />
                    <span className="truncate">{site.name}</span>
                  </NavLink>
                </div>
                {isExpanded ? (
                  <div className="ml-3 mt-0.5 space-y-0.5 border-l border-zinc-200 pl-1 dark:border-zinc-700">
                    {hosts.length === 0 ? (
                      <p className="px-1 py-1 text-xs text-zinc-500 dark:text-zinc-400">No hosts</p>
                    ) : (
                      hosts.map((host) => (
                        <NavLink
                          key={host.id}
                          to={`/sites/${site.id}/hosts/${host.id}`}
                          className={treeLinkClass}
                          title={hostStatusTitle(host)}
                        >
                          <span className="relative inline-flex shrink-0">
                            <Monitor
                              className={[
                                iconClass,
                                host.online && !host.agent_online ? "opacity-50" : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              strokeWidth={1.75}
                              aria-hidden
                            />
                            <span
                              className={[
                                "absolute -right-0.5 -bottom-0.5 h-1.5 w-1.5 rounded-full ring-1 ring-sidebar dark:ring-zinc-900",
                                host.online && !host.agent_online ? "outline outline-1 outline-offset-0" : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              style={{
                                backgroundColor: hostStatusColor(host),
                                outlineColor:
                                  host.online && !host.agent_online
                                    ? "var(--color-status-reachable)"
                                    : undefined,
                              }}
                              aria-hidden
                            />
                          </span>
                          <span className="truncate">{hostLabel(host)}</span>
                        </NavLink>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
