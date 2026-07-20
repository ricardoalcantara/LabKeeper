import { useEffect, useState } from "react"
import { deleteSite, fetchSites, type Host, type Site } from "../lib/api"
import { SessionExpiredError } from "../lib/oidc"
import { DiscoveryPanel } from "./DiscoveryPanel"
import { HostList } from "./HostList"

type Props = {
  refreshKey: number
  onCreateSite: () => void
  onEditSite: (site: Site) => void
  onCreateHost: (site: Site) => void
  onEditHost: (site: Site, host: Host) => void
  onHostsChanged: () => void
}

export function SiteList({
  refreshKey,
  onCreateSite,
  onEditSite,
  onCreateHost,
  onEditHost,
  onHostsChanged,
}: Props) {
  const [sites, setSites] = useState<Site[]>([])
  const [expandedSiteId, setExpandedSiteId] = useState<string | null>(null)
  const [discoveringSiteId, setDiscoveringSiteId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const sitesResponse = await fetchSites()
        if (!cancelled) {
          setSites(sitesResponse.sites)
          setError(null)
        }
      } catch (err) {
        if (cancelled || err instanceof SessionExpiredError) {
          return
        }
        setError(err instanceof Error ? err.message : "Failed to load sites")
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  const handleToggle = (siteId: string) => {
    setExpandedSiteId((current) => {
      if (current === siteId) {
        setDiscoveringSiteId(null)
        return null
      }
      setDiscoveringSiteId(null)
      return siteId
    })
  }

  const handleDeleteSite = async (site: Site) => {
    if (!window.confirm(`Delete site “${site.name}”?`)) {
      return
    }
    try {
      await deleteSite(site.id)
      setSites((current) => current.filter((item) => item.id !== site.id))
      if (expandedSiteId === site.id) {
        setExpandedSiteId(null)
      }
      if (discoveringSiteId === site.id) {
        setDiscoveringSiteId(null)
      }
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        return
      }
      setError(err instanceof Error ? err.message : "Delete site failed")
    }
  }

  if (loading) {
    return <p>Loading sites…</p>
  }

  return (
    <section>
      <div className="section-toolbar">
        <h2>Sites</h2>
        <button type="button" onClick={onCreateSite}>
          Add site
        </button>
      </div>

      {error ? <p className="error">{error}</p> : null}

      {sites.length === 0 ? (
        <p className="sub">No sites yet. Add one to group your hosts by place or cloud account.</p>
      ) : (
        <ul className="site-list">
          {sites.map((site) => {
            const expanded = expandedSiteId === site.id
            const discovering = discoveringSiteId === site.id

            return (
              <li key={site.id} className={`site-item${expanded ? " site-item-expanded" : ""}`}>
                <div className="site-item-header">
                  <button
                    type="button"
                    className="site-toggle"
                    onClick={() => handleToggle(site.id)}
                    aria-expanded={expanded}
                  >
                    <span className="site-toggle-icon">{expanded ? "▾" : "▸"}</span>
                    <span className="site-name">{site.name}</span>
                    {site.discovery_enabled ? (
                      <span className="site-badge">discovery</span>
                    ) : null}
                  </button>
                  <div className="row-actions">
                    <button type="button" className="secondary" onClick={() => onEditSite(site)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => void handleDeleteSite(site)}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {expanded ? (
                  <div className="site-item-body">
                    {discovering ? (
                      <DiscoveryPanel
                        siteId={site.id}
                        onClose={() => setDiscoveringSiteId(null)}
                        onAdded={() => {
                          onHostsChanged()
                        }}
                      />
                    ) : (
                      <HostList
                        siteId={site.id}
                        refreshKey={refreshKey}
                        onDiscover={
                          site.discovery_enabled
                            ? () => setDiscoveringSiteId(site.id)
                            : undefined
                        }
                        onCreate={() => onCreateHost(site)}
                        onEdit={(host) => onEditHost(site, host)}
                      />
                    )}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
