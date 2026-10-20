"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { MarkdownRenderer } from "@/components/docs/MarkdownRenderer"
import { useFormat, useT } from "@/context/LanguageContext"

/** A newer version the desktop app found (desktop/updater.mjs). */
export interface DesktopUpdate { version: string; notes: string; date: string | null }

/** What the desktop app's preload (desktop/preload.cjs) exposes; absent in a browser tab. */
export interface VibedocDesktop {
  getUpdate(): Promise<DesktopUpdate | null>
  onUpdate(cb: (update: DesktopUpdate) => void): () => void
  checkForUpdates(): Promise<void>
  dismissUpdate(version: string): Promise<void>
}

declare global {
  interface Window { vibedocDesktop?: VibedocDesktop }
}

/**
 * R112 T582: inside the desktop app only, a small non-modal card when a newer VibeDoc is out: What's new (the release
 * notes in a dialog) and Later (hides that version, kept by the app, not the browser). Renders nothing in a browser.
 */
export function DesktopUpdateBanner() {
  const { t } = useT()
  const fmt = useFormat()
  const [update, setUpdate] = useState<DesktopUpdate | null>(null)
  const [notesOpen, setNotesOpen] = useState(false)

  useEffect(() => {
    const desktop = window.vibedocDesktop
    if (!desktop) return
    let live = true
    desktop.getUpdate().then((u) => { if (live && u) setUpdate(u) }).catch(() => {})
    const off = desktop.onUpdate((u) => setUpdate(u))
    return () => { live = false; off() }
  }, [])

  if (!update) return null
  const later = () => {
    window.vibedocDesktop?.dismissUpdate(update.version).catch(() => {})
    setUpdate(null)
    setNotesOpen(false)
  }
  return (
    <>
      <section
        role="region"
        aria-label={t("desktop.updateLabel")}
        data-desktop-update={update.version}
        className="fixed inset-x-4 bottom-4 z-40 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface2 px-3 py-2 shadow-xl sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:max-w-md"
      >
        <p className="mr-auto text-xs font-medium text-txt">{t("desktop.updateAvailable", { version: update.version })}</p>
        <button type="button" onClick={later} className="rounded-md border border-border px-2.5 py-1 text-xs text-txt hover:bg-surface">
          {t("desktop.later")}
        </button>
        <button type="button" onClick={() => setNotesOpen(true)} className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-white hover:opacity-90">
          {t("desktop.whatsNew")}
        </button>
      </section>
      <Dialog open={notesOpen} onOpenChange={setNotesOpen}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto bg-surface border-border text-txt">
          <DialogTitle className="text-sm font-semibold text-txt">{t("desktop.notesTitle", { version: update.version })}</DialogTitle>
          <DialogDescription className="text-xs text-muted">
            {update.date ? t("desktop.released", { date: fmt.date(update.date, { dateStyle: "medium" }) }) : ""}
          </DialogDescription>
          {update.notes
            ? <div data-user-content><MarkdownRenderer content={update.notes} /></div>
            : <p className="text-xs text-muted">{t("desktop.noNotes")}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={later} className="rounded-md border border-border px-3 py-1.5 text-xs text-txt hover:bg-surface">
              {t("desktop.later")}
            </button>
            <button type="button" onClick={() => setNotesOpen(false)} className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90">
              {t("desktop.close")}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
