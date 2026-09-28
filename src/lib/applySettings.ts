import { DEFAULT_SETTINGS, type AppSettings } from "./settings"

export function applyTheme(theme: AppSettings["theme"]) {
  const html = document.documentElement
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
  const useDark = theme === "dark" || (theme === "system" && prefersDark)
  html.classList.toggle("dark", useDark)
}

export function applyAccent(accent: AppSettings["accentColor"]) {
  document.documentElement.setAttribute("data-accent", accent)
}

export function applyFontSize(size: AppSettings["fontSize"]) {
  document.documentElement.setAttribute("data-font-size", size)
}

// Settings saved before fonts existed have no fontSans/fontMono — fall back to defaults.
export function applyFonts(settings: Pick<AppSettings, "fontSans" | "fontMono">) {
  const html = document.documentElement
  html.setAttribute("data-font-sans", settings.fontSans ?? DEFAULT_SETTINGS.fontSans)
  html.setAttribute("data-font-mono", settings.fontMono ?? DEFAULT_SETTINGS.fontMono)
}
