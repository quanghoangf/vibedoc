"use client"

import { Moon, Sun, Monitor, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { SANS_FONTS, MONO_FONTS, type AppSettings } from "@/lib/settings"
import { useLang, useT } from "@/context/LanguageContext"
import type { Lang } from "@/lib/i18n"

interface ThemeSettingsProps {
  settings: AppSettings
  onSave: (settings: AppSettings) => void
}

const ACCENT_COLORS = [
  { id: "blue", label: "Blue", class: "bg-blue-500" },
  { id: "purple", label: "Purple", class: "bg-purple-500" },
  { id: "green", label: "Green", class: "bg-green-500" },
  { id: "orange", label: "Orange", class: "bg-orange-500" },
] as const

const FONT_SIZES = [
  { id: "small", label: "Small" },
  { id: "medium", label: "Medium" },
  { id: "large", label: "Large" },
] as const

// Each language names itself, so it can be found whatever language is on (not translated)
const LANGUAGES: { id: Lang; label: string }[] = [
  { id: "en", label: "English" },
  { id: "vi", label: "Tiếng Việt" },
]

export function ThemeSettings({ settings, onSave }: ThemeSettingsProps) {
  const { lang, setLang } = useLang()
  const { t } = useT()
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-txt mb-1">Appearance</h2>
        <p className="text-sm text-muted">Customize the look and feel of the app.</p>
      </div>

      {/* Theme */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-txt">Theme</label>
        <div className="grid grid-cols-3 gap-3">
          {[
            { id: "dark", label: "Dark", icon: Moon },
            { id: "light", label: "Light", icon: Sun },
            { id: "system", label: "System", icon: Monitor },
          ].map(theme => {
            const Icon = theme.icon
            const isActive = settings.theme === theme.id
            return (
              <button
                key={theme.id}
                onClick={() => onSave({ ...settings, theme: theme.id as AppSettings["theme"] })}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-lg border transition-colors",
                  isActive
                    ? "border-accent bg-accent/10"
                    : "border-border hover:border-accent/50"
                )}
              >
                <Icon className={cn("w-5 h-5", isActive ? "text-accent" : "text-muted")} />
                <span className={cn("text-sm", isActive ? "text-accent font-medium" : "text-muted")}>
                  {theme.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Language: a per-browser cookie (R078), not part of the project's settings.json */}
      <div className="space-y-3">
        <label id="language-label" className="block text-sm font-medium text-txt">{t("shell.language")}</label>
        <div role="radiogroup" aria-labelledby="language-label" className="grid grid-cols-2 gap-3 sm:max-w-md">
          {LANGUAGES.map((l) => {
            const isActive = lang === l.id
            return (
              <button
                key={l.id}
                type="button"
                role="radio"
                aria-checked={isActive}
                lang={l.id}
                onClick={() => setLang(l.id)}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-lg border px-4 py-3 text-sm transition-colors",
                  isActive ? "border-accent bg-accent/10 font-medium text-accent" : "border-border text-muted hover:border-accent/50"
                )}
              >
                {l.label}
                {isActive && <Check className="size-4" aria-hidden />}
              </button>
            )
          })}
        </div>
        <p className="text-xs text-muted">{t("shell.languageHint")}</p>
      </div>

      {/* Accent Color */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-txt">Accent Color</label>
        <div className="flex gap-3">
          {ACCENT_COLORS.map(color => {
            const isActive = settings.accentColor === color.id
            return (
              <button
                key={color.id}
                onClick={() => onSave({ ...settings, accentColor: color.id as AppSettings["accentColor"] })}
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-transform",
                  color.class,
                  isActive ? "ring-2 ring-offset-2 ring-offset-bg ring-white scale-110" : "hover:scale-105"
                )}
                title={color.label}
              >
                {isActive && <Check className="w-5 h-5 text-white" />}
              </button>
            )
          })}
        </div>
      </div>

      {/* Font Size */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-txt">Font Size</label>
        <div className="flex gap-2">
          {FONT_SIZES.map(size => {
            const isActive = settings.fontSize === size.id
            return (
              <button
                key={size.id}
                onClick={() => onSave({ ...settings, fontSize: size.id as AppSettings["fontSize"] })}
                className={cn(
                  "px-4 py-2 rounded-lg border text-sm transition-colors",
                  isActive
                    ? "border-accent bg-accent/10 text-accent font-medium"
                    : "border-border text-muted hover:border-accent/50"
                )}
              >
                {size.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Font family — each option previews in its own font */}
      {([
        { key: "fontSans", label: "Interface Font", fonts: SANS_FONTS, fallback: "system-ui", sample: "Ship the roadmap by Friday" },
        { key: "fontMono", label: "Code Font", fonts: MONO_FONTS, fallback: "ui-monospace, Menlo, Consolas, monospace", sample: "const id = 0O1lI;" },
      ] as const).map(group => (
        <div key={group.key} className="space-y-3">
          <label className="block text-sm font-medium text-txt">{group.label}</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {group.fonts.map(font => {
              const isActive = settings[group.key] === font.id
              return (
                <button
                  key={font.id}
                  onClick={() => onSave({ ...settings, [group.key]: font.id })}
                  className={cn(
                    "text-left p-3 rounded-lg border transition-colors",
                    isActive ? "border-accent bg-accent/10" : "border-border hover:border-accent/50"
                  )}
                >
                  <div
                    className="text-base text-txt truncate"
                    style={{ fontFamily: font.id === "system" ? group.fallback : `var(--font-${font.id})` }}
                  >
                    {group.sample}
                  </div>
                  <div className={cn("mt-1 text-xs", isActive ? "text-accent font-medium" : "text-txt")}>{font.label}</div>
                  <div className="text-xs text-muted">{font.note}</div>
                  {lang === "vi" && "noVietnamese" in font && <div className="mt-1 text-xs text-amber">{t("shell.fontNoVietnamese")}</div>}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
