import { useEffect, useRef, useState } from "react"
import { Terminal } from "@xterm/xterm"
import { FitAddon } from "@xterm/addon-fit"
import { WebLinksAddon } from "@xterm/addon-web-links"
import { RefreshCw, TerminalSquare } from "lucide-react"
import "@xterm/xterm/css/xterm.css"
import {
  createTerminalTicket,
  terminalWebSocketURL,
  type Host,
  type TerminalMode,
  type TerminalPath,
} from "../lib/api"
import { getResolvedTheme } from "../lib/theme"
import { SessionExpiredError } from "../lib/oidc"

type Props = {
  host: Host
}

function hostHasDialTarget(host: Host): boolean {
  if (host.address?.trim()) {
    return true
  }
  return (host.ips ?? []).some((ip) => ip && !ip.includes(":"))
}

function xtermTheme(dark: boolean) {
  if (dark) {
    return {
      background: "#1e1f21",
      foreground: "#e4e4e7",
      cursor: "#e4e4e7",
      selectionBackground: "#3f3f46",
    }
  }
  return {
    background: "#18181b",
    foreground: "#f4f4f5",
    cursor: "#f4f4f5",
    selectionBackground: "#52525b",
  }
}

export function HostTerminal({ host }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const [mode, setMode] = useState<TerminalMode>("auto")
  const [activePath, setActivePath] = useState<TerminalPath | null>(null)
  const [status, setStatus] = useState<"idle" | "connecting" | "open" | "closed">("idle")
  const [error, setError] = useState<string | null>(null)
  const [sessionKey, setSessionKey] = useState(0)

  const agentAvailable = host.agent_online
  const sshAvailable = Boolean(host.credential_id) && hostHasDialTarget(host)
  const anyAvailable = agentAvailable || sshAvailable

  useEffect(() => {
    const el = containerRef.current
    if (!el || !anyAvailable) {
      return
    }

    const dark = getResolvedTheme() === "dark"
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      fontSize: 13,
      theme: xtermTheme(dark),
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.loadAddon(new WebLinksAddon())
    term.open(el)
    fit.fit()
    term.focus()

    termRef.current = term
    fitRef.current = fit

    let disposed = false
    let ro: ResizeObserver | null = null

    const connect = async () => {
      setStatus("connecting")
      setError(null)
      setActivePath(null)
      try {
        fit.fit()
        const cols = term.cols
        const rows = term.rows
        const ticket = await createTerminalTicket({
          hostId: host.id,
          cols,
          rows,
          mode,
        })
        if (disposed) {
          return
        }
        setActivePath(ticket.path)

        const ws = new WebSocket(terminalWebSocketURL(ticket.ticket))
        ws.binaryType = "arraybuffer"
        wsRef.current = ws

        ws.onopen = () => {
          // Ignore events from a session that already cleaned up (mode switch / reconnect).
          if (disposed || wsRef.current !== ws) {
            ws.close()
            return
          }
          setStatus("open")
          term.writeln(`\x1b[90mConnected via ${ticket.path}\x1b[0m`)
        }

        ws.onmessage = (event) => {
          if (disposed || wsRef.current !== ws) {
            return
          }
          if (typeof event.data === "string") {
            try {
              const parsed = JSON.parse(event.data) as { type?: string; message?: string }
              if (parsed.type === "error" && parsed.message) {
                setError(parsed.message)
                term.writeln(`\r\n\x1b[31m${parsed.message}\x1b[0m`)
              }
            } catch {
              term.write(event.data)
            }
            return
          }
          term.write(new Uint8Array(event.data as ArrayBuffer))
        }

        ws.onerror = () => {
          if (disposed || wsRef.current !== ws) {
            return
          }
          setError("WebSocket error")
        }

        // Old socket onclose often fires after the new session is already open when
        // switching SSH ↔ Agent; only update status for the active socket.
        ws.onclose = () => {
          if (disposed || wsRef.current !== ws) {
            return
          }
          setStatus("closed")
          wsRef.current = null
        }

        term.onData((data) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(new TextEncoder().encode(data))
          }
        })

        term.onResize(({ cols: c, rows: r }) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "resize", cols: c, rows: r }))
          }
        })

        ro = new ResizeObserver(() => {
          requestAnimationFrame(() => {
            if (!disposed) {
              fit.fit()
            }
          })
        })
        ro.observe(el)
      } catch (err) {
        if (disposed || err instanceof SessionExpiredError) {
          return
        }
        setStatus("closed")
        setError(err instanceof Error ? err.message : "Failed to connect")
        term.writeln(
          `\r\n\x1b[31m${err instanceof Error ? err.message : "Failed to connect"}\x1b[0m`,
        )
      }
    }

    void connect()

    return () => {
      disposed = true
      ro?.disconnect()
      const ws = wsRef.current
      wsRef.current = null
      if (ws) {
        // Drop handlers before close so a late onclose cannot flip status to "closed"
        // after the next effect has already set "connecting"/"open".
        ws.onopen = null
        ws.onmessage = null
        ws.onerror = null
        ws.onclose = null
        if (
          ws.readyState === WebSocket.CONNECTING ||
          ws.readyState === WebSocket.OPEN
        ) {
          ws.close()
        }
      }
      term.dispose()
      termRef.current = null
      fitRef.current = null
    }
  }, [host.id, mode, sessionKey, anyAvailable])

  if (!anyAvailable) {
    return (
      <div className="rounded-xl border border-hd-bd bg-hd-card px-5 py-6 text-sm text-hd-txm">
        <p className="m-0 font-medium text-hd-tx">Console indisponível</p>
        <p className="mt-2 mb-0">
          Conecte o Agente neste host, ou configure endereço + credencial para SSH
          direto.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-[12px] text-hd-txm" htmlFor="terminal-mode">
            Caminho
          </label>
          <select
            id="terminal-mode"
            className="rounded-md border border-hd-bd bg-hd-card2 px-2.5 py-1.5 text-[13px] text-hd-tx"
            value={mode}
            onChange={(e) => setMode(e.target.value as TerminalMode)}
          >
            <option value="auto">Auto</option>
            <option value="agent" disabled={!agentAvailable}>
              Agente{!agentAvailable ? " (offline)" : ""}
            </option>
            <option value="ssh" disabled={!sshAvailable}>
              SSH{!sshAvailable ? " (sem credencial/endereço)" : ""}
            </option>
          </select>
          {activePath ? (
            <span className="rounded-md border border-hd-bd bg-hd-card2 px-2 py-1 font-mono text-[11px] text-hd-txm">
              via {activePath}
            </span>
          ) : null}
          <span className="font-mono text-[11px] text-hd-txf">
            {status === "connecting"
              ? "conectando…"
              : status === "open"
                ? "conectado"
                : status === "closed"
                  ? "desconectado"
                  : ""}
          </span>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-hd-bd bg-hd-card2 px-2.5 py-1.5 text-[12.5px] text-hd-tx hover:bg-hd-card"
          onClick={() => {
            setSessionKey((k) => k + 1)
          }}
        >
          <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} />
          Reconectar
        </button>
      </div>

      {error ? <p className="m-0 text-sm text-hd-danger">{error}</p> : null}

      <div className="overflow-hidden rounded-xl border border-hd-bd bg-[#18181b]">
        <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2 text-[11px] text-zinc-400">
          <TerminalSquare className="h-3.5 w-3.5" strokeWidth={1.75} />
          Console
        </div>
        <div
          ref={containerRef}
          className="h-[min(70vh,40rem)] min-h-[28rem] w-full p-2"
        />
      </div>
    </div>
  )
}
