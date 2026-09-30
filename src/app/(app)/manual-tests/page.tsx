"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { FlaskConical } from "lucide-react"
import { useApp } from "@/context/AppContext"
import { StatusChip } from "@/components/shared/StatusIcon"
import { parseManualTests, type ManualTestItem, type ManualTests } from "@/lib/manual-tests"
import { cn } from "@/lib/utils"
import type { Task } from "@/types"

interface Tested { task: Task; tests: ManualTests }

/** A tick not yet reflected in the board data, keyed "T001:3"; only applies while the task file is unchanged. */
type Pending = Record<string, { checked: boolean; raw: string }>

export default function ManualTestsPage() {
  const { board, rootParam } = useApp()
  const [showTested, setShowTested] = useState(false)
  const [pending, setPending] = useState<Pending>({})
  const [error, setError] = useState<string | null>(null)
  // Tasks finished during this visit stay in place (marked done) instead of vanishing under the cursor
  const [finishedHere, setFinishedHere] = useState<string[]>([])

  const all = useMemo<Tested[]>(() => {
    const tasks = board ? Object.values(board).flat() : []
    return tasks.flatMap((task) => {
      const tests = task.raw ? parseManualTests(task.raw) : null
      return tests ? [{ task, tests }] : []
    })
  }, [board])

  const checkedOf = (t: Tested, item: ManualTestItem) => {
    const p = pending[`${t.task.id}:${item.index}`]
    return p && p.raw === t.task.raw ? p.checked : item.checked
  }
  const remaining = (t: Tested) => t.tests.items.filter((i) => !checkedOf(t, i)).length

  const open = all.filter((t) => remaining(t) > 0)
  const shown = showTested ? all : all.filter((t) => remaining(t) > 0 || finishedHere.includes(t.task.id))
  const itemsLeft = open.reduce((n, t) => n + remaining(t), 0)

  // Group by epic (Phase); newest report first, both for groups and for tasks inside them
  const groups = useMemo(() => {
    const byEpic = new Map<string, Tested[]>()
    for (const t of [...shown].sort((a, b) => (b.tests.date ?? "").localeCompare(a.tests.date ?? "") || b.task.id.localeCompare(a.task.id))) {
      const key = t.task.phase || "No epic"
      byEpic.set(key, [...(byEpic.get(key) ?? []), t])
    }
    return [...byEpic.entries()]
  }, [shown])

  // /manual-tests#T060 (the card badge): scroll that task into view once it's rendered
  const hasTasks = all.length > 0
  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (id && hasTasks) document.getElementById(id)?.scrollIntoView({ block: "start", behavior: "smooth" })
  }, [hasTasks])

  async function toggle(t: Tested, item: ManualTestItem, checked: boolean) {
    const key = `${t.task.id}:${item.index}`
    setError(null)
    setPending((p) => ({ ...p, [key]: { checked, raw: t.task.raw ?? "" } }))
    if (checked && remaining(t) === 1) setFinishedHere((ids) => [...ids, t.task.id])
    try {
      const res = await fetch(`/api/tasks/manual-tests${rootParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: t.task.id, index: item.index, checked }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `Request failed (${res.status})`)
      // The SSE task_updated refresh brings the new file; the pending entry stops applying once raw changes
    } catch (e) {
      setPending((p) => { const next = { ...p }; delete next[key]; return next })
      setError(`${t.task.id}: ${(e as Error).message}`)
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
      <header className="flex flex-wrap items-end gap-4">
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-txt">Manual tests</h1>
          <p className="mt-1 text-sm text-muted">
            {open.length
              ? `${itemsLeft} item${itemsLeft === 1 ? "" : "s"} to check across ${open.length} task${open.length === 1 ? "" : "s"}. Ticking saves to the task file; it never changes the task's status.`
              : "Nothing left to check."}
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted select-none">
          <input type="checkbox" checked={showTested} onChange={(e) => setShowTested(e.target.checked)} className="accent-accent" />
          Show fully tested ({all.length - open.length})
        </label>
      </header>

      {error && <p role="alert" className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">{error}</p>}

      {all.length === 0 && (
        <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed border-border2 p-6 animate-fade-in">
          <FlaskConical className="size-5 text-muted" />
          <p className="text-sm text-txt">No manual test reports yet</p>
          <p className="max-w-lg text-xs leading-relaxed text-muted">
            When an agent finishes a task with <code className="font-mono">vibedoc_update_task</code> and a <code className="font-mono">manualTests</code> checklist,
            the steps to click through show up here.
          </p>
        </div>
      )}

      {groups.map(([epic, tasks]) => (
        <section key={epic} className="flex flex-col gap-3">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted">{epic}</h2>
          {tasks.map((t) => (
            <TaskTests key={t.task.id} t={t} checkedOf={(i) => checkedOf(t, i)} onToggle={(i, c) => toggle(t, i, c)} />
          ))}
        </section>
      ))}
    </div>
  )
}

function TaskTests({ t, checkedOf, onToggle }: {
  t: Tested
  checkedOf: (item: ManualTestItem) => boolean
  onToggle: (item: ManualTestItem, checked: boolean) => void
}) {
  const done = t.tests.items.filter(checkedOf).length
  const total = t.tests.total
  const groups = [
    { label: "Steps", items: t.tests.items.filter((i) => i.group === "steps") },
    { label: "Regression risk", items: t.tests.items.filter((i) => i.group === "regression") },
  ].filter((g) => g.items.length)

  return (
    <article id={t.task.id} className="scroll-mt-16 rounded-lg border border-border bg-surface animate-fade-in">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <span className="font-mono text-[11px] text-muted">{t.task.id}</span>
        <Link href={`/board?task=${t.task.id}`} className="min-w-0 flex-1 truncate text-sm font-medium text-txt hover:text-accent">
          {t.task.title}
        </Link>
        <StatusChip status={t.task.status} className="shrink-0" />
        <span className={cn("shrink-0 font-mono text-[11px] tabular-nums", done === total ? "text-teal" : "text-muted")}>{done}/{total}</span>
      </header>
      <div className="h-0.5 bg-border">
        <div className="h-full bg-teal transition-[width] duration-(--duration-slow) ease-out-soft" style={{ width: `${(done / total) * 100}%` }} />
      </div>
      <div className="flex flex-col gap-3 px-4 py-3">
        {groups.map((g) => (
          <div key={g.label} className="flex flex-col gap-1">
            <p className={cn("font-mono text-[10px] uppercase tracking-widest", g.label === "Steps" ? "text-muted" : "text-amber")}>{g.label}</p>
            <ul className="flex flex-col">
              {g.items.map((item) => {
                const checked = checkedOf(item)
                return (
                  <li key={item.index}>
                    <label className="-mx-2 flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-1.5 hover:bg-surface2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => onToggle(item, e.target.checked)}
                        className="mt-0.5 accent-teal"
                      />
                      <span className={cn("text-sm leading-snug transition-colors duration-(--duration-base)", checked ? "text-muted line-through" : "text-txt")}>
                        {item.text}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
        {t.tests.date && <p className="font-mono text-[10px] text-muted">Report from {t.tests.date}</p>}
      </div>
    </article>
  )
}
