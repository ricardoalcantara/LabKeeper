import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"
import { getResolvedTheme, toggleTheme, type Theme } from "../lib/theme"

export function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>(() =>
    typeof document === "undefined" ? "light" : getResolvedTheme(),
  )

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => {
      if (!localStorage.getItem("labkeeper_theme")) {
        setThemeState(getResolvedTheme())
      }
    }
    media.addEventListener("change", onChange)
    return () => media.removeEventListener("change", onChange)
  }, [])

  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-zinc-700 hover:bg-zinc-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      title={theme === "dark" ? "Light theme" : "Dark theme"}
      onClick={() => setThemeState(toggleTheme())}
    >
      {theme === "dark" ? <Sun className="h-3.5 w-3.5" strokeWidth={1.75} /> : <Moon className="h-3.5 w-3.5" strokeWidth={1.75} />}
      <span>{theme === "dark" ? "Light" : "Dark"}</span>
    </button>
  )
}
