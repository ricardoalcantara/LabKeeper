import { useEffect, useState, type FormEvent } from "react"
import {
  createCredential,
  generateSSHKey,
  updateCredential,
  type Credential,
  type CreateCredentialInput,
} from "../lib/api"
import { SessionExpiredError } from "../lib/oidc"

type Props = {
  credential?: Credential | null
  /** When creating, start as SSH key and generate a key pair once. */
  generateSSHOnMount?: boolean
  onCancel: () => void
  onSaved: () => void
}

export function CredentialForm({
  credential,
  generateSSHOnMount = false,
  onCancel,
  onSaved,
}: Props) {
  const editing = Boolean(credential)
  const [name, setName] = useState(credential?.name ?? "")
  const [type, setType] = useState<"password" | "ssh_key">(
    credential?.type ?? (generateSSHOnMount ? "ssh_key" : "password"),
  )
  const [username, setUsername] = useState(credential?.username ?? "")
  const [password, setPassword] = useState("")
  const [privateKey, setPrivateKey] = useState("")
  const [publicKeyPreview, setPublicKeyPreview] = useState(credential?.public_key ?? "")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (!generateSSHOnMount || editing) {
      return
    }
    let cancelled = false
    ;(async () => {
      setGenerating(true)
      setError(null)
      try {
        const key = await generateSSHKey()
        if (!cancelled) {
          setType("ssh_key")
          setPrivateKey(key.private_key)
          setPublicKeyPreview(key.public_key)
        }
      } catch (err) {
        if (cancelled || err instanceof SessionExpiredError) {
          return
        }
        setError(err instanceof Error ? err.message : "SSH key generation failed")
      } finally {
        if (!cancelled) {
          setGenerating(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [editing, generateSSHOnMount])

  const handleGenerateSSH = async () => {
    setGenerating(true)
    setError(null)
    try {
      const key = await generateSSHKey()
      setType("ssh_key")
      setPrivateKey(key.private_key)
      setPublicKeyPreview(key.public_key)
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        return
      }
      setError(err instanceof Error ? err.message : "SSH key generation failed")
    } finally {
      setGenerating(false)
    }
  }

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
        await updateCredential(credential.id, input)
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
        await createCredential(input)
      }
      onSaved()
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        return
      }
      setError(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  const busy = saving || generating

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
          disabled={editing || generateSSHOnMount}
          onChange={(event) => {
            const next = event.target.value as "password" | "ssh_key"
            setType(next)
            if (next === "password") {
              setPublicKeyPreview("")
            }
          }}
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
        <>
          <div className="form-inline-actions">
            <button
              type="button"
              className="secondary"
              onClick={() => void handleGenerateSSH()}
              disabled={busy}
            >
              {generating ? "Generating…" : "Generate Ed25519 key"}
            </button>
            <p className="sub form-hint">
              Creates a key pair here so you can save the private key in the vault and copy the
              public key onto Hosts.
            </p>
          </div>

          <label>
            Private key (PEM) {editing ? "(leave blank to keep)" : ""}
            <textarea
              value={privateKey}
              onChange={(event) => {
                setPrivateKey(event.target.value)
                setPublicKeyPreview("")
              }}
              required={!editing}
              rows={8}
              spellCheck={false}
            />
          </label>

          {publicKeyPreview ? (
            <label>
              Public key (derived — copy to authorized_keys)
              <textarea value={publicKeyPreview} readOnly rows={2} spellCheck={false} />
            </label>
          ) : null}
        </>
      )}

      {error ? <p className="error">{error}</p> : null}

      <div className="header-actions">
        <button type="submit" disabled={busy}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" className="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  )
}
