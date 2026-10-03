"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Info } from "lucide-react"
import { useApp } from "@/context/AppContext"
import { StatusIcon } from "@/components/shared/StatusIcon"
import { displayStatus } from "@/lib/statuses"
import { cn } from "@/lib/utils"
import type { CleanupFlag } from "@/lib/core"
import type { HealthKind } from "@/lib/memory-health"

const GROUPS: { kind: HealthKind; label: string }[] = [
  { kind: "contradiction", label: "Contradicts the board" },
  { kind: "dangling-ref", label: "Missing items" },
  { kind: "duplicate", label: "Duplicates" },
  { kind: "stale", label: "Not recalled lately" },
]

/** Memory health flags (R051), grouped by kind. Dismiss hides a flag until its id changes (memory/.cleanup.json). */
export function CleanupPanel({ flags, onDismiss, onOpenEntry, onClose }: {
  /** null while loading; includes dismissed flags (marked `dismissed`) */
  flags: CleanupFlag[] | null
  onDismiss: (flag: CleanupFlag) => void
  onOpenEntry: (id: string) => void
  onClose: () => void
}) {
  const router = useRouter()
  const { board } = useApp()
  const [showDismissed, setShowDismissed] = useState(false)
  const tasks = useMemo(() => new Map(Object.values(board ?? {}).flat().map((t) => [t.id, t])), [board])
  const shown = (flags ?? []).filter((f) => showDismissed || !f.dismissed)
  const dismissedCount = (flags ?? []).filter((f) => f.dismissed).length

  // open a referenced item where it lives, like the Related panel
  const open = (id: string) => {
    if (id.startsWith("T")) router.push(`/board?task=${id}`)
    else if (id.startsWith("R")) router.push(`/roadmap?item=${id}`)
    else if (id.startsWith("E")) onOpenEntry(id)
  }

  const ref = (id: string) => {
    const task = tasks.get(id)
    return (
      <button
        key={id}
        type="button"
        onClick={() => open(id)}
        className="inline-flex max-w-full items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-left text-xs outline-none transition-colors duration-(--duration-fast) hover:bg-surface2 focus-visible:ring-2 focus-visible:ring-accent"
      >
        {task && <StatusIcon status={displayStatus(task)} className="size-3.5 shrink-0" />}
        <span className="shrink-0 font-mono text-[11px] text-muted">{id}</span>
        {task && <span className="min-w-0 truncate text-txt">{task.title}</span>}
      </button>
    )
  }

  const row = (f: CleanupFlag) => {
    const Icon = f.severity === "warn" ? AlertTriangle : Info
    return (
      <li key={f.id} data-flag={f.id} className={cn("flex items-start gap-2 rounded-lg border border-border bg-surface px-3 py-2.5", f.dismissed && "opacity-60")}>
        <Icon className={cn("mt-0.5 size-3.5 shrink-0", f.severity === "warn" && !f.dismissed ? "text-amber" : "text-muted")} aria-label={f.severity === "warn" ? "Warning" : "Note"} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className={cn("text-[13px]", f.dismissed ? "text-muted" : "text-txt")}>
            {f.message.split(/\b([TRE]\d+)\b/).map((part, i) => (i % 2 ? <span key={i} className="font-mono text-[12px]">{part}</span> : part))}
          </p>
          {f.refs.length > 0 && <div className="-ml-1.5 flex flex-wrap gap-1">{f.refs.map(ref)}</div>}
        </div>
        {f.dismissed ? (
          <span className="shrink-0 font-mono text-[10px] text-muted" title="Dismissed on">dismissed {f.dismissed}</span>
        ) : (
          <button
            type="button"
            onClick={() => onDismiss(f)}
            className="h-6 shrink-0 rounded-md px-2 text-xs text-muted outline-none transition-colors duration-(--duration-fast) hover:bg-surface2 hover:text-txt focus-visible:ring-2 focus-visible:ring-accent"
          >
            Dismiss
          </button>
        )}
      </li>
    )
  }

  return (
    <section aria-label="Cleanup" className="min-w-0">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-base font-semibold tracking-tight">Cleanup</h2>
        <div className="flex items-center gap-3">
          {dismissedCount > 0 && (
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted">
              <input
                type="checkbox"
                checked={showDismissed}
                onChange={(e) => setShowDismissed(e.target.checked)}
                className="size-3.5 accent-accent focus-visible:outline-2 focus-visible:outline-accent"
              />
              Show dismissed <span className="font-mono text-[10px]">{dismissedCount}</span>
            </label>
          )}
          <button type="button" onClick={onClose} className="text-xs text-muted underline-offset-2 outline-none hover:text-txt hover:underline focus-visible:ring-2 focus-visible:ring-accent">
            Show the handoff
          </button>
        </div>
      </div>
      {flags === null ? (
        <p className="text-sm text-muted">Checking memory…</p>
      ) : !shown.length ? (
        <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted">Memory looks clean</p>
      ) : (
        <div className="flex flex-col gap-4">
          {GROUPS.map(({ kind, label }) => {
            const group = shown.filter((f) => f.kind === kind)
            if (!group.length) return null
            return (
              <div key={kind} className="flex flex-col gap-1.5">
                <h3 className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-muted">
                  {label} <span>{group.filter((f) => !f.dismissed).length}</span>
                </h3>
                <ul className="flex flex-col gap-1.5">{group.map(row)}</ul>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
