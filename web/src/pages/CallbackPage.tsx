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
          navigate("/labkeeper", { replace: true })
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
    <main className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-6 py-12">
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">LabKeeper Portal</h1>
        {error ? (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">Completing sign-in…</p>
        )}
      </div>
    </main>
  )
}
