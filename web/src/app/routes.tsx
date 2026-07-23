import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom"
import { AppShell } from "../components/AppShell"
import { HostDetail } from "../components/HostDetail"
import { LabKeeperDetail } from "../components/LabKeeperDetail"
import { SiteDetail } from "../components/SiteDetail"
import { CallbackPage } from "../pages/CallbackPage"
import { LoginPage } from "../pages/LoginPage"
import { isAuthenticated, startLogin } from "../lib/oidc"
import { useEffect } from "react"

function RootRedirect() {
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

  return <Navigate to="/labkeeper" replace />
}

function LegacyHostRedirect() {
  const { hostId } = useParams<{ hostId: string }>()
  return <Navigate to={hostId ? `/hosts/${hostId}` : "/labkeeper"} replace />
}

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/callback" element={<CallbackPage />} />
        <Route path="/" element={<RootRedirect />} />
        <Route element={<AppShell />}>
          <Route path="/labkeeper" element={<LabKeeperDetail />} />
          <Route path="/credentials" element={<Navigate to="/labkeeper" replace />} />
          <Route path="/sites/:siteId" element={<SiteDetail />} />
          <Route path="/hosts/:hostId" element={<HostDetail />} />
          <Route path="/sites/:siteId/hosts/:hostId" element={<LegacyHostRedirect />} />
          <Route path="/inventory" element={<Navigate to="/labkeeper" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
