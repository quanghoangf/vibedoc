"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Bot, Check, Circle, CircleCheck, FlaskConical, Search, X } from "lucide-react"
import { useApp } from "@/context/AppContext"
import { parseManualTests, type ManualTestItem, type ManualTests } from "@/lib/manual-tests"
import { REVIEW_TABS, filterRows, selectionLabel, sortRows, toRow, type ReviewRow, type ReviewTab } from "@/lib/test-review"
import { shouldHandleShortcut } from "@/lib/shortcuts"
import { timeAgo } from "@/components/activity/ActivityEventRow"
import { TestDetail, type DetailView } from "@/components/manual-tests/TestDetail"
import { TestBulkBar } from "@/components/manual-tests/TestBulkBar"
import { cn } from "@/lib/utils"
import type { Task } from "@/types"

/** A tick not yet reflected in the board data, keyed "T001:3"; only applies while the task file is unchanged. */
type Pending = Record<string, { checked: boolean; raw: string }>

const WIDE = "(min-width: 1024px)"
function onHashChange(cb: () => void) {
  window.addEventListener("hashchange", cb)
  return () => window.removeEventListener("hashchange", cb)
}
function onWideChange(cb: () => void) {
  const mq = window.matchMedia(WIDE)
  mq.addEventListener("change", cb)
  return () => mq.removeEventListener("change", cb)
}

const TAB_LABEL: Record<ReviewTab, string> = { needs: "Needs you", failed: "Failed", passed: "Passed", none: "No run", all: "All" }

export default function ManualTestsPage() {
  return (
    <Suspense>
      <TestReview />
    </Suspense>
  )
}

/**
 * /manual-tests = Test review: one row per task with a checklist or a recorded run, the selected task's evidence
 * on the right. URL state: ?task= &tab= &epic= &q= (the old #T060 card link selects that task).
 */
