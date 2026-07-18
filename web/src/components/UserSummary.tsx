type Props = {
  name?: string
  email?: string
  username?: string
}

export function UserSummary({ name, email, username }: Props) {
  const primary = name || username || email || "Signed in"
  const secondary = [username, email].filter((value) => value && value !== primary).join(" · ")

  return (
    <p className="user-summary">
      <span className="user-summary-name">{primary}</span>
      {secondary ? <span className="user-summary-meta">{secondary}</span> : null}
    </p>
  )
}
