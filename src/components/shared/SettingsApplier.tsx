"use client"

import { useEffect, useRef } from "react"
import { useApp } from "@/context/AppContext"
import { applyTheme, applyAccent, applyFontSize, applyFonts } from "@/lib/applySettings"
import { DEFAULT_SETTINGS, type AppSettings } from "@/lib/settings"

export function SettingsApplier() {
  const { rootParam, refresh, setEditorSettings, setAutoRefreshSeconds, autoRefreshSeconds } = useApp()
  const busyRef = useRef(false)

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
        applyFonts(settings)
        setEditorSettings(settings.editor)
        setAutoRefreshSeconds(settings.project?.autoRefresh ?? 0)
      })
      .catch(() => {})

    return () => { cancelled = true }
  }, [rootParam]) // eslint-disable-line react-hooks/exhaustive-deps

  // Poll every autoRefreshSeconds while the tab is visible. A tick never starts a refresh while the last one still
  // runs: on a slow project the polls stacked up and every request waited.
  useEffect(() => {
    if (autoRefreshSeconds <= 0) return
    const interval = setInterval(() => {
      if (document.hidden || busyRef.current) return
      busyRef.current = true
      refresh().finally(() => { busyRef.current = false })
    }, autoRefreshSeconds * 1000)
    return () => clearInterval(interval)
  }, [autoRefreshSeconds, refresh])

  return null
}
