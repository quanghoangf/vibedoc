"use client"

import { Moon, Sun, Monitor, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AppSettings } from "@/lib/settings"

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

export function ThemeSettings({ settings, onSave }: ThemeSettingsProps) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-txt mb-1">Appearance</h2>
        <p className="text-sm text-muted">Customize the look and feel of the app.</p>
      </div>

      {/* Theme */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-txt">Theme</label>
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
                  "flex flex-col items-center gap-2 p-4 rounded-lg border transition-all",
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

      {/* Accent Color */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-txt">Accent Color</label>
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
        <label className="text-sm font-medium text-txt">Font Size</label>
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
    </div>
  )
}
