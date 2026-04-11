"use client"

import { useEffect, useRef } from "react"
import { useApp } from "@/context/AppContext"
import { applyTheme, applyAccent, applyFontSize } from "@/lib/applySettings"
import { DEFAULT_SETTINGS, type AppSettings } from "@/lib/settings"

export function SettingsApplier() {
  const { rootParam, refresh, setEditorSettings, setAutoRefreshSeconds, autoRefreshSeconds } = useApp()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load + apply settings whenever the active project changes
  useEffect(() => {
    if (!rootParam) return
    let cancelled = false

    fetch(`/api/settings${rootParam}&type=settings`)
      .then(r => r.ok ? r.json() : DEFAULT_SETTINGS)
      .then((settings: AppSettings) => {
        if (cancelled) return
        applyTheme(settings.theme)
        applyAccent(settings.accentColor)
        applyFontSize(settings.fontSize)
        setEditorSettings(settings.editor)
        setAutoRefreshSeconds(settings.project?.autoRefresh ?? 0)
      })
      .catch(() => {})

    return () => { cancelled = true }
  }, [rootParam]) // eslint-disable-line react-hooks/exhaustive-deps

  // Manage polling interval reactively based on autoRefreshSeconds
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (autoRefreshSeconds > 0) {
      intervalRef.current = setInterval(refresh, autoRefreshSeconds * 1000)
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [autoRefreshSeconds, refresh])

  return null
}
