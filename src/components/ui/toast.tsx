"use client"

import { useSyncExternalStore } from "react"
import { X } from "lucide-react"

interface ToastItem {
  id: number
  message: string
  action?: { label: string; onClick: () => void }
}

// ponytail: module-level store, one Toaster per app; enough for a single-window local tool.
let items: ToastItem[] = []
let nextId = 1
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const EMPTY: ToastItem[] = []

export function dismissToast(id: number) {
  items = items.filter((t) => t.id !== id)
  emit()
}

export function toast(message: string, opts: { action?: ToastItem["action"]; durationMs?: number } = {}): number {
  const id = nextId++
  items = [...items.slice(-2), { id, message, action: opts.action }]
  emit()
  setTimeout(() => dismissToast(id), opts.durationMs ?? 6000)
  return id
}

/** "<message> · Undo" for a few seconds; a failed undo shows its error. */
export function undoToast(message: string, undo: () => Promise<void>) {
  const id = toast(message, {
    durationMs: 8000,
    action: {
      label: "Undo",
      onClick: () => {
        dismissToast(id)
        undo().catch((e: Error) => toast(`Undo failed: ${e.message}`))
      },
    },
  })
}

export function Toaster() {
  const list = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb) } },
    () => items,
    () => EMPTY,
  )
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2">
      {list.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex animate-slide-in items-center gap-3 rounded-lg border border-border bg-surface2 py-2 pl-4 pr-2 text-sm text-txt shadow-xl"
        >
          <span>{t.message}</span>
          {t.action && (
            <button type="button" onClick={t.action.onClick} className="rounded-md px-2 py-1 text-xs font-medium text-accent hover:bg-accent/10">
              {t.action.label}
            </button>
          )}
          <button type="button" aria-label="Dismiss" onClick={() => dismissToast(t.id)} className="grid size-6 place-items-center rounded-md text-muted hover:text-txt">
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
