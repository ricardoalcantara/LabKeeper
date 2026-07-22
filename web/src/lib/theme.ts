const STORAGE_KEY = "labkeeper_theme"

export type Theme = "light" | "dark"

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export function getStoredTheme(): Theme | null {
  const value = localStorage.getItem(STORAGE_KEY)
  if (value === "light" || value === "dark") {
    return value
  }
  return null
}

export function getResolvedTheme(): Theme {
  return getStoredTheme() ?? systemTheme()
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  root.classList.toggle("dark", theme === "dark")
  root.style.colorScheme = theme
}

export function initTheme(): Theme {
  const theme = getResolvedTheme()
  applyTheme(theme)
  return theme
}

export function setTheme(theme: Theme): void {
  localStorage.setItem(STORAGE_KEY, theme)
  applyTheme(theme)
}

export function toggleTheme(): Theme {
  const next: Theme = getResolvedTheme() === "dark" ? "light" : "dark"
  setTheme(next)
  return next
}
