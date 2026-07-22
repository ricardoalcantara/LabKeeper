import { startLogin } from "../lib/oidc"

type Props = {
  label: string
  onError?: (message: string) => void
}

export function LoginButton({ label, onError }: Props) {
  async function handleClick() {
    try {
      await startLogin()
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "Login failed")
    }
  }

  return (
    <button
      type="button"
      className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover dark:bg-neutral-200 dark:text-neutral-900 dark:hover:bg-white"
      onClick={() => void handleClick()}
    >
      {label}
    </button>
  )
}
