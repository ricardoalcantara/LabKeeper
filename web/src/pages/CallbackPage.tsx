import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { handleCallback } from "../lib/oidc"

export function CallbackPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        await handleCallback(window.location.search)
        if (!cancelled) {
          navigate("/", { replace: true })
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Callback failed")
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [navigate])

  return (
    <main className="card">
      <h1>LabKeeper Portal</h1>
      {error ? <p className="error">{error}</p> : <p>Completing sign-in…</p>}
    </main>
  )
}
