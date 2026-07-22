import { useState } from "react"
import { CredentialForm } from "../components/CredentialForm"
import { CredentialList } from "../components/CredentialList"
import type { Credential } from "../lib/api"

export function CredentialsPage() {
  const [mode, setMode] = useState<"list" | "create" | "edit">("list")
  const [editing, setEditing] = useState<Credential | null>(null)
  const [generateSSHOnMount, setGenerateSSHOnMount] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  if (mode === "list") {
    return (
      <CredentialList
        refreshKey={refreshKey}
        onCreate={() => {
          setEditing(null)
          setGenerateSSHOnMount(false)
          setMode("create")
        }}
        onGenerateSSH={() => {
          setEditing(null)
          setGenerateSSHOnMount(true)
          setMode("create")
        }}
        onEdit={(credential) => {
          setEditing(credential)
          setGenerateSSHOnMount(false)
          setMode("edit")
        }}
      />
    )
  }

  return (
    <CredentialForm
      credential={mode === "edit" ? editing : null}
      generateSSHOnMount={mode === "create" && generateSSHOnMount}
      onCancel={() => {
        setEditing(null)
        setGenerateSSHOnMount(false)
        setMode("list")
      }}
      onSaved={() => {
        setEditing(null)
        setGenerateSSHOnMount(false)
        setMode("list")
        setRefreshKey((value) => value + 1)
      }}
    />
  )
}
