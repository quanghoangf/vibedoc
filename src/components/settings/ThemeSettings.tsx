"use client"

import { Moon, Sun, Monitor, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { SANS_FONTS, MONO_FONTS, type AppSettings } from "@/lib/settings"
import { useLang, useT } from "@/context/LanguageContext"
import type { Lang } from "@/lib/i18n"
import type { MessageKey } from "@/i18n"

interface ThemeSettingsProps {
  settings: AppSettings
  onSave: (settings: AppSettings) => void
}

const ACCENT_COLORS = [
  { id: "blue", label: "settings.blue", class: "bg-blue-500" },
  { id: "purple", label: "settings.purple", class: "bg-purple-500" },
  { id: "green", label: "settings.green", class: "bg-green-500" },
  { id: "orange", label: "settings.orange", class: "bg-orange-500" },
] as const

const FONT_SIZES = [
  { id: "small", label: "settings.small" },
  { id: "medium", label: "settings.medium" },
  { id: "large", label: "settings.large" },
] as const

// A font's note by group and id (the notes in src/lib/settings.ts stay English for other readers)
const FONT_NOTES: Record<string, MessageKey> = {
  "sans:geist": "settings.noteGeist",
  "sans:inter": "settings.noteInter",
  "sans:ibm-plex-sans": "settings.notePlexSans",
  "sans:atkinson": "settings.noteAtkinson",
  "sans:dm-sans": "settings.noteDmSans",
  "sans:system": "settings.noteSystemSans",
  "mono:geist-mono": "settings.noteGeistMono",
  "mono:jetbrains-mono": "settings.noteJetbrains",
  "mono:ibm-plex-mono": "settings.notePlexMono",
  "mono:dm-mono": "settings.noteDmMono",
  "mono:system": "settings.noteSystemMono",
}

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
        <h2 className="text-xl font-semibold text-txt mb-1">{t("settings.tabAppearance")}</h2>
        <p className="text-sm text-muted">{t("settings.appearanceHint")}</p>
      </div>

      {/* Theme */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-txt">{t("settings.theme")}</label>
        <div className="grid grid-cols-3 gap-3">
          {[
            { id: "dark", label: t("settings.dark"), icon: Moon },
            { id: "light", label: t("settings.light"), icon: Sun },
            { id: "system", label: t("settings.system"), icon: Monitor },
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
        <label className="block text-sm font-medium text-txt">{t("settings.accentColor")}</label>
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
                title={t(color.label)}
              >
                {isActive && <Check className="w-5 h-5 text-white" />}
              </button>
            )
          })}
        </div>
      </div>

      {/* Font Size */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-txt">{t("settings.fontSize")}</label>
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
                {t(size.label)}
              </button>
            )
          })}
        </div>
      </div>

      {/* Font family — each option previews in its own font */}
      {([
        { key: "fontSans", group: "sans", label: t("settings.interfaceFont"), fonts: SANS_FONTS, fallback: "system-ui", sample: t("settings.fontSample") },
        { key: "fontMono", group: "mono", label: t("settings.codeFont"), fonts: MONO_FONTS, fallback: "ui-monospace, Menlo, Consolas, monospace", sample: "const id = 0O1lI;" },
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
                  <div className={cn("mt-1 text-xs", isActive ? "text-accent font-medium" : "text-txt")}>{font.id === "system" ? t("settings.system") : font.label}</div>
                  <div className="text-xs text-muted">{FONT_NOTES[`${group.group}:${font.id}`] ? t(FONT_NOTES[`${group.group}:${font.id}`]) : font.note}</div>
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
