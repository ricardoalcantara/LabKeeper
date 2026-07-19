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
  onAdded: () => void
  onClose: () => void
}

export function DiscoveryPanel({ onAdded, onClose }: Props) {
  const [networks, setNetworks] = useState<DiscoveryNetwork[]>([])
  const [cidr, setCidr] = useState("")
  const [customCidr, setCustomCidr] = useState("")
  const [candidates, setCandidates] = useState<DiscoveryCandidate[]>([])
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
      // Reverse DNS is a first-pass hostname; Agent hello/heartbeat can override later.
      await createHost({
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

  if (loadingStatus) {
    return (
      <section>
        <div className="section-toolbar">
          <h2>Discover LAN</h2>
          <button type="button" className="secondary" onClick={onClose}>
            Back
          </button>
        </div>
        <p>Checking private networks…</p>
      </section>
    )
  }

  return (
    <section>
      <div className="section-toolbar">
        <h2>Discover LAN</h2>
        <button type="button" className="secondary" onClick={onClose} disabled={scanning}>
          Back
        </button>
      </div>

      <p className="sub form-hint">
        Scans from the Server on private RFC1918 networks only (max /23). Results are candidates —
        nothing is added until you click Add.
      </p>

      {networks.length > 0 ? (
        <div className="credential-form" style={{ marginBottom: "1rem" }}>
          <label>
            Detected network
            <select
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

          <label>
            Custom CIDR (optional override)
            <input
              value={customCidr}
              onChange={(event) => setCustomCidr(event.target.value)}
              placeholder="e.g. 192.168.0.0/23"
              disabled={scanning}
            />
          </label>

          <div className="header-actions">
            <button type="button" onClick={() => void handleScan()} disabled={scanning}>
              {scanning ? "Scanning…" : "Scan"}
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className="error">{error}</p> : null}

      {candidates.length > 0 ? (
        <table className="host-table">
          <thead>
            <tr>
              <th>IP</th>
              <th>Reverse DNS</th>
              <th>Ports</th>
              <th>Methods</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {candidates.map((candidate) => (
              <tr key={candidate.ip} className={candidate.already_known ? "row-muted" : undefined}>
                <td className="mono-cell">{candidate.ip}</td>
                <td>{candidate.hostname || "—"}</td>
                <td>{candidate.open_ports?.join(", ") || "—"}</td>
                <td>{candidate.methods?.join(", ") || "—"}</td>
                <td className="row-actions">
                  {candidate.already_known ? (
                    <span className="sub">In inventory</span>
                  ) : (
                    <button
                      type="button"
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
      ) : null}
    </section>
  )
}
