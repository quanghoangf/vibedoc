"use client"

import { cn } from "@/lib/utils"
import type { AppSettings } from "@/lib/settings"
import { useT } from "@/context/LanguageContext"

interface EditorSettingsProps {
  settings: AppSettings
  onSave: (settings: AppSettings) => void
}

const AUTO_SAVE_OPTIONS = [
  { value: 0 },
  { value: 5 },
  { value: 10 },
  { value: 30 },
]

const PREVIEW_MODES = [
  { id: "split", label: "settings.splitView" },
  { id: "tab", label: "settings.tabView" },
  { id: "preview", label: "settings.previewOnly" },
] as const

export function EditorSettings({ settings, onSave }: EditorSettingsProps) {
  const { t } = useT()
  const updateEditor = (key: keyof AppSettings["editor"], value: unknown) => {
    onSave({
      ...settings,
      editor: { ...settings.editor, [key]: value },
    })
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-txt mb-1">{t("settings.tabEditor")}</h2>
        <p className="text-sm text-muted">{t("settings.editorHint")}</p>
      </div>

      {/* Auto-save */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-txt">{t("settings.autoSave")}</label>
        <div className="flex flex-wrap gap-2">
          {AUTO_SAVE_OPTIONS.map(option => {
            const isActive = settings.editor.autoSave === option.value
            return (
              <button
                key={option.value}
                onClick={() => updateEditor("autoSave", option.value)}
                className={cn(
                  "px-4 py-2 rounded-lg border text-sm transition-colors",
                  isActive
                    ? "border-accent bg-accent/10 text-accent font-medium"
                    : "border-border text-muted hover:border-accent/50"
                )}
              >
                {option.value ? t("settings.seconds", { n: option.value }) : t("settings.off")}
              </button>
            )
          })}
        </div>
      </div>

      {/* Preview Mode */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-txt">{t("settings.previewMode")}</label>
        <div className="flex flex-wrap gap-2">
          {PREVIEW_MODES.map(mode => {
            const isActive = settings.editor.previewMode === mode.id
            return (
              <button
                key={mode.id}
                onClick={() => updateEditor("previewMode", mode.id)}
                className={cn(
                  "px-4 py-2 rounded-lg border text-sm transition-colors",
                  isActive
                    ? "border-accent bg-accent/10 text-accent font-medium"
                    : "border-border text-muted hover:border-accent/50"
                )}
              >
                {t(mode.label)}
              </button>
            )
          })}
        </div>
      </div>

      {/* Toggles */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-txt">{t("settings.wordWrap")}</div>
            <div className="text-xs text-muted">{t("settings.wordWrapHint")}</div>
          </div>
          <button
            onClick={() => updateEditor("wordWrap", !settings.editor.wordWrap)}
            className={cn(
              "w-11 h-6 rounded-full transition-colors relative",
              settings.editor.wordWrap ? "bg-accent" : "bg-border"
            )}
          >
            <span
              className={cn(
                "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
                settings.editor.wordWrap ? "left-6" : "left-1"
              )}
            />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-txt">{t("settings.lineNumbers")}</div>
            <div className="text-xs text-muted">{t("settings.lineNumbersHint")}</div>
          </div>
          <button
            onClick={() => updateEditor("lineNumbers", !settings.editor.lineNumbers)}
            className={cn(
              "w-11 h-6 rounded-full transition-colors relative",
              settings.editor.lineNumbers ? "bg-accent" : "bg-border"
            )}
          >
            <span
              className={cn(
                "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
                settings.editor.lineNumbers ? "left-6" : "left-1"
              )}
            />
          </button>
        </div>
      </div>
    </div>
  )
}
