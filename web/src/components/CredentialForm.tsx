import { useEffect, useState, type FormEvent } from "react"
import {
  createCredential,
  generateSSHKey,
  updateCredential,
  type BecomeMethod,
  type Credential,
  type CreateCredentialInput,
  type UpdateCredentialInput,
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
  const [passphrase, setPassphrase] = useState("")
  const [clearPassphrase, setClearPassphrase] = useState(false)
  const [publicKeyPreview, setPublicKeyPreview] = useState(credential?.public_key ?? "")
  const [becomeMethod, setBecomeMethod] = useState<BecomeMethod>(
    credential?.become_method ?? "none",
  )
  const [becomeUser, setBecomeUser] = useState(credential?.become_user ?? "root")
  const [becomeSecret, setBecomeSecret] = useState("")
  const [clearBecomeSecret, setClearBecomeSecret] = useState(false)
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
      setPassphrase("")
      setClearPassphrase(false)
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
        const input: UpdateCredentialInput = {
          name: name.trim(),
          username: username.trim(),
          become_method: becomeMethod,
          become_user: becomeMethod === "none" ? "" : becomeUser.trim() || "root",
        }
        if (type === "password" && password) {
          input.password = password
        }
        if (type === "ssh_key" && privateKey.trim()) {
          input.private_key = privateKey
        }
        if (type === "ssh_key") {
          if (clearPassphrase) {
            input.passphrase = ""
          } else if (passphrase) {
            input.passphrase = passphrase
          }
        }
        if (becomeMethod === "none" || clearBecomeSecret) {
          input.become_secret = ""
        } else if (becomeSecret) {
          input.become_secret = becomeSecret
        }
        await updateCredential(credential.id, input)
      } else {
        const input: CreateCredentialInput = {
          name: name.trim(),
          type,
          username: username.trim(),
          become_method: becomeMethod,
        }
        if (becomeMethod !== "none") {
          input.become_user = becomeUser.trim() || "root"
          if (becomeSecret) {
            input.become_secret = becomeSecret
          }
        }
        if (type === "password") {
          input.password = password
        } else {
          input.private_key = privateKey
          if (passphrase) {
            input.passphrase = passphrase
          }
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
              setPassphrase("")
              setClearPassphrase(false)
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

          <label>
            Key passphrase {editing ? "(leave blank to keep)" : "(optional)"}
            <input
              type="password"
              value={passphrase}
              onChange={(event) => {
                setPassphrase(event.target.value)
                if (event.target.value) {
                  setClearPassphrase(false)
                }
              }}
              autoComplete="new-password"
              disabled={clearPassphrase}
            />
          </label>
          {editing && credential?.has_passphrase ? (
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={clearPassphrase}
                onChange={(event) => {
                  setClearPassphrase(event.target.checked)
                  if (event.target.checked) {
                    setPassphrase("")
                  }
                }}
              />
              Clear stored passphrase
            </label>
          ) : null}

          {publicKeyPreview ? (
            <label>
              Public key (derived — copy to authorized_keys)
              <textarea value={publicKeyPreview} readOnly rows={2} spellCheck={false} />
            </label>
          ) : null}
        </>
      )}

      <h3 className="form-section-title">Privilege escalation (become)</h3>
      <p className="sub form-hint">
        Ansible-style: login as the username above, then optionally escalate with sudo/su. LabKeeper
        does not change sudoers on the Host.
      </p>

      <label>
        Become method
        <select
          value={becomeMethod}
          onChange={(event) => setBecomeMethod(event.target.value as BecomeMethod)}
        >
          <option value="none">None</option>
          <option value="sudo">sudo</option>
          <option value="su">su</option>
        </select>
      </label>

      {becomeMethod !== "none" ? (
        <>
          <label>
            Become user
            <input
              value={becomeUser}
              onChange={(event) => setBecomeUser(event.target.value)}
              placeholder="root"
            />
          </label>
          <label>
            Become password {editing ? "(leave blank to keep)" : "(optional)"}
            <input
              type="password"
              value={becomeSecret}
              onChange={(event) => {
                setBecomeSecret(event.target.value)
                if (event.target.value) {
                  setClearBecomeSecret(false)
                }
              }}
              autoComplete="new-password"
              disabled={clearBecomeSecret}
            />
          </label>
          {editing && credential?.has_become_secret ? (
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={clearBecomeSecret}
                onChange={(event) => {
                  setClearBecomeSecret(event.target.checked)
                  if (event.target.checked) {
                    setBecomeSecret("")
                  }
                }}
              />
              Clear stored become password
            </label>
          ) : null}
        </>
      ) : null}

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
