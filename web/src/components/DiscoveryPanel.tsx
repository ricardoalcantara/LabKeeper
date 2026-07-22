import { useEffect, useState } from "react"
import {
  createHost,
  fetchDiscoveryStatus,
  scanDiscovery,
  type DiscoveryCandidate,
  type DiscoveryNetwork,
} from "../lib/api"
import { SessionExpiredError } from "../lib/oidc"

type Props = {
  siteId: string
  onAdded: () => void
  onClose: () => void
}

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-normal text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"

export function DiscoveryPanel({ siteId, onAdded, onClose }: Props) {
  const [networks, setNetworks] = useState<DiscoveryNetwork[]>([])
  const [cidr, setCidr] = useState("")
  const [customCidr, setCustomCidr] = useState("")
  const [candidates, setCandidates] = useState<DiscoveryCandidate[]>([])
  const [showInInventory, setShowInInventory] = useState(false)
  const [addingIPs, setAddingIPs] = useState<Set<string>>(() => new Set())
  const [error, setError] = useState<string | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const status = await fetchDiscoveryStatus()
        if (cancelled) {
          return
        }
        if (!status.enabled || status.networks.length === 0) {
          setError("Discovery unavailable: Server has no private network interface")
          setNetworks([])
          return
        }
        setNetworks(status.networks)
        setCidr(status.networks[0].cidr)
        setError(null)
      } catch (err) {
        if (cancelled || err instanceof SessionExpiredError) {
          return
        }
        setError(err instanceof Error ? err.message : "Failed to load discovery status")
      } finally {
        if (!cancelled) {
          setLoadingStatus(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleScan = async () => {
    const target = (customCidr.trim() || cidr).trim()
    if (!target) {
      setError("Choose or enter a private CIDR (max /23)")
      return
    }
    setScanning(true)
    setError(null)
    setCandidates([])
    try {
      const result = await scanDiscovery(target)
      setCandidates(result.candidates)
      if (result.candidates.length === 0) {
        setError("Scan finished — no hosts responded")
      }
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        return
      }
      setError(err instanceof Error ? err.message : "Scan failed")
    } finally {
      setScanning(false)
    }
  }

  const handleAdd = async (candidate: DiscoveryCandidate) => {
    setAddingIPs((current) => new Set(current).add(candidate.ip))
    setError(null)
    try {
      await createHost({
        site_id: siteId,
        address: candidate.ip,
        hostname: candidate.hostname || undefined,
      })
      setCandidates((current) =>
        current.map((item) =>
          item.ip === candidate.ip ? { ...item, already_known: true } : item,
        ),
      )
      onAdded()
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        return
      }
      setError(err instanceof Error ? err.message : "Failed to add host")
    } finally {
      setAddingIPs((current) => {
        const next = new Set(current)
        next.delete(candidate.ip)
        return next
      })
    }
  }

  const visibleCandidates = showInInventory
    ? candidates
    : candidates.filter((candidate) => !candidate.already_known)
  const knownCount = candidates.filter((candidate) => candidate.already_known).length

  if (loadingStatus) {
    return <p className="text-sm text-zinc-600 dark:text-zinc-400">Checking private networks…</p>
  }

  return (
    <section className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Discover LAN</h2>
        <button
          type="button"
          className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
          onClick={onClose}
          disabled={scanning}
        >
          Back
        </button>
      </div>

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Scans from the Server on private RFC1918 networks only (max /23). Results are candidates —
        nothing is added until you click Add.
      </p>

      {networks.length > 0 ? (
        <div className="max-w-lg space-y-4">
          <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Detected network
            <select
              className={inputClass}
              value={cidr}
              onChange={(event) => {
                setCidr(event.target.value)
                setCustomCidr("")
              }}
              disabled={scanning}
            >
              {networks.map((network) => (
                <option key={`${network.iface}-${network.cidr}`} value={network.cidr}>
                  {network.cidr} ({network.iface} · {network.address})
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Custom CIDR (optional override)
            <input
              className={inputClass}
              value={customCidr}
              onChange={(event) => setCustomCidr(event.target.value)}
              placeholder="e.g. 192.168.0.0/23"
              disabled={scanning}
            />
          </label>

          <button
            type="button"
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover dark:bg-neutral-200 dark:text-neutral-900 dark:hover:bg-white disabled:opacity-60"
            onClick={() => void handleScan()}
            disabled={scanning}
          >
            {scanning ? "Scanning…" : "Scan"}
          </button>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      {candidates.length > 0 ? (
        <div className="space-y-3">
          <label className="inline-flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              className="rounded border-zinc-300 dark:border-zinc-600"
              checked={showInInventory}
              onChange={(event) => setShowInInventory(event.target.checked)}
            />
            Show in inventory
            {knownCount > 0 ? (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">({knownCount})</span>
            ) : null}
          </label>

          {visibleCandidates.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              All scan results are already in inventory. Enable “Show in inventory” to list them.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                    <th className="px-2 py-2 font-semibold">IP</th>
                    <th className="px-2 py-2 font-semibold">Reverse DNS</th>
                    <th className="px-2 py-2 font-semibold">Ports</th>
                    <th className="px-2 py-2 font-semibold">Methods</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {visibleCandidates.map((candidate) => (
                    <tr
                      key={candidate.ip}
                      className={`border-b border-zinc-100 dark:border-zinc-800 ${candidate.already_known ? "opacity-50" : ""}`}
                    >
                      <td className="px-2 py-2 font-mono text-xs">{candidate.ip}</td>
                      <td className="px-2 py-2">{candidate.hostname || "—"}</td>
                      <td className="px-2 py-2">{candidate.open_ports?.join(", ") || "—"}</td>
                      <td className="px-2 py-2">{candidate.methods?.join(", ") || "—"}</td>
                      <td className="px-2 py-2 text-right">
                        {candidate.already_known ? (
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">In inventory</span>
                        ) : (
                          <button
                            type="button"
                            className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-white hover:bg-accent-hover dark:bg-neutral-200 dark:text-neutral-900 dark:hover:bg-white disabled:opacity-60"
                            onClick={() => void handleAdd(candidate)}
                            disabled={addingIPs.has(candidate.ip)}
                          >
                            {addingIPs.has(candidate.ip) ? "Adding…" : "Add"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </section>
  )
}
