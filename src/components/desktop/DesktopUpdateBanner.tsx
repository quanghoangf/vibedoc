"use client"

import { useEffect, useReducer, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { MarkdownRenderer } from "@/components/docs/MarkdownRenderer"
import { useChats } from "@/context/ChatContext"
import { useFormat, useT } from "@/context/LanguageContext"
import { NO_UPDATE, nextUpdateState, releasePage, type DesktopUpdate, type UpdateEvent } from "@/lib/desktop-update"

/** What the desktop app's preload (desktop/preload.cjs) exposes; absent in a browser tab. */
export interface VibedocDesktop {
  getUpdate(): Promise<DesktopUpdate | null>
  onUpdateEvent(cb: (event: UpdateEvent) => void): () => void
  checkForUpdates(): Promise<void>
  dismissUpdate(version: string): Promise<void>
  downloadUpdate(): Promise<void>
  installUpdate(): Promise<void>
}

declare global {
  interface Window { vibedocDesktop?: VibedocDesktop }
}

const btn = "rounded-md border border-border px-2.5 py-1 text-xs text-txt hover:bg-surface"
const primary = "rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-white hover:opacity-90"

/**
 * R112 T582/T583: inside the desktop app only, a small non-modal card when a newer VibeDoc is out (states in
 * src/lib/desktop-update.ts): Update → download progress → Restart to update; a failure links to the release page.
 * What's new shows the notes, Later hides that version (kept by the app, not the browser). Nothing in a browser.
 */
export function DesktopUpdateBanner() {
  const { t } = useT()
  const fmt = useFormat()
  const { runningCount } = useChats()
  const [state, dispatch] = useReducer(nextUpdateState, NO_UPDATE)
  const [notesOpen, setNotesOpen] = useState(false)

  useEffect(() => {
    const desktop = window.vibedocDesktop
    // the app may show a VibeDoc of another version (a terminal install): a preload without this API shows nothing
    if (typeof desktop?.onUpdateEvent !== "function" || typeof desktop.getUpdate !== "function") return
    let live = true
    desktop.getUpdate().then((update) => { if (live && update) dispatch({ type: "available", update }) }).catch(() => {})
    const off = desktop.onUpdateEvent(dispatch)
    return () => { live = false; off() }
  }, [])

  if (state.phase === "none") return null
  const { update } = state
  const later = () => {
    window.vibedocDesktop?.dismissUpdate(update.version).catch(() => {})
    dispatch({ type: "dismiss" })
    setNotesOpen(false)
  }
  const download = () => {
    dispatch({ type: "download" })
    window.vibedocDesktop?.downloadUpdate().catch((e) => dispatch({ type: "error", message: String(e) }))
  }
  const restart = () => {
    if (runningCount > 0 && !window.confirm(t("desktop.confirmRestart"))) return
    window.vibedocDesktop?.installUpdate().catch((e) => dispatch({ type: "error", message: String(e) }))
  }
  const vars = { version: update.version }
  return (
    <>
      <section
        role="region"
        aria-label={t("desktop.updateLabel")}
        data-desktop-update={update.version}
        data-update-phase={state.phase}
        className="fixed inset-x-4 bottom-4 z-40 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface2 px-3 py-2 shadow-xl sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:max-w-md"
      >
        {state.phase === "available" && (
          <>
            <p className="mr-auto text-xs font-medium text-txt">{t("desktop.updateAvailable", vars)}</p>
            <button type="button" onClick={later} className={btn}>{t("desktop.later")}</button>
            <button type="button" onClick={() => setNotesOpen(true)} className={btn}>{t("desktop.whatsNew")}</button>
            <button type="button" onClick={download} className={primary}>{t("desktop.update")}</button>
          </>
        )}
        {state.phase === "downloading" && (
          <div className="w-full min-w-56" role="status">
            <p className="text-xs font-medium text-txt">{t("desktop.downloading", { ...vars, percent: state.percent })}</p>
            <div className="mt-1.5 h-1 overflow-hidden rounded bg-border" aria-hidden>
              <div className="h-full bg-accent transition-[width]" style={{ width: `${state.percent}%` }} />
            </div>
          </div>
        )}
        {state.phase === "ready" && (
          <>
            <p className="mr-auto text-xs font-medium text-txt">{t("desktop.ready", vars)}</p>
            <button type="button" onClick={restart} className={primary}>{t("desktop.restart")}</button>
          </>
        )}
        {state.phase === "failed" && (
          <>
            <p className="mr-auto text-xs font-medium text-txt" title={state.message}>{t("desktop.failed", vars)}</p>
            <button type="button" onClick={download} className={btn}>{t("desktop.tryAgain")}</button>
            <a href={releasePage(update.version)} target="_blank" rel="noopener noreferrer" className={primary}>{t("desktop.downloadPage")}</a>
          </>
        )}
      </section>
      <Dialog open={notesOpen} onOpenChange={setNotesOpen}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto bg-surface border-border text-txt">
          <DialogTitle className="text-sm font-semibold text-txt">{t("desktop.notesTitle", vars)}</DialogTitle>
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
            <button type="button" onClick={() => { setNotesOpen(false); download() }} className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90">
              {t("desktop.update")}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
