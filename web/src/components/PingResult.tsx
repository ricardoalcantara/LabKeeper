import { useEffect, useState } from "react"
import { fetchPing, type PingResponse } from "../lib/api"

type Props = {
  accessToken: string
}

export function PingResult({ accessToken }: Props) {
  const [result, setResult] = useState<PingResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const response = await fetchPing(accessToken)
        if (!cancelled) {
          setResult(response)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "API ping failed")
          setResult(null)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [accessToken])

  if (loading) {
    return <p>Calling API ping…</p>
  }

  if (error) {
    return <p className="error">{error}</p>
  }

  return (
    <section>
      <h2>API ping</h2>
      <pre>{JSON.stringify(result, null, 2)}</pre>
    </section>
  )
}
