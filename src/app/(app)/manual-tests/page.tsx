"use client"

import { displayStatus } from "@/lib/statuses"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight, Bot, Check, ChevronRight, CircleCheck, FlaskConical } from "lucide-react"
import { useApp } from "@/context/AppContext"
import { StatusChip } from "@/components/shared/StatusIcon"
import { parseManualTests, untestedItems, type ManualTestItem, type ManualTests } from "@/lib/manual-tests"
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
  // Only items a human still has to check: 🤖 ones proven by a passed run don't count (R058)
  const remaining = (t: Tested) => untestedItems(t.tests, (i) => checkedOf(t, i)).length

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
      setError(`Couldn't save the tick on ${t.task.id}: ${(e as Error).message}. The box is back as it was; try again.`)
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
      <header className="flex flex-wrap items-end gap-x-6 gap-y-3 border-b border-border pb-5">
        <div className="min-w-0 flex-1">
          <h1 className="text-[1.6rem] leading-tight font-semibold tracking-[-0.02em] text-txt">Manual tests</h1>
          <p className="mt-2 text-[1.1rem] leading-snug font-semibold text-txt">
            {open.length ? (
              <>
                <span className="font-mono tabular-nums">{itemsLeft}</span> check{itemsLeft === 1 ? "" : "s"} left across{" "}
                <span className="font-mono tabular-nums">{open.length}</span> task{open.length === 1 ? "" : "s"}
              </>
            ) : all.length ? "Everything is checked" : "Nothing to check yet"}
          </p>
          <p className="mt-1 text-sm text-muted">Ticking saves to the task file. It never changes the task&apos;s status.</p>
        </div>
        <label className="flex w-full cursor-pointer items-center gap-2 text-xs text-muted select-none hover:text-txt sm:w-auto">
          <Tick checked={showTested} onChange={setShowTested} className="mt-0" />
          Show fully tested <span className="font-mono tabular-nums">({all.length - open.length})</span>
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

      {all.length > 0 && groups.length === 0 && (
        <div className="flex items-center gap-2.5 rounded-lg border border-teal/30 px-4 py-3 text-sm text-txt animate-fade-in">
          <CircleCheck className="size-4 shrink-0 text-teal" aria-hidden />
          All {all.length} report{all.length === 1 ? " is" : "s are"} fully checked. Turn on Show fully tested to see them again.
        </div>
      )}

      {groups.map(([epic, tasks]) => (
        <section key={epic} className="flex flex-col gap-4">
          <EpicHeading epic={epic} />
          {tasks.map((t) => (
            <TaskTests key={t.task.id} t={t} remaining={remaining(t)} checkedOf={(i) => checkedOf(t, i)} onToggle={(i, c) => toggle(t, i, c)} />
          ))}
        </section>
      ))}
    </div>
  )
}

/** "R043 — Task verification & review" → the ID in mono, the name as a headline. */
function EpicHeading({ epic }: { epic: string }) {
  const m = epic.match(/^(R\d+)\s*[—–-]\s*(.+)$/)
  return (
    <h2 className="flex items-baseline gap-3 pt-2">
      {m && <span className="font-mono text-[11px] text-muted">{m[1]}</span>}
      <span className="text-[1.1rem] leading-snug font-semibold text-txt">{m ? m[2] : epic}</span>
    </h2>
  )
}

// Paths, commands, files, IDs and tool names inside a step (the Grep rule: set them in mono)
const CODE = /((?<=^|[\s(])\/[\w\-./#?=]+|\b[a-z][\w-]+\/[\w\-./]*\w|\b[\w-]+\.(?:md|json|tsx?|mts)\b|\b(?:[TR]\d{3}|ADR-\d{3})\b|\bvibedoc_\w+|\bmanualTests\b)/g

function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(CODE).map((part, i) =>
        i % 2 ? <code key={i} className="font-mono text-[0.9em]">{part}</code> : part,
      )}
    </>
  )
}

/** A step reads "do this → see that": the action, then the expected result on its own line. */
function StepText({ text, checked }: { text: string; checked: boolean }) {
  const at = text.indexOf(" → ")
  const action = at < 0 ? text : text.slice(0, at)
  const expected = at < 0 ? null : text.slice(at + 3)
  return (
    <span className={cn("flex min-w-0 flex-col gap-1 transition-colors duration-(--duration-base)", checked ? "text-muted line-through" : "text-txt")}>
      <span className="text-sm leading-snug"><Inline text={action} /></span>
      {expected && (
        <span className="flex items-start gap-1.5 text-[13px] leading-snug text-muted">
          <ArrowRight className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span className="sr-only">Expected: </span>
          <span><Inline text={expected} /></span>
        </span>
      )}
    </span>
  )
}

