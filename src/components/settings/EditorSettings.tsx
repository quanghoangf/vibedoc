"use client"

import { cn } from "@/lib/utils"
import type { AppSettings } from "@/lib/settings"

interface EditorSettingsProps {
  settings: AppSettings
  onSave: (settings: AppSettings) => void
}

const AUTO_SAVE_OPTIONS = [
  { value: 0, label: "Off" },
  { value: 5, label: "5 seconds" },
  { value: 10, label: "10 seconds" },
  { value: 30, label: "30 seconds" },
]

const PREVIEW_MODES = [
  { id: "split", label: "Split View" },
  { id: "tab", label: "Tab View" },
  { id: "preview", label: "Preview Only" },
] as const

export function EditorSettings({ settings, onSave }: EditorSettingsProps) {
  const updateEditor = (key: keyof AppSettings["editor"], value: unknown) => {
    onSave({
      ...settings,
      editor: { ...settings.editor, [key]: value },
    })
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-txt mb-1">Editor</h2>
        <p className="text-sm text-muted">Configure the markdown editor behavior.</p>
      </div>

      {/* Auto-save */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-txt">Auto-save</label>
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
                {option.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Preview Mode */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-txt">Preview Mode</label>
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
                {mode.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Toggles */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-txt">Word Wrap</div>
            <div className="text-xs text-muted">Wrap long lines in the editor</div>
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
            <div className="text-sm font-medium text-txt">Line Numbers</div>
            <div className="text-xs text-muted">Show line numbers in the editor</div>
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
