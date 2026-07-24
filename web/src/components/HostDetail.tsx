import { useEffect, useRef, useState, type ReactNode } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  Clock,
  Copy,
  Cpu,
  Globe,
  Monitor,
  Pencil,
  RefreshCw,
  TerminalSquare,
  Trash2,
  TriangleAlert,
  Zap,
} from "lucide-react"
import { deleteHost, fetchHost, fetchSite, type Host } from "../lib/api"
import { useInventoryTree } from "../lib/inventoryTree"
import { SessionExpiredError } from "../lib/oidc"
import { HostForm } from "./HostForm"
import { HostTerminal } from "./HostTerminal"

type Tab = "overview" | "network" | "telemetry" | "terminal"

type DerivedEvent = {
  tone: "ok" | "warn" | "accent"
  title: string
  detail: string
}

function formatMemory(bytes?: number): string {
  if (bytes == null) {
    return "—"
  }
  const gib = bytes / (1024 * 1024 * 1024)
  if (gib >= 1) {
    return `${gib.toFixed(1)} GiB`
  }
  const mib = bytes / (1024 * 1024)
  return `${mib.toFixed(0)} MiB`
}

function displayName(host: Host): string {
  return host.name || host.hostname || host.subject || host.id.slice(0, 12)
}

function probeLabel(host: Host): string {
  return host.probe_method === "tcp" ? `TCP :${host.probe_port}` : "ICMP"
}

function primaryIp(host: Host): string | undefined {
  if (host.address?.trim()) {
    return host.address.trim()
  }
  return host.ips?.find((ip) => ip && !ip.includes(":"))
}

function secondaryIps(host: Host): string[] {
  const primary = primaryIp(host)
  const seen = new Set<string>()
  const out: string[] = []
  for (const ip of host.ips ?? []) {
    if (!ip || ip === primary || seen.has(ip)) {
      continue
    }
    seen.add(ip)
    out.push(ip)
  }
  return out
}

function formatWhen(iso?: string): string {
  if (!iso) {
    return "—"
  }
  return new Date(iso).toLocaleString()
}

async function copyText(value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value)
  } catch {
    // Clipboard may be unavailable in insecure contexts.
  }
}

function deriveEvents(host: Host): DerivedEvent[] {
  const events: DerivedEvent[] = []
  if (host.last_probe_at) {
    events.push({
      tone: host.online ? "ok" : "warn",
      title: host.online
        ? `Sondagem ${probeLabel(host)} com Sucesso`
        : `Sondagem ${probeLabel(host)} falhou`,
      detail: formatWhen(host.last_probe_at),
    })
  }
  if (host.agent_fingerprint) {
    if (host.agent_online && host.last_seen) {
      events.push({
        tone: "ok",
        title: "Agente Conectado",
        detail: formatWhen(host.last_seen),
      })
    } else if (host.last_seen) {
      events.push({
        tone: "warn",
        title: "Conexão do Agente Perdida",
        detail: formatWhen(host.last_seen),
      })
    }
  }
  events.push({
    tone: "accent",
    title: "Host Registrado",
    detail: formatWhen(host.created_at),
  })
  return events.slice(0, 5)
}

function ChipButton({
  children,
  onClick,
  danger,
  disabled,
  title,
}: {
  children: ReactNode
  onClick?: () => void
  danger?: boolean
  disabled?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={
        danger
          ? "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-hd-danger bg-transparent px-3.5 py-2 text-[12.5px] font-semibold text-hd-danger disabled:opacity-50"
          : "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-hd-chipbd bg-hd-chip px-3.5 py-2 text-[12.5px] font-semibold text-hd-tx disabled:opacity-50"
      }
    >
      {children}
    </button>
  )
}

function StatusPill({
  tone,
  label,
}: {
  tone: "ok" | "warn" | "danger"
  label: string
}) {
  const styles =
    tone === "ok"
      ? "bg-[oklch(0.92_0.04_145)] text-[oklch(0.45_0.12_145)] dark:bg-[oklch(0.34_0.05_145)] dark:text-[oklch(0.86_0.12_145)]"
      : tone === "warn"
        ? "bg-[oklch(0.93_0.04_78)] text-[oklch(0.5_0.12_65)] dark:bg-[oklch(0.35_0.06_65)] dark:text-[oklch(0.87_0.13_78)]"
        : "bg-[oklch(0.93_0.04_25)] text-[oklch(0.5_0.16_25)] dark:bg-[oklch(0.35_0.08_25)] dark:text-[oklch(0.82_0.14_25)]"
  const dot =
    tone === "ok" ? "bg-hd-ok" : tone === "warn" ? "bg-hd-warn" : "bg-hd-danger"
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[3px] text-xs ${styles}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  )
}