function TestReview() {
  const { board, rootParam, demo } = useApp()
  const router = useRouter()
  const params = useSearchParams()
  const tab = (REVIEW_TABS as string[]).includes(params.get("tab") ?? "") ? (params.get("tab") as ReviewTab) : "needs"
  const epic = params.get("epic")
  const [q, setQ] = useState(params.get("q") ?? "")
  const [pending, setPending] = useState<Pending>({})
  const [error, setError] = useState<string | null>(null)
  const search = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const detail = useRef<HTMLElement>(null)
  const tabs = useRef<HTMLElement>(null)
  // Which edges of the tab strip hide tabs (phones): drawn as a fade so the overflow reads as scrollable
  const [tabEdges, setTabEdges] = useState({ left: false, right: false })

  const setParams = useCallback((patch: Record<string, string | null>) => {
    const next = new URLSearchParams(window.location.search)
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    router.replace(next.size ? `/manual-tests?${next}` : "/manual-tests", { scroll: false })
  }, [router])

  // Every task with a checklist or a run; the parsed checklist carries the page's not-yet-saved ticks
  const tasks = useMemo(() => {
    const all = board ? Object.values(board).flat() : []
    return all.flatMap((task) => {
      const tests = task.raw ? parseManualTests(task.raw) : null
      return tests || task.lastRun ? [{ task, tests }] : []
    })
  }, [board])

  const checkedOf = useCallback((task: Task, item: ManualTestItem) => {
    const p = pending[`${task.id}:${item.index}`]
    return p && p.raw === task.raw ? p.checked : item.checked
  }, [pending])

  const rows = useMemo(() => sortRows(tasks.map(({ task, tests }) => toRow({
    id: task.id,
    title: task.title,
    phase: task.phase,
    status: task.status,
    items: (tests?.items ?? []).map((i) => ({ ...i, checked: checkedOf(task, i) })),
    autoRun: tests?.autoRun ?? null,
    lastRun: task.lastRun,
    reportDate: tests?.date ?? null,
  }))), [tasks, checkedOf])

  const shown = filterRows(rows, tab, epic, q)
  const counts = Object.fromEntries(REVIEW_TABS.map((t) => [t, filterRows(rows, t, epic, q).length])) as Record<ReviewTab, number>
  const epics = useMemo(() => [...new Map(rows.filter((r) => r.epic.id).map((r) => [r.epic.id!, r.epic.name])).entries()]
    .sort((a, b) => b[0].localeCompare(a[0], undefined, { numeric: true })), [rows])
  // Headline counts are the whole project (tabs carry the filtered ones); checks left only on tasks that need you
  const needing = rows.filter((r) => r.needsMe)
  const checksLeft = needing.reduce((n, r) => n + r.left, 0)
  const failing = rows.filter((r) => r.result === "failed").length
  const inReview = rows.filter((r) => r.status === "review").length

  // Selection: ?task=, else the old #T060 hash, else (wide screens, panel not closed with ?panel=0) the first row
  const hash = useSyncExternalStore(onHashChange, () => window.location.hash.slice(1) || null, () => null)
  const wide = useSyncExternalStore(onWideChange, () => window.matchMedia(WIDE).matches, () => true)
  const closed = params.get("panel") === "0"
  const selectedId = params.get("task") ?? hash ?? (wide && !closed ? shown[0]?.id ?? null : null)
  const selected = tasks.find((t) => t.task.id === selectedId) ?? null
  const selectedRow = rows.find((r) => r.id === selectedId) ?? null

  // Close plays the slide-out first; the URL changes when it ends. Keyed by task, so the panel stays out until the
  // router lands (resetting a flag on animationend replayed the slide-in for a frame: the flicker)
  const [closingId, setClosingId] = useState<string | null>(null)
  const closing = !!selectedId && closingId === selectedId
  const close = () => setClosingId(selectedId)
  const finishClose = () => setParams({ task: null, full: null, panel: "0" })
  const select = useCallback((id: string | null) => {
    setClosingId(null)
    setParams({ task: id, panel: null, run: null })
  }, [setParams])

  // The list is one tab stop (roving tabindex): the selected row, else the first
  const tabStop = shown.some((r) => r.id === selectedId) ? selectedId : shown[0]?.id

  // Multi-select (bulk actions): row checkboxes, ⇧-click = range from the last pick, ⌘/Ctrl-click = toggle.
  // Only rows still shown count, so a tab or filter change never acts on tasks out of sight.
  const [picked, setPicked] = useState<string[]>([])
  const [anchor, setAnchor] = useState<string | null>(null)
  const pickedRows = shown.filter((r) => picked.includes(r.id))
  const allPicked = shown.length > 0 && pickedRows.length === shown.length
  function pick(id: string, range: boolean) {
    const from = range && anchor ? shown.findIndex((r) => r.id === anchor) : -1
    const to = shown.findIndex((r) => r.id === id)
    if (from >= 0 && to >= 0) {
      const span = shown.slice(Math.min(from, to), Math.max(from, to) + 1).map((r) => r.id)
      setPicked((p) => [...new Set([...p, ...span])])
    } else {
      setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
    }
    setAnchor(id)
  }
  const clearPicked = () => { setPicked([]); setAnchor(null) }

  // Keep the selected row in view as j/k walk the list; focus follows when it's already in the list
  useEffect(() => {
    const row = list.current?.querySelector<HTMLElement>(`[data-row="${selectedId}"] button`)
    row?.scrollIntoView({ block: "nearest" })
    if (row && list.current?.contains(document.activeElement)) row.focus()
  }, [selectedId])

  // Tab strip: track hidden edges, and scroll the active tab into the strip (never the page) when it changes
  useEffect(() => {
    const nav = tabs.current
    if (!nav) return
    const update = () => setTabEdges((prev) => {
      const next = { left: nav.scrollLeft > 1, right: nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 1 }
      return prev.left === next.left && prev.right === next.right ? prev : next
    })
    update()
    nav.addEventListener("scroll", update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(nav)
    return () => { nav.removeEventListener("scroll", update); ro.disconnect() }
  }, [])
  useEffect(() => {
    const nav = tabs.current
    const active = nav?.querySelector<HTMLElement>("[aria-current=page]")
    if (!nav || !active) return
    const pad = 40 // keep the fade off the active tab
    if (active.offsetLeft - pad < nav.scrollLeft) nav.scrollLeft = Math.max(0, active.offsetLeft - pad)
    else if (active.offsetLeft + active.offsetWidth + pad > nav.scrollLeft + nav.clientWidth) nav.scrollLeft = active.offsetLeft + active.offsetWidth + pad - nav.clientWidth
  }, [tab])

  async function toggle(task: Task, item: ManualTestItem, checked: boolean) {
    const key = `${task.id}:${item.index}`
    setError(null)
    setPending((p) => ({ ...p, [key]: { checked, raw: task.raw ?? "" } }))
    try {
      const res = await fetch(`/api/tasks/manual-tests${rootParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, index: item.index, checked }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `Request failed (${res.status})`)
      // The SSE task_updated refresh brings the new file; the pending entry stops applying once raw changes
    } catch (e) {
      setPending((p) => { const next = { ...p }; delete next[key]; return next })
      setError(`Couldn't save the tick on ${task.id}: ${(e as Error).message}. The box is back as it was; try again.`)
    }
  }

  const showDetail = !!selected && !!selectedRow
  // ?full=1: the selected task as a page (list and filters fold away); e or Collapse brings the list back
  const full = showDetail && params.get("full") === "1"
  const view: DetailView = params.get("view") === "evidence" ? "evidence" : "review"

  // Page keys (TEST_REVIEW_KEYS): j/k (↓/↑ in the list) walk, x ticks, a a approves, s sends back, f next failure, / searches.
  // Capture phase so a / s / / win over the layout's page jumps; no deps: it reads this render's state.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && document.activeElement === search.current) {
        setQ("")
        setParams({ q: null })
        search.current?.blur()
        return
      }
      // A checklist box keeps the page keys (j/k/x/f…) here only; globally a checkbox still counts as a field
      const onTick = !!(e.target as Element | null)?.matches?.("input[type=checkbox]")
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || document.querySelector("[role=dialog]")) return
      if (!onTick && !shouldHandleShortcut(e)) return
      // Arrows walk the list only from inside it; elsewhere they scroll the detail (j/k walk from anywhere)
      if (e.key.startsWith("Arrow") && !list.current?.contains(document.activeElement)) return
      const at = shown.findIndex((r) => r.id === selectedId)
      const click = (action: string) => detail.current?.querySelector<HTMLButtonElement>(`[data-review="${action}"]:not(:disabled)`)?.click()
      switch (e.key) {
        case "/": search.current?.focus(); break
        case "j": case "k": case "ArrowDown": case "ArrowUp": {
          if (!shown.length) return
          const step = e.key === "j" || e.key === "ArrowDown" ? 1 : -1
          select(shown[Math.min(shown.length - 1, Math.max(0, at < 0 ? 0 : at + step))].id)
          break
        }
        case "f": {
          const next = [...shown.slice(at + 1), ...shown.slice(0, Math.max(0, at))].find((r) => r.result === "failed")
          if (next) select(next.id)
          break
        }
        case "x": {
          const item = demo ? null : selected?.tests?.items.find((i) => !i.auto && !checkedOf(selected.task, i))
          if (item && selected) void toggle(selected.task, item, true)
          break
        }
        // a / s belong to this page even when there's nothing to approve, so they never jump away by surprise
        // a focuses Approve, a again (or Enter) approves: one stray key never finishes a task
        case "a": {
          const approve = detail.current?.querySelector<HTMLButtonElement>('[data-review="approve"]:not(:disabled)')
          if (approve && document.activeElement === approve) approve.click()
          else approve?.focus()
          break
        }
        case "s": click("send-back"); break
        case "Escape":
          if (pickedRows.length) clearPicked()
          else if (selected) close()
          else return
          break
        case "o": if (selected) setParams({ full: full ? null : "1" }); break
        case "p": detail.current?.querySelector<HTMLButtonElement>("[data-run]:not(:disabled)")?.click(); break
        case "v": if (selected) setParams({ view: view === "evidence" ? null : "evidence", run: null }); break
        default: return
      }
      e.preventDefault()
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  })


  return (
    <div className="flex h-[calc(100svh-3rem)] min-h-0 flex-col">
      {/* Below lg the detail replaces the list, so it gets the whole screen (its breadcrumb has Back) */}
      <header className={cn("flex-col gap-3 border-b border-border px-5 pt-4 pb-0 sm:gap-4 sm:px-7 sm:pt-6", full ? "hidden" : showDetail ? "hidden lg:flex" : "flex")}>
        <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
          <h1 className="text-[1.6rem] leading-tight font-semibold tracking-[-0.02em] text-txt">Test review</h1>
          <p className="pb-0.5 text-[1.1rem] leading-snug font-semibold text-txt">
            {!rows.length ? "Nothing to review yet" : !needing.length ? (
              <span className="inline-flex items-center gap-1.5"><CircleCheck className="size-4 text-teal" aria-hidden />Nothing needs you</span>
            ) : (
              <>
                {failing > 0 && <><span className="font-mono font-semibold text-danger tabular-nums">{failing}</span><span className="text-danger"> failing</span> · </>}
                {inReview > 0 && <><span className="font-mono text-txt tabular-nums">{inReview}</span> in review · </>}
                <span className="font-mono text-txt tabular-nums">{needing.length}</span> {needing.length === 1 ? "task needs" : "tasks need"} you
                {checksLeft > 0 && <span className="text-[13px] font-normal text-muted"> · <span className="font-mono tabular-nums">{checksLeft}</span> {checksLeft === 1 ? "check" : "checks"} left</span>}
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <nav
            ref={tabs}
            aria-label="Filter by result"
            className={cn(
              "-mb-px flex max-w-full gap-1 overflow-x-auto [scrollbar-width:none]",
              tabEdges.left && tabEdges.right ? "[mask-image:linear-gradient(to_right,transparent,black_2.5rem,black_calc(100%-2.5rem),transparent)]"
                : tabEdges.right ? "[mask-image:linear-gradient(to_right,black_calc(100%-2.5rem),transparent)]"
                : tabEdges.left ? "[mask-image:linear-gradient(to_left,black_calc(100%-2.5rem),transparent)]" : "",
            )}
          >
            {REVIEW_TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setParams({ tab: t === "needs" ? null : t, task: null })}
                aria-current={tab === t ? "page" : undefined}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 pt-1 pb-2.5 text-[13px] transition-colors duration-(--duration-fast) focus-visible:outline-2 focus-visible:outline-accent",
                  tab === t ? "border-accent text-txt" : "border-transparent text-muted hover:text-txt",
                )}
              >
                {TAB_LABEL[t]}
                <span className={cn("rounded-sm px-1 font-mono text-[11px] tabular-nums", t === "failed" && counts.failed ? "bg-danger/15 text-danger" : "bg-surface2 text-muted")}>{counts[t]}</span>
              </button>
            ))}
          </nav>
          <div className="mb-2 flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
            <select
              aria-label="Epic"
              value={epic ?? ""}
              onChange={(e) => setParams({ epic: e.target.value || null, task: null })}
              className="h-8 min-w-0 flex-1 rounded-md sm:max-w-48 sm:flex-none border border-border bg-bg px-2 text-xs text-txt hover:border-border2 focus-visible:outline-2 focus-visible:outline-accent"
            >
              <option value="">All epics</option>
              {epics.map(([id, name]) => <option key={id} value={id}>{id} · {name}</option>)}
            </select>
            <label className="relative flex min-w-0 flex-1 items-center sm:flex-none">
              <Search className="pointer-events-none absolute left-2 size-3.5 text-muted" aria-hidden />
              <input
                ref={search}
                id="tests-search"
                value={q}
                onChange={(e) => { setQ(e.target.value); setParams({ q: e.target.value || null }) }}
                placeholder="Search tasks"
                aria-label="Search tasks"
                className="h-8 w-full rounded-md sm:w-44 border border-border bg-bg pr-7 pl-7 text-xs text-txt placeholder:text-muted hover:border-border2 focus:border-accent/60 focus:outline-hidden"
              />
              <kbd className="pointer-events-none absolute right-2 font-mono text-[11px] text-muted">/</kbd>
            </label>
          </div>
        </div>
      </header>

      {error && <p role="alert" className="mx-5 mt-3 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger sm:mx-7">{error}</p>}

      <div className="flex min-h-0 flex-1">
        <section
          key={full ? "page" : "list"}
          aria-label="Tasks"
          className={cn(
            // Always carries list-in, so it plays only when the list (re)appears: back from the page view or on phones
            "min-h-0 w-full flex-col overflow-y-auto lg:shrink-0 animate-list-in",
            showDetail ? "border-r border-border lg:w-[min(44%,34rem)]" : "lg:flex-1",
            full ? "hidden" : showDetail ? "hidden lg:flex" : "flex",
          )}
        >
          <div className="sticky top-0 z-10 hidden grid-cols-[1.25rem_1fr_5rem_4.5rem] sm:grid items-center gap-x-3 border-b border-border bg-bg/95 px-5 py-2 font-mono text-[11px] text-muted backdrop-blur-sm sm:px-7 lg:px-5">
            <PickBox
              checked={allPicked}
              mixed={!allPicked && pickedRows.length > 0}
              label={allPicked || pickedRows.length ? "Clear selection" : `Select all ${shown.length} tasks`}
              onPick={() => (pickedRows.length ? clearPicked() : setPicked(shown.map((r) => r.id)))}
              className="opacity-100"
            />
            <span>Task</span>
            <span>Manual</span>
            <span className="text-right">Last run</span>
          </div>
          {shown.length ? (
            <ul ref={list} className="flex flex-col">
              {shown.map((r) => (
                <li key={r.id} data-row={r.id} className="group/row relative">
                  <Row
                    row={r}
                    selected={r.id === selectedId}
                    picked={picked.includes(r.id)}
                    picking={pickedRows.length > 0}
                    tabStop={r.id === tabStop}
                    onSelect={(e) => (e.shiftKey || e.metaKey || e.ctrlKey ? pick(r.id, e.shiftKey) : select(r.id))}
                  />
                  <PickBox
                    checked={picked.includes(r.id)}
                    label={`Select ${r.id}`}
                    onPick={(range) => pick(r.id, range)}
                    className={cn(
                      "absolute top-3.5 left-5 sm:top-1/2 sm:left-7 sm:-translate-y-1/2 lg:left-5",
                      pickedRows.length ? "opacity-100" : "opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100",
                    )}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <Empty rows={rows.length} tab={tab} filtered={!!(epic || q)} onAll={() => setParams({ tab: "all", epic: null, q: null })} />
          )}
          {pickedRows.length > 0 && <TestBulkBar rows={pickedRows} onClear={clearPicked} />}
        </section>

        <section ref={detail} aria-label="Details" className={cn("min-h-0 flex-1 overflow-x-hidden overflow-y-auto", showDetail ? "block" : "hidden")}>
          {showDetail && (
            <div
              key={full ? "page" : "panel"}
              className={cn("min-h-full", closing ? "animate-panel-out" : full ? "animate-page-in" : "animate-panel-in")}
              onAnimationEnd={(e) => { if (closing && e.target === e.currentTarget) finishClose() }}
            >
            <TestDetail
              key={selected.task.id}
              task={selected.task}
              tests={selected.tests as ManualTests | null}
              row={selectedRow}
              checkedOf={(i) => checkedOf(selected.task, i)}
              onToggle={(i, c) => toggle(selected.task, i, c)}
              onBack={() => setParams({ task: null, full: null })}
              expanded={full}
              onExpand={(on) => setParams({ full: on ? "1" : null })}
              onClose={close}
              view={view}
              onView={(v) => setParams({ view: v === "evidence" ? "evidence" : null, run: null })}
              run={params.get("run")}
              onRun={(r) => setParams({ run: r })}
              onDecided={() => {
                // Next row that still needs you, below the current one first, wrapping to the top
                const at = shown.findIndex((r) => r.id === selected.task.id)
                const next = [...shown.slice(at + 1), ...shown.slice(0, Math.max(0, at))].find((r) => r.needsMe && r.id !== selected.task.id)
                select(next?.id ?? null)
              }}
            />
            </div>
          )}
        </section>
      </div>
      <p aria-live="polite" className="sr-only">{selectedRow ? selectionLabel(selectedRow) : ""}</p>
    </div>
  )
}

/** One task: result glyph, id + title over epic, the manual ruling, the last run. */
/** A row's (or the header's select-all) checkbox, laid over the result glyph; shows on hover or while picking. */
function PickBox({ checked, mixed = false, label, onPick, className }: {
  checked: boolean
  mixed?: boolean
  label: string
  onPick: (range: boolean) => void
  className?: string
}) {
  return (
    <span className={cn("relative z-[1] flex size-5 items-center justify-center transition-opacity duration-(--duration-fast)", className)}>
      <input
        type="checkbox"
        aria-label={label}
        checked={checked}
        ref={(el) => { if (el) el.indeterminate = mixed }}
        onChange={() => {}}
        onClick={(e) => { e.stopPropagation(); onPick(e.shiftKey) }}
        className="peer size-4 cursor-pointer appearance-none rounded-sm border border-muted bg-bg transition-colors duration-(--duration-fast) checked:border-accent checked:bg-accent indeterminate:border-accent indeterminate:bg-accent hover:border-txt focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      />
      <Check strokeWidth={3} className="pointer-events-none absolute size-3 text-accent-fg opacity-0 peer-checked:opacity-100" aria-hidden />
      <span className="pointer-events-none absolute h-0.5 w-2 rounded-full bg-accent-fg opacity-0 peer-indeterminate:opacity-100" aria-hidden />
    </span>
  )
}

function Row({ row: r, selected, picked, picking, tabStop, onSelect }: {
  row: ReviewRow
  selected: boolean
  picked: boolean
  picking: boolean
  tabStop: boolean
  onSelect: (e: React.MouseEvent) => void
}) {
  return (
    <button
      type="button"
      tabIndex={tabStop ? 0 : -1}
      onClick={onSelect}
      aria-current={selected || undefined}
      className={cn(
        // Phones stack the row (title alone, then epic · manual · last run) so titles keep their words; sm+ = 52px columns
        "grid w-full grid-cols-[1.25rem_1fr_auto_auto] items-center gap-x-3 gap-y-0.5 border-b border-border px-5 py-2 text-left sm:min-h-13 sm:grid-cols-[1.25rem_1fr_5rem_4.5rem] sm:py-1.5 transition-colors duration-(--duration-fast) focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent sm:px-7 lg:px-5",
        // Selected = Graphite + an inset accent hairline + heavier title; hover is only one tone step up
        selected ? "bg-surface2 ring-1 ring-accent/40 ring-inset" : picked ? "bg-accent/8 hover:bg-accent/12" : "hover:bg-surface",
      )}
    >
      {/* The checkbox (a sibling, laid over this cell) replaces the glyph on hover and while picking */}
      <span className={cn("col-start-1 row-span-2 row-start-1 flex transition-opacity duration-(--duration-fast)", picking ? "opacity-0" : "group-hover/row:opacity-0")}><ResultGlyph result={r.result} /></span>
      <span className="col-span-3 col-start-2 row-start-1 flex min-w-0 items-baseline gap-2 leading-5 sm:col-span-1">
        <span className={cn("shrink-0 font-mono text-[11px]", selected ? "text-txt" : "text-muted")}>{r.id}</span>
        <span className={cn("truncate text-[13px]", selected ? "font-semibold text-txt" : "font-medium text-txt/90")} title={r.title}>{r.title}</span>
      </span>
      <span className="col-start-2 row-start-2 flex min-w-0 items-center gap-2 text-[11px] leading-4 text-muted">
        {r.status === "review" && <span className="shrink-0 rounded-sm bg-accent/15 px-1 font-mono text-accent">review</span>}
        {r.auto.total > 0 && (
          <span className={cn("inline-flex shrink-0 items-center gap-1 font-mono", r.auto.result === "passed" ? "text-teal" : r.auto.result === "failed" ? "text-danger" : "")} title="Automated items">
            <Bot className="size-3" aria-hidden />{r.auto.total}
          </span>
        )}
        <span className="truncate">{r.epic.id ? `${r.epic.id} · ${r.epic.name}` : r.epic.name}</span>
      </span>
      <span className="col-start-3 row-start-2 sm:row-span-2 sm:row-start-1"><ManualRuling done={r.manual.done} total={r.manual.total} /></span>
      <span className="col-start-4 row-start-2 flex items-baseline justify-end gap-1.5 font-mono sm:row-span-2 sm:row-start-1 sm:flex-col sm:items-end sm:gap-0.5 text-[11px] tabular-nums">
        {r.steps ? <span className={r.result === "failed" ? "text-danger" : "text-txt"}>{r.steps.passed}/{r.steps.total}</span>
          : r.result !== "none" ? <span className={r.result === "failed" ? "text-danger" : "text-txt"}>{r.result}</span>
          : <span className="text-muted">no run</span>}
        {r.result !== "none" && r.at && <span className="text-muted">{timeAgo(r.at)}</span>}
      </span>
    </button>
  )
}

function ResultGlyph({ result }: { result: ReviewRow["result"] }) {
  if (result === "failed") return <span className="flex size-5 items-center justify-center rounded-full bg-danger/15"><X className="size-3.5 text-danger" strokeWidth={2.5} aria-label="Last run failed" /></span>
  if (result === "passed") return <span className="flex size-5 items-center justify-center rounded-full bg-teal/15"><Check className="size-3.5 text-teal" strokeWidth={2.5} aria-label="Last run passed" /></span>
  return <Circle className="size-5 p-0.5 text-border2" aria-label="No run" />
}

/** Marks drawn before the ruling turns proportional; at 20 a mark is still ~2px in the 5rem column. */
const RULING_MAX = 20

/** The manual checklist as a ruling (one mark per item, teal once ticked, so length reads as size) with the done/total tally. */
function ManualRuling({ done, total }: { done: number; total: number }) {
  if (!total) return <span className="font-mono text-[11px] text-muted">—</span>
  const marks = Math.min(total, RULING_MAX)
  return (
    <span className="flex items-center gap-1.5 sm:flex-col sm:items-stretch sm:gap-1" role="img" aria-label={`${done} of ${total} manual checks ticked`}>
      <span className="font-mono text-[11px] text-muted tabular-nums"><span className={done === total ? "text-teal" : "text-txt"}>{done}</span>/{total}</span>
      <span className="flex w-12 gap-0.5 sm:w-auto">
        {Array.from({ length: marks }, (_, i) => (
          <span key={i} className={cn("h-1 max-w-2 flex-1 rounded-full", i < Math.round((done / total) * marks) ? "bg-teal" : "bg-border2")} />
        ))}
      </span>
    </span>
  )
}

function Empty({ rows, tab, filtered, onAll }: { rows: number; tab: ReviewTab; filtered: boolean; onAll: () => void }) {
  if (!rows) {
    return (
      <div className="flex flex-col items-start gap-2 px-5 py-8 sm:px-7 lg:px-5">
        <FlaskConical className="size-5 text-muted" aria-hidden />
        <p className="text-sm text-txt">Nothing to review yet</p>
        <p className="max-w-sm text-xs leading-relaxed text-muted">
          When an agent finishes a task with a <code className="font-mono">manualTests</code> checklist, or a spec records a run, it lands here.
        </p>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-start gap-3 px-5 py-8 sm:px-7 lg:px-5">
      {tab === "needs" && !filtered ? (
        <div className="flex flex-col gap-1.5">
          <p className="flex items-center gap-2 text-sm text-txt"><CircleCheck className="size-4 text-teal" aria-hidden /> Nothing needs you</p>
          <p className="max-w-sm text-xs leading-relaxed text-muted">No run is failing, nothing waits in review, and every open task&apos;s checks are ticked. Checks left on finished tasks stay under All.</p>
        </div>
      ) : (
        <p className="text-sm text-muted">No task matches {filtered ? "these filters" : `“${TAB_LABEL[tab]}”`}.</p>
      )}
      <button type="button" onClick={onAll} className="rounded-md border border-border px-2.5 py-1 text-xs text-txt hover:border-border2 hover:bg-surface2 focus-visible:outline-2 focus-visible:outline-accent">
        Show all {rows} tasks
      </button>
    </div>
  )
}
