"use client"

import { cn } from "@/lib/utils"
import type { AppSettings } from "@/lib/settings"

interface ProjectSettingsProps {
  settings: AppSettings
  onSave: (settings: AppSettings) => void
}

const REFRESH_OPTIONS = [
  { value: 0, label: "Off" },
  { value: 5, label: "5 seconds" },
  { value: 10, label: "10 seconds" },
  { value: 30, label: "30 seconds" },
]

export function ProjectSettings({ settings, onSave }: ProjectSettingsProps) {
  const updateProject = (key: keyof AppSettings["project"], value: unknown) => {
    onSave({
      ...settings,
      project: { ...settings.project, [key]: value },
    })
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-txt mb-1">Project</h2>
        <p className="text-sm text-muted">Configure project-level settings.</p>
      </div>

      {/* Auto-refresh */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-txt">Auto-refresh Interval</label>
        <p className="text-xs text-muted">How often to check for changes in the project files.</p>
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
                {option.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Show Hidden Files */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-txt">Show Hidden Files</div>
          <div className="text-xs text-muted">Display files starting with a dot</div>
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
