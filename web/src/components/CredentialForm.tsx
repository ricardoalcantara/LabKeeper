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
  const inputClass =
    "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-normal text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
  const labelClass = "block text-sm font-medium text-zinc-800 dark:text-zinc-200"
  const checkboxClass = "flex items-center gap-2 text-sm font-normal text-zinc-800 dark:text-zinc-200"

  return (
    <form className="max-w-lg space-y-4" onSubmit={(event) => void handleSubmit(event)}>
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        {editing ? "Edit credential" : "Add credential"}
      </h2>

      <label className={labelClass}>
        Name
        <input
          className={inputClass}
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </label>

      <label className={labelClass}>
        Type
        <select
          className={inputClass}
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

      <label className={labelClass}>
        Username
        <input
          className={inputClass}
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          required
        />
      </label>

      {type === "password" ? (
        <label className={labelClass}>
          Password {editing ? "(leave blank to keep)" : ""}
          <input
            className={inputClass}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required={!editing}
            autoComplete="new-password"
          />
        </label>
      ) : (
        <>
          <div className="space-y-1">
            <button
              type="button"
              className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-60"
              onClick={() => void handleGenerateSSH()}
              disabled={busy}
            >
              {generating ? "Generating…" : "Generate Ed25519 key"}
            </button>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Creates a key pair here so you can save the private key in the vault and copy the
              public key onto Hosts.
            </p>
          </div>

          <label className={labelClass}>
            Private key (PEM) {editing ? "(leave blank to keep)" : ""}
            <textarea
              className={`${inputClass} font-mono text-xs`}
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

          <label className={labelClass}>
            Key passphrase {editing ? "(leave blank to keep)" : "(optional)"}
            <input
              className={inputClass}
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
            <label className={checkboxClass}>
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
            <label className={labelClass}>
              Public key (derived — copy to authorized_keys)
              <textarea
                className={`${inputClass} font-mono text-xs`}
                value={publicKeyPreview}
                readOnly
                rows={2}
                spellCheck={false}
              />
            </label>
          ) : null}
        </>
      )}

      <h3 className="pt-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">Privilege escalation (become)</h3>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Ansible-style: login as the username above, then optionally escalate with sudo/su. LabKeeper
        does not change sudoers on the Host.
      </p>

      <label className={labelClass}>
        Become method
        <select
          className={inputClass}
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
          <label className={labelClass}>
            Become user
            <input
              className={inputClass}
              value={becomeUser}
              onChange={(event) => setBecomeUser(event.target.value)}
              placeholder="root"
            />
          </label>
          <label className={labelClass}>
            Become password {editing ? "(leave blank to keep)" : "(optional)"}
            <input
              className={inputClass}
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
            <label className={checkboxClass}>
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

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover dark:bg-neutral-200 dark:text-neutral-900 dark:hover:bg-white disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-60"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
