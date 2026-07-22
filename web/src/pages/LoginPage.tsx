import { useState } from "react"
import { Link } from "react-router-dom"
import { LoginButton } from "../components/LoginButton"
import { ThemeToggle } from "../components/ThemeToggle"
import { clientId, issuer, loginLabel, redirectUri } from "../lib/config"
import { isAuthenticated } from "../lib/oidc"

export function LoginPage() {
  const [error, setError] = useState<string | null>(null)

  return (
    <main className="relative mx-auto flex min-h-full max-w-lg flex-col justify-center px-6 py-12">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">LabKeeper Admin</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Sign in to manage your Inventory.</p>

        <dl className="mt-4 grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-2 text-sm">
          <dt className="font-medium text-zinc-600 dark:text-zinc-400">Issuer</dt>
          <dd className="break-all text-zinc-800 dark:text-zinc-200">{issuer()}</dd>
          <dt className="font-medium text-zinc-600 dark:text-zinc-400">Client ID</dt>
          <dd className="break-all text-zinc-800 dark:text-zinc-200">{clientId()}</dd>
          <dt className="font-medium text-zinc-600 dark:text-zinc-400">Redirect URI</dt>
          <dd className="break-all text-zinc-800 dark:text-zinc-200">{redirectUri()}</dd>
        </dl>

        {error ? <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p> : null}

        <div className="mt-5">
          {isAuthenticated() ? (
            <div className="space-y-2">
              <p className="text-sm text-zinc-700 dark:text-zinc-300">You are already signed in.</p>
              <Link
                className="inline-block rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white no-underline hover:bg-accent-hover dark:bg-neutral-200 dark:text-neutral-900 dark:hover:bg-white"
                to="/labkeeper"
              >
                Go to LabKeeper
              </Link>
            </div>
          ) : (
            <LoginButton label={loginLabel()} onError={setError} />
          )}
        </div>
      </div>
    </main>
  )
}
