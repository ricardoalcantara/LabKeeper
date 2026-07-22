import { useEffect } from "react"
import { Box, LogOut } from "lucide-react"
import { NavLink, Outlet } from "react-router-dom"
import { InventoryTreeProvider } from "../lib/inventoryTree"
import { isAuthenticated, loadSession, logout, startLogin } from "../lib/oidc"
import { SidebarTree } from "./SidebarTree"
import { ThemeToggle } from "./ThemeToggle"

export function AppShell() {
  useEffect(() => {
    if (!isAuthenticated()) {
      void startLogin().catch((error) => {
        console.error("auto login redirect failed", error)
      })
    }
  }, [])

  if (!isAuthenticated()) {
    return (
      <div className="flex h-full items-center justify-center text-zinc-600 dark:text-zinc-400">
        Redirecting to sign in…
      </div>
    )
  }

  const session = loadSession()
  const userinfo = session.userinfo as
    | { name?: string; email?: string; preferred_username?: string; username?: string }
    | undefined
  const displayName =
    userinfo?.name || userinfo?.preferred_username || userinfo?.username || userinfo?.email || "Signed in"

  return (
    <InventoryTreeProvider>
      <div className="flex h-full flex-col bg-zinc-50 dark:bg-neutral-950">
        <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-zinc-200/80 bg-zinc-50 px-4 dark:border-neutral-800 dark:bg-neutral-950">
          <NavLink
            to="/labkeeper"
            className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-800 no-underline dark:text-neutral-100"
          >
            <Box className="h-4 w-4" strokeWidth={1.75} />
            LabKeeper Admin
          </NavLink>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-zinc-500 sm:inline dark:text-neutral-400">{displayName}</span>
            <ThemeToggle />
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-zinc-700 hover:bg-zinc-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
              onClick={() => void logout()}
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} />
              Sign out
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <aside className="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
            <SidebarTree />
          </aside>
          <main className="min-w-0 flex-1 overflow-auto bg-white p-5 dark:bg-neutral-950">
            <Outlet />
          </main>
        </div>
      </div>
    </InventoryTreeProvider>
  )
}
