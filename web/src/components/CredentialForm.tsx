import { useState, type FormEvent } from "react"
import {
  createCredential,
  updateCredential,
  type Credential,
  type CreateCredentialInput,
} from "../lib/api"

type Props = {
  accessToken: string
  credential?: Credential | null
  onCancel: () => void
  onSaved: () => void
}

export function CredentialForm({ accessToken, credential, onCancel, onSaved }: Props) {
  const editing = Boolean(credential)
  const [name, setName] = useState(credential?.name ?? "")
  const [type, setType] = useState<"password" | "ssh_key">(credential?.type ?? "password")
  const [username, setUsername] = useState(credential?.username ?? "")
  const [password, setPassword] = useState("")
  const [privateKey, setPrivateKey] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)

    try {
      if (editing && credential) {
        const input: {
          name: string
          username: string
          password?: string
          private_key?: string
        } = {
          name: name.trim(),
          username: username.trim(),
        }
        if (type === "password" && password) {
          input.password = password
        }
        if (type === "ssh_key" && privateKey.trim()) {
          input.private_key = privateKey
        }
        await updateCredential(accessToken, credential.id, input)
      } else {
        const input: CreateCredentialInput = {
          name: name.trim(),
          type,
          username: username.trim(),
        }
        if (type === "password") {
          input.password = password
        } else {
          input.private_key = privateKey
        }
        await createCredential(accessToken, input)
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="credential-form" onSubmit={(event) => void handleSubmit(event)}>
      <h2>{editing ? "Edit credential" : "Add credential"}</h2>

      <label>
        Name
        <input value={name} onChange={(event) => setName(event.target.value)} required />
      </label>

      <label>
        Type
        <select
          value={type}
          disabled={editing}
          onChange={(event) => setType(event.target.value as "password" | "ssh_key")}
        >
          <option value="password">Username + password</option>
          <option value="ssh_key">SSH private key</option>
        </select>
      </label>

      <label>
        Username
        <input value={username} onChange={(event) => setUsername(event.target.value)} required />
      </label>

      {type === "password" ? (
        <label>
          Password {editing ? "(leave blank to keep)" : ""}
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required={!editing}
            autoComplete="new-password"
          />
        </label>
      ) : (
        <label>
          Private key (PEM) {editing ? "(leave blank to keep)" : ""}
          <textarea
            value={privateKey}
            onChange={(event) => setPrivateKey(event.target.value)}
            required={!editing}
            rows={8}
            spellCheck={false}
          />
        </label>
      )}

      {error ? <p className="error">{error}</p> : null}

      <div className="header-actions">
        <button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" className="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  )
}
