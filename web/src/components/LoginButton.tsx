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
    <button type="button" onClick={() => void handleClick()}>
      {label}
    </button>
  )
}
