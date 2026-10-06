"use client"

import { cn } from "@/lib/utils"
import type { AppSettings } from "@/lib/settings"
import { useT } from "@/context/LanguageContext"

interface ProjectSettingsProps {
  settings: AppSettings
  onSave: (settings: AppSettings) => void
}

const REFRESH_OPTIONS = [
  { value: 0 },
  { value: 5 },
  { value: 10 },
  { value: 30 },
]

export function ProjectSettings({ settings, onSave }: ProjectSettingsProps) {
  const { t } = useT()
  const updateProject = (key: keyof AppSettings["project"], value: unknown) => {
    onSave({
      ...settings,
      project: { ...settings.project, [key]: value },
    })
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-txt mb-1">{t("settings.tabProject")}</h2>
        <p className="text-sm text-muted">{t("settings.projectHint")}</p>
      </div>

      {/* Auto-refresh */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-txt">{t("settings.autoRefresh")}</label>
        <p className="text-xs text-muted">{t("settings.autoRefreshHint")}</p>
        <div className="flex flex-wrap gap-2">
          {REFRESH_OPTIONS.map(option => {
            const isActive = settings.project.autoRefresh === option.value
            return (
              <button
                key={option.value}
                onClick={() => updateProject("autoRefresh", option.value)}
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

      {/* Show Hidden Files */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-txt">{t("settings.showHidden")}</div>
          <div className="text-xs text-muted">{t("settings.showHiddenHint")}</div>
        </div>
        <button
          onClick={() => updateProject("showHidden", !settings.project.showHidden)}
          className={cn(
            "w-11 h-6 rounded-full transition-colors relative",
            settings.project.showHidden ? "bg-accent" : "bg-border"
          )}
        >
          <span
            className={cn(
              "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
              settings.project.showHidden ? "left-6" : "left-1"
            )}
          />
        </button>
      </div>
    </div>
  )
}
