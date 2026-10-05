"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { ArrowLeft, CircleHelp } from "lucide-react"
import { GLOBAL_HELP_KEYS, SHORTCUT_SECTIONS, helpFor } from "@/lib/shortcuts"
import { cn } from "@/lib/utils"

const KBD = "inline-block whitespace-nowrap rounded-sm border border-border2 bg-surface2 px-1.5 py-0.5 font-mono text-[11px] leading-none text-txt"
// Long enough to move the pointer from the button onto the panel without it closing
const CLOSE_DELAY_MS = 180

/**
 * Help, bottom-right on every page (replaces the kbd strips on records and the old `?` dialog): hovering peeks at
 * this page's keys and tips, clicking (or `?`, the sidebar's Shortcuts, ⌘K → Keyboard shortcuts) pins it until
 * Esc, a click outside or the button again. "All shortcuts" swaps in the full list.
 * A plain region, never role=dialog: pages (Test review) stop their keys while a dialog is open, and a peek
 * must not do that.
 */
export function HelpLauncher({ pinned, onPinnedChange }: { pinned: boolean; onPinnedChange: (pinned: boolean) => void }) {
  const pathname = usePathname()
  const [hover, setHover] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const open = pinned || hover

  // Pinned: a click outside closes it; focus moves in so Tab reaches "All shortcuts"
  useEffect(() => {
    if (!pinned) return
    panel.current?.focus({ preventScroll: true })
    const onDown = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) onPinnedChange(false) }
    // Esc closes Help before a page sees it (Test review's capture listener would close its task instead).
    // Pages re-add their listener on every render, so this earlier one runs first.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      e.preventDefault()
      e.stopImmediatePropagation()
      // focus was in the panel: back to the button, not to the top of the page
      if (root.current?.contains(document.activeElement)) button.current?.focus({ preventScroll: true })
      onPinnedChange(false)
    }
    document.addEventListener("pointerdown", onDown)
    window.addEventListener("keydown", onKey, true)
    return () => {
      document.removeEventListener("pointerdown", onDown)
      window.removeEventListener("keydown", onKey, true)
    }
  }, [pinned, onPinnedChange])

  const enter = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setHover(true)
  }
  const leave = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return
    closeTimer.current = setTimeout(() => setHover(false), CLOSE_DELAY_MS)
  }
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current) }, [])

  return (
    <div ref={root} onPointerEnter={enter} onPointerLeave={leave} className="fixed right-4 bottom-4 z-40 flex flex-col items-end gap-2 max-sm:right-3 max-sm:bottom-3">
      {open && (
        <div
          ref={panel}
          id="help-panel"
          role="region"
          aria-label="Help"
          tabIndex={-1}
          className="animate-slide-in flex max-h-[min(70vh,34rem)] w-80 max-w-[calc(100vw-1.5rem)] flex-col overflow-y-auto overscroll-contain rounded-xl border border-border bg-surface p-4 text-xs shadow-2xl outline-none"
        >
          {/* Keyed by page: closing or navigating unmounts it, so it reopens on this page's help */}
          <PanelBody key={pathname} pathname={pathname} />
        </div>
      )}
      <button
        ref={button}
        type="button"
        onClick={() => onPinnedChange(!pinned)}
        aria-expanded={open}
        aria-controls={open ? "help-panel" : undefined}
        aria-keyshortcuts="?"
        aria-label="Help and shortcuts (?)"
        className={cn(
          "flex size-9 items-center justify-center rounded-full border bg-surface text-muted shadow-lg transition-colors duration-(--duration-fast) hover:text-txt focus-visible:outline-2 focus-visible:outline-accent",
          pinned ? "border-accent/60 text-txt" : "border-border hover:border-border2",
        )}
      >
        <CircleHelp className="size-4.5" aria-hidden />
      </button>
    </div>
  )
}

function KeyTable({ title, rows }: { title: string; rows: readonly { key: string; label: string }[] }) {
  return (
    <table className="mt-3 w-full">
      <caption className="pb-1 text-left font-mono text-[10px] uppercase tracking-[0.06em] text-muted">{title}</caption>
      <tbody>
        {rows.map(({ key, label }) => (
          <tr key={`${key}:${label}`} className="border-t border-border first:border-0">
            <td className="w-16 py-1.5 pr-3 align-top"><kbd className={KBD}>{key}</kbd></td>
            <td className="py-1.5 text-muted">{label}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function PanelBody({ pathname }: { pathname: string }) {
  const help = helpFor(pathname)
  const [all, setAll] = useState(false)
  if (all) {
    return (
      <>
        <button type="button" onClick={() => setAll(false)} className="mb-3 inline-flex items-center gap-1 self-start text-muted hover:text-txt focus-visible:outline-2 focus-visible:outline-accent">
          <ArrowLeft className="size-3.5" aria-hidden /> {help ? help.title : "Help"}
        </button>
        <p className="mb-2 font-display text-sm font-semibold text-txt">All shortcuts</p>
        {SHORTCUT_SECTIONS.map(({ title, rows }) => <KeyTable key={title} title={title} rows={rows.map((r) => ({ key: r.key, label: r.description }))} />)}
      </>
    )
  }
  return (
    <>
      <p className="font-display text-sm font-semibold text-txt">{help ? help.title : "Help"}</p>
      {help && help.keys.length > 0 && <KeyTable title="Keys" rows={help.keys} />}
      {help && help.tips.length > 0 && (
        <section aria-label="Tips" className="mt-3">
          <p className="pb-1 font-mono text-[10px] uppercase tracking-[0.06em] text-muted">Tips</p>
          <ul className="flex flex-col gap-1.5 text-muted">
            {help.tips.map((t) => <li key={t} className="leading-relaxed">{t}</li>)}
          </ul>
        </section>
      )}
      <KeyTable title="Everywhere" rows={GLOBAL_HELP_KEYS} />
      <button type="button" onClick={() => setAll(true)} className="mt-3 self-start text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent">
        All shortcuts →
      </button>
    </>
  )
}