function TaskTests({ t, remaining, checkedOf, onToggle }: {
  t: Tested
  remaining: number
  checkedOf: (item: ManualTestItem) => boolean
  onToggle: (item: ManualTestItem, checked: boolean) => void
}) {
  const done = t.tests.items.filter(checkedOf).length
  const total = t.tests.total
  const complete = remaining === 0
  const proven = t.tests.autoRun?.result === "passed"
  const manual = t.tests.items.filter((i) => !i.auto)
  const automated = t.tests.items.filter((i) => i.auto)
  const groups = [
    { label: "Steps", items: manual.filter((i) => i.group === "steps") },
    { label: "Regression risk", items: manual.filter((i) => i.group === "regression") },
  ].filter((g) => g.items.length)
  const row = (item: ManualTestItem, number: string) => {
    const checked = checkedOf(item)
    return (
      <li key={item.index}>
        <label className="-mx-2 grid cursor-pointer grid-cols-[1rem_1.25rem_1fr] items-start gap-x-2.5 rounded-md px-2 py-2 hover:bg-surface2">
          <Tick checked={checked} onChange={(c) => onToggle(item, c)} />
          <span className="mt-px font-mono text-[11px] leading-5 text-muted tabular-nums" aria-hidden>{number}</span>
          <StepText text={item.text} checked={checked} />
        </label>
      </li>
    )
  }

  return (
    <article
      id={t.task.id}
      className={cn("scroll-mt-16 rounded-lg border bg-surface animate-fade-in transition-colors duration-(--duration-slow)", complete ? "border-teal/30" : "border-border")}
    >
      <header className="flex flex-col gap-3 px-4 pt-4 pb-3 sm:px-5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
          <span className="font-mono text-[11px] text-muted">{t.task.id}</span>
          <Link href={`/board?task=${t.task.id}`} className="min-w-0 flex-1 basis-60 text-[15px] leading-snug font-semibold text-txt hover:text-accent focus-visible:text-accent focus-visible:outline-none">
            {t.task.title}
          </Link>
          <span className="flex items-center gap-3">
            <StatusChip status={displayStatus(t.task)} />
            <span className="font-mono text-[11px] text-muted tabular-nums">
              <span className="text-txt">{done}</span>/{total}
            </span>
          </span>
        </div>
        {/* One mark per item: the report's ruling, filled as you tick */}
        <div className="flex gap-0.5" role="progressbar" aria-label={`${t.task.id} manual tests`} aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
          {t.tests.items.map((i) => (
            <span
              key={i.index}
              className={cn("h-1 flex-1 rounded-full transition-colors duration-(--duration-base)", checkedOf(i) || (i.auto && proven) ? "bg-teal" : i.group === "regression" ? "bg-amber/25" : "bg-border2")}
            />
          ))}
        </div>
      </header>
      <div className="flex flex-col gap-4 border-t border-border px-4 py-4 sm:px-5">
        {groups.map((g) => (
          <div key={g.label} className="flex flex-col gap-1">
            <p className={cn("font-mono text-[10px] uppercase tracking-widest", g.label === "Steps" ? "text-muted" : "text-amber")}>{g.label}</p>
            <ol className="flex flex-col">
              {/* Steps are a sequence; regression checks aren't */}
              {g.items.map((item, n) => row(item, g.label === "Steps" ? String(n + 1).padStart(2, "0") : ""))}
            </ol>
          </div>
        ))}
        {/* 🤖 items (R058): a spec covers them, so they stay folded unless the last run didn't pass */}
        {automated.length > 0 && (
          <details open={!proven} className="group/auto flex flex-col gap-1">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] text-muted uppercase tracking-widest hover:text-txt [&::-webkit-details-marker]:hidden">
              <ChevronRight className="size-3 transition-transform group-open/auto:rotate-90" aria-hidden />
              <Bot className="size-3" aria-hidden />
              Automated <span className="tabular-nums">({automated.length})</span>
              <span className="normal-case tracking-normal">
                {t.tests.autoRun
                  ? <>· last run <span className={t.tests.autoRun.result === "failed" ? "text-danger" : "text-teal"}>{t.tests.autoRun.result}</span> {t.tests.autoRun.date}</>
                  : "· not run yet"}
              </span>
              {t.tests.spec && <code className="normal-case tracking-normal select-all">{t.tests.spec}</code>}
            </summary>
            <ol className="mt-1 flex flex-col">{automated.map((item) => row(item, ""))}</ol>
          </details>
        )}
        {t.tests.date && <p className="font-mono text-[10px] text-muted">Report from {t.tests.date}</p>}
      </div>
    </article>
  )
}

/** The native checkbox, drawn in the system: pencil-grey box, teal fill with an ink check when ticked. */
function Tick({ checked, onChange, className }: { checked: boolean; onChange: (checked: boolean) => void; className?: string }) {
  const { demo } = useApp() // read-only demo (R042): shown, not tickable
  return (
    <span className={cn("relative mt-0.5 flex size-4 shrink-0", className)}>
      <input
        type="checkbox"
        checked={checked}
        disabled={demo}
        onChange={(e) => onChange(e.target.checked)}
        className="peer size-4 cursor-pointer disabled:cursor-default appearance-none rounded-sm border border-muted bg-bg transition-colors duration-(--duration-fast) checked:border-teal checked:bg-teal hover:border-txt focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      />
      <Check strokeWidth={3} className="pointer-events-none absolute inset-0.5 size-3 text-accent-fg opacity-0 peer-checked:opacity-100" aria-hidden />
    </span>
  )
}