function SectionCard({
  title,
  icon,
  trailing,
  children,
}: {
  title: string
  icon: ReactNode
  trailing?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="rounded-xl border border-hd-bd bg-hd-card p-5 text-hd-tx">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5 text-sm font-semibold">
          {icon}
          {title}
        </div>
        {trailing}
      </div>
      {children}
    </div>
  )
}

function FieldBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[11.5px] text-hd-txm">{label}</div>
      <div className="rounded-lg border border-hd-bd bg-hd-card2 px-3 py-2.5 font-mono text-[13px]">
        {children}
      </div>
    </div>
  )
}

export function HostDetail() {
  const { hostId } = useParams<{ hostId: string }>()
  const navigate = useNavigate()
  const { bumpRefresh, refreshKey } = useInventoryTree()
  const [host, setHost] = useState<Host | null>(null)
  const [siteName, setSiteName] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [tab, setTab] = useState<Tab>("overview")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const editingRef = useRef(editing)
  editingRef.current = editing

  useEffect(() => {
    if (!hostId) {
      return
    }
    let cancelled = false

    const load = async (showLoading: boolean) => {
      if (showLoading) {
        setLoading(true)
      }
      try {
        const row = await fetchHost(hostId)
        if (cancelled) {
          return
        }
        setHost(row)
        setError(null)
        if (showLoading) {
          setEditing(false)
          setTab("overview")
        }
        try {
          const site = await fetchSite(row.site_id)
          if (!cancelled) {
            setSiteName(site.name)
          }
        } catch {
          if (!cancelled) {
            setSiteName(null)
          }
        }
      } catch (err) {
        if (cancelled || err instanceof SessionExpiredError) {
          return
        }
        setError(err instanceof Error ? err.message : "Failed to load host")
      } finally {
        if (!cancelled && showLoading) {
          setLoading(false)
        }
      }
    }

    void load(true)
    const timer = window.setInterval(() => {
      if (!editingRef.current) {
        void load(false)
      }
    }, 5000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [hostId, refreshKey])

  const handleCopy = async (key: string, value: string) => {
    await copyText(value)
    setCopied(key)
    window.setTimeout(() => {
      setCopied((current) => (current === key ? null : current))
    }, 1500)
  }

  const handleRefresh = async () => {
    if (!hostId || refreshing) {
      return
    }
    setRefreshing(true)
    try {
      const row = await fetchHost(hostId)
      setHost(row)
      setError(null)
      bumpRefresh()
    } catch (err) {
      if (!(err instanceof SessionExpiredError)) {
        setError(err instanceof Error ? err.message : "Refresh failed")
      }
    } finally {
      setRefreshing(false)
    }
  }

  const handleDelete = async () => {
    if (!host || !window.confirm(`Excluir host “${displayName(host)}”?`)) {
      return
    }
    try {
      await deleteHost(host.id)
      bumpRefresh()
      navigate(host.site_id ? `/sites/${host.site_id}` : "/labkeeper")
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        return
      }
      setError(err instanceof Error ? err.message : "Delete failed")
    }
  }

  if (loading) {
    return <p className="text-sm text-hd-txm">Carregando host…</p>
  }

  if (!host) {
    return <p className="text-sm text-hd-danger">{error || "Host not found"}</p>
  }

  if (editing) {
    return (
      <HostForm
        siteId={host.site_id}
        host={host}
        onCancel={() => setEditing(false)}
        onSaved={() => {
          bumpRefresh()
          setEditing(false)
        }}
      />
    )
  }

  const name = displayName(host)
  const ip = primaryIp(host)
  const extras = secondaryIps(host)
  const addressCount = (ip ? 1 : 0) + extras.length
  const events = deriveEvents(host)
  const agentDot = host.agent_online ? "bg-hd-ok" : host.online ? "bg-hd-warn" : "bg-hd-danger"
  const fingerprintShort = host.agent_fingerprint
    ? `${host.agent_fingerprint.slice(0, 16)}_`
    : "—"

  const reachabilityPill = (() => {
    if (host.online) {
      return (
        <StatusPill
          tone="ok"
          label={`Host Alcançável (${probeLabel(host)})`}
        />
      )
    }
    return <StatusPill tone="danger" label="Host Inalcançável" />
  })()

  // Reachability owns the header signal (green/red). Agent offline stays in
  // "Estado do Agente" so a reachable host does not look "warning" by default.
  const agentPill = host.agent_online ? (
    <StatusPill tone="ok" label="Agente Online" />
  ) : null

  const tabs: { id: Tab; label: ReactNode }[] = [
    { id: "overview", label: "Visão Geral" },
    {
      id: "network",
      label: (
        <>
          Interfaces de Rede{" "}
          <span className="text-hd-txf">({addressCount})</span>
        </>
      ),
    },
    { id: "telemetry", label: "Telemetria & Hardware" },
    { id: "terminal", label: "Console" },
  ]

  return (
    <div className="flex flex-col gap-5 text-hd-tx">
      <div className="rounded-xl border border-hd-bd bg-hd-card px-5 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-hd-bd bg-hd-card2 text-xl">
              <Monitor className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="m-0 text-2xl font-bold">{name}</h1>
                <span className="rounded-md border border-hd-bd bg-hd-card2 px-2.5 py-[3px] font-mono text-[11.5px] text-hd-txm">
                  LabKeeper / {siteName || "…"}
                </span>
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
                {reachabilityPill}
                {agentPill}
                <span className="inline-flex items-center gap-1 font-mono text-[11.5px] text-hd-txf">
                  · ID: {host.id}
                  <button
                    type="button"
                    className="text-hd-txf hover:text-hd-tx"
                    title={copied === "id" ? "Copiado" : "Copiar ID"}
                    onClick={() => void handleCopy("id", host.id)}
                  >
                    <Copy className="h-3 w-3" strokeWidth={2} />
                  </button>
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <ChipButton
              disabled={refreshing}
              title="Atualizar status do host (sem disparar sonda no Server)"
              onClick={() => void handleRefresh()}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
                strokeWidth={2}
              />
              Testar Conexão
            </ChipButton>
            <ChipButton onClick={() => setTab("terminal")}>
              <TerminalSquare className="h-3.5 w-3.5" strokeWidth={2} />
              Console
            </ChipButton>
            <ChipButton onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
              Editar
            </ChipButton>
            <ChipButton danger onClick={() => void handleDelete()}>
              <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
              Excluir
            </ChipButton>
          </div>
        </div>

        <div className="-mx-5 mt-5 flex gap-6 border-b border-hd-bd px-5">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={
                tab === item.id
                  ? "border-b-2 border-hd-accent pb-2.5 text-[13px] font-semibold text-hd-tx"
                  : "pb-2.5 text-[13px] text-hd-txm"
              }
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="text-sm text-hd-danger">{error}</p> : null}

      {tab === "overview" ? (
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[1fr_340px]">
          <div className="flex flex-col gap-5">
            <SectionCard
              title="Endereçamento de Rede"
              icon={<Globe className="h-4 w-4" strokeWidth={1.75} />}
              trailing={
                <span className="text-xs text-hd-txf">
                  Total: {addressCount} Endereço{addressCount === 1 ? "" : "s"}
                </span>
              }
            >
              <div className="mb-4 flex items-center justify-between rounded-[10px] border border-hd-bd bg-hd-card2 p-4">
                <div>
                  <div className="mb-1.5 text-[10.5px] font-semibold tracking-widest text-hd-txf">
                    IP PRINCIPAL (LAN)
                  </div>
                  <div className="font-mono text-[22px] font-bold">{ip || "—"}</div>
                </div>
                <ChipButton
                  disabled={!ip}
                  onClick={() => ip && void handleCopy("primary", ip)}
                >
                  <Copy className="h-3.5 w-3.5" strokeWidth={2} />
                  {copied === "primary" ? "Copiado" : "Copiar IP"}
                </ChipButton>
              </div>
              {extras.length > 0 ? (
                <>
                  <div className="mb-3 text-xs text-hd-txm">
                    Pontes de Rede & Interfaces Virtuais (Docker / VEth):
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                    {extras.map((addr) => (
                      <div
                        key={addr}
                        className="flex items-center justify-between gap-2 rounded-lg border border-hd-bd bg-hd-card2 px-2.5 py-[7px] font-mono text-[12.5px] text-hd-mono"
                      >
                        <span className="truncate">{addr}</span>
                        <button
                          type="button"
                          className="shrink-0 text-hd-txf hover:text-hd-tx"
                          title="Copiar"
                          onClick={() => void handleCopy(addr, addr)}
                        >
                          <Copy className="h-3 w-3" strokeWidth={2} />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-xs text-hd-txf">Nenhum endereço adicional reportado.</p>
              )}
            </SectionCard>

            <SectionCard
              title="Especificações do Sistema"
              icon={<Cpu className="h-4 w-4" strokeWidth={1.75} />}
              trailing={<span className="text-xs text-hd-txf">Hardware & SO</span>}
            >
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div className="rounded-[10px] border border-hd-bd bg-hd-card2 px-4 py-3.5">
                  <div className="mb-1.5 text-[10.5px] font-semibold tracking-wider text-hd-txf">
                    SISTEMA OPERACIONAL
                  </div>
                  <div className="font-mono text-sm">{host.os || "—"}</div>
                </div>
                <div className="rounded-[10px] border border-hd-bd bg-hd-card2 px-4 py-3.5">
                  <div className="mb-1.5 text-[10.5px] font-semibold tracking-wider text-hd-txf">
                    CREDENCIAL CONFIGURADA
                  </div>
                  <div
                    className={
                      host.credential?.name
                        ? "text-sm"
                        : "text-sm italic text-hd-txf"
                    }
                  >
                    {host.credential?.name || "Nenhuma"}
                  </div>
                </div>
              </div>
              {!host.agent_online ? (
                <div className="mt-3.5 flex gap-3 rounded-[10px] border border-[oklch(0.72_0.1_72)] bg-[oklch(0.95_0.04_72)] px-4 py-3.5 dark:border-[oklch(0.46_0.08_72)] dark:bg-[oklch(0.34_0.055_72_/_0.55)]">
                  <span className="flex-none text-base text-[oklch(0.55_0.14_65)] dark:text-[oklch(0.86_0.13_78)]">
                    <TriangleAlert className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <div>
                    <div className="mb-1 text-[13px] font-semibold text-[oklch(0.5_0.12_65)] dark:text-[oklch(0.86_0.13_78)]">
                      Telemetria em Tempo Real Indisponível
                    </div>
                    <div className="text-xs leading-normal text-hd-txm">
                      O monitoramento de CPU e Memória RAM exige o agente instalado e em
                      execução. O host segue sendo monitorado via{" "}
                      {probeLabel(host)}.
                    </div>
                  </div>
                </div>
              ) : null}
            </SectionCard>
          </div>

          <div className="flex flex-col gap-5">
            <SectionCard
              title="Estado do Agente"
              icon={<Zap className="h-4 w-4" strokeWidth={1.75} />}
              trailing={<span className={`h-[9px] w-[9px] rounded-full ${agentDot}`} />}
            >
              <div className="flex flex-col gap-3.5">
                <FieldBlock label={`Última Sondagem (${probeLabel(host)}):`}>
                  {formatWhen(host.last_probe_at)}
                </FieldBlock>
                <FieldBlock label="Última Conexão do Agente:">
                  {formatWhen(host.last_seen)}
                </FieldBlock>
                <div>
                  <div className="mb-1.5 text-[11.5px] text-hd-txm">
                    Chave / Token do Agente:
                  </div>
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-hd-bd bg-hd-card2 px-3 py-2.5 font-mono text-[13px]">
                    <span className="truncate">{fingerprintShort}</span>
                    {host.agent_fingerprint ? (
                      <button
                        type="button"
                        className="shrink-0 text-hd-txf hover:text-hd-tx"
                        title={copied === "fp" ? "Copiado" : "Copiar"}
                        onClick={() =>
                          void handleCopy("fp", host.agent_fingerprint || "")
                        }
                      >
                        <Copy className="h-3.5 w-3.5" strokeWidth={2} />
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Eventos Recentes"
              icon={<Clock className="h-4 w-4" strokeWidth={1.75} />}
            >
              <div className="flex flex-col gap-4">
                {events.map((event) => (
                  <div key={`${event.title}-${event.detail}`} className="flex gap-3">
                    <span
                      className={`mt-1.5 h-2 w-2 flex-none rounded-full ${
                        event.tone === "ok"
                          ? "bg-hd-ok"
                          : event.tone === "warn"
                            ? "bg-hd-warn"
                            : "bg-hd-accent"
                      }`}
                    />
                    <div>
                      <div className="text-[12.5px] font-medium text-hd-tx">
                        {event.title}
                      </div>
                      <div className="mt-0.5 font-mono text-[11.5px] text-hd-txf">
                        {event.detail}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        </div>
      ) : null}

      {tab === "network" ? (
        <SectionCard
          title="Interfaces de Rede"
          icon={<Globe className="h-4 w-4" strokeWidth={1.75} />}
          trailing={
            <span className="text-xs text-hd-txf">
              {addressCount} endereço{addressCount === 1 ? "" : "s"}
            </span>
          }
        >
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {[...(ip ? [ip] : []), ...extras].map((addr, index) => (
              <div
                key={addr}
                className="flex items-center justify-between gap-2 rounded-lg border border-hd-bd bg-hd-card2 px-3 py-2.5 font-mono text-[13px] text-hd-mono"
              >
                <div className="min-w-0">
                  <div className="mb-0.5 text-[10px] font-semibold tracking-wider text-hd-txf">
                    {index === 0 && ip === addr ? "PRINCIPAL" : "INTERFACE"}
                  </div>
                  <div className="truncate">{addr}</div>
                </div>
                <button
                  type="button"
                  className="shrink-0 text-hd-txf hover:text-hd-tx"
                  onClick={() => void handleCopy(addr, addr)}
                >
                  <Copy className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              </div>
            ))}
            {addressCount === 0 ? (
              <p className="text-sm text-hd-txf">Nenhum endereço conhecido.</p>
            ) : null}
          </div>
        </SectionCard>
      ) : null}

      {tab === "telemetry" ? (
        <SectionCard
          title="Telemetria & Hardware"
          icon={<Cpu className="h-4 w-4" strokeWidth={1.75} />}
        >
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <div className="rounded-[10px] border border-hd-bd bg-hd-card2 px-4 py-3.5">
              <div className="mb-1.5 text-[10.5px] font-semibold tracking-wider text-hd-txf">
                CPU
              </div>
              <div className="font-mono text-sm">
                {host.cpu_cores != null ? `${host.cpu_cores} cores` : "—"}
              </div>
            </div>
            <div className="rounded-[10px] border border-hd-bd bg-hd-card2 px-4 py-3.5">
              <div className="mb-1.5 text-[10.5px] font-semibold tracking-wider text-hd-txf">
                MEMÓRIA
              </div>
              <div className="font-mono text-sm">{formatMemory(host.memory_bytes)}</div>
            </div>
            <div className="rounded-[10px] border border-hd-bd bg-hd-card2 px-4 py-3.5">
              <div className="mb-1.5 text-[10.5px] font-semibold tracking-wider text-hd-txf">
                SO
              </div>
              <div className="font-mono text-sm">{host.os || "—"}</div>
            </div>
          </div>
          {!host.agent_online ? (
            <div className="mt-3.5 flex gap-3 rounded-[10px] border border-[oklch(0.72_0.1_72)] bg-[oklch(0.95_0.04_72)] px-4 py-3.5 dark:border-[oklch(0.46_0.08_72)] dark:bg-[oklch(0.34_0.055_72_/_0.55)]">
              <TriangleAlert className="mt-0.5 h-4 w-4 flex-none text-[oklch(0.55_0.14_65)] dark:text-[oklch(0.86_0.13_78)]" />
              <div className="text-xs leading-normal text-hd-txm">
                Telemetria ao vivo depende do Agente. Enquanto ele estiver offline, apenas
                sondagem {probeLabel(host)} atualiza a reachability.
              </div>
            </div>
          ) : null}
        </SectionCard>
      ) : null}

      {tab === "terminal" ? <HostTerminal host={host} /> : null}
    </div>
  )
}
