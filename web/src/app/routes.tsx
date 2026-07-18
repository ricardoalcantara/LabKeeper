import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { CallbackPage } from "../pages/CallbackPage"
import { CredentialsPage } from "../pages/CredentialsPage"
import { HomePage } from "../pages/HomePage"
import { LoginPage } from "../pages/LoginPage"

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/inventory" element={<Navigate to="/" replace />} />
        <Route path="/credentials" element={<CredentialsPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/callback" element={<CallbackPage />} />
      </Routes>
    </BrowserRouter>
  )
}
