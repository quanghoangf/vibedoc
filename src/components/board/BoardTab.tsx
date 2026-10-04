"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Plus } from "lucide-react"
import type { ActivityEvent, Task } from "@/types"
import { useApp } from "@/context/AppContext"
import { useChats } from "@/context/ChatContext"
import { shouldHandleShortcut } from "@/lib/shortcuts"
import {
  DEFAULT_VIEWS, applyView, epicOf, fromParams, isDirty, toParams, type SavedView, type ViewState,
} from "@/lib/board-views"
import { ViewBar } from "./views/ViewBar"
import { ViewToolbar } from "./views/ViewToolbar"
import { BoardView } from "./views/BoardView"
import { TableView } from "./views/TableView"
import { EpicView } from "./views/EpicView"
import TimelineView from "./views/TimelineView"
import { BulkBar } from "./BulkBar"

interface BoardTabProps {
  tasks: Task[]
  onMoveTask: (id: string, status: string) => void
  onOpenTask: (task: Task) => void
  onNewTask: () => void
}

const BUILT_IN = DEFAULT_VIEWS.map((v) => v.id)
/** URL keys that carry view state (toParams / fromParams); `v` names the active saved view. */
const STATE_KEYS = ["view", "g", "sg", "s", "f", "q", "p", "sc"]
const SEARCH_ID = "board-search"

const stateOf = ({ id: _id, name: _name, ...s }: SavedView): ViewState => s
const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "view"
const newId = (name: string) => `${slug(name)}-${Math.random().toString(36).slice(2, 6)}`

/** Built-ins first (a saved copy replaces the default), then custom views in saved order. */
function withBuiltIns(saved: SavedView[]): SavedView[] {
  const byId = new Map(saved.map((v) => [v.id, v]))
  return [...DEFAULT_VIEWS.map((d) => byId.get(d.id) ?? d), ...saved.filter((v) => !BUILT_IN.includes(v.id))]
}

/** A built-in that differs from its code default (so it is saved, and can be restored). */
function customized(v: SavedView): boolean {
  const d = DEFAULT_VIEWS.find((x) => x.id === v.id)
  return !!d && (v.name !== d.name || isDirty(stateOf(v), d))
}

export function BoardTab({ tasks, onMoveTask, onOpenTask, onNewTask }: BoardTabProps) {
  const { rootParam, demo } = useApp()
  const { agents } = useChats()
  const params = useSearchParams()
  const [views, setViews] = useState<SavedView[]>(DEFAULT_VIEWS)
  const [filterOpen, setFilterOpen] = useState(false)
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())

  // ── Saved views (.vibedoc/views.json) ───────────────────────────────────────
  const loadViews = useCallback(() => {
    fetch(`/api/views${rootParam}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: { views?: SavedView[] }) => setViews(withBuiltIns(d.views ?? [])))
      .catch((e) => console.warn("[vibedoc] could not load views:", e))
  }, [rootParam])
  useEffect(() => {
    loadViews()
    const onSse = (e: Event) => { if ((e as CustomEvent<{ type?: string }>).detail?.type === "views_updated") loadViews() }
    window.addEventListener("vibedoc:sse", onSse)
    return () => window.removeEventListener("vibedoc:sse", onSse)
  }, [loadViews])

  // Unchanged built-ins stay out of views.json so later changes to DEFAULT_VIEWS still reach this project.
  const persist = useCallback((next: SavedView[]) => {
    setViews(next)
    if (demo) return // read-only demo (R042): views live in this tab only
    const body = { views: next.filter((v) => !BUILT_IN.includes(v.id) || customized(v)) }
    fetch(`/api/views${rootParam}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`) })
      .catch((e) => { console.warn("[vibedoc] could not save views:", e); loadViews() })
  }, [rootParam, loadViews, demo])

  // ── Live state = the URL. No view keys → the active saved view's state. ─────
  const vParam = params.get("v")
  const explicit = STATE_KEYS.some((k) => params.has(k))
  const key = params.toString()
  // Keyed on the query string so `state` (and every view's memo on it) keeps its identity between URL changes.
  const urlState = useMemo(() => fromParams(new URLSearchParams(key)), [key])
  const active = views.find((v) => v.id === vParam) ?? views.find((v) => v.id === urlState.kind) ?? views[0]
  const state: ViewState = useMemo(() => (explicit ? urlState : stateOf(active)), [explicit, urlState, active])
  const dirty = isDirty(state, active)

  // Native replaceState syncs useSearchParams without a server round trip (search typing stays smooth).
  const writeUrl = useCallback((id: string, next: ViewState | null) => {
    const p = new URLSearchParams(window.location.search)
    for (const k of [...STATE_KEYS, "v"]) p.delete(k)
    p.set("v", id)
    if (next) {
      const sp = toParams(next)
      // An empty set would read back as the saved view; name the kind so the default state sticks.
      if (![...sp.keys()].length) sp.set("view", next.kind)
      sp.forEach((val, k) => p.set(k, val))
    }
    window.history.replaceState(null, "", `${window.location.pathname}?${p}`)
  }, [])

  const setState = (next: ViewState) => writeUrl(active.id, next)
  const select = useCallback((id: string) => {
    setFilterOpen(false)
    const nextKind = views.find((v) => v.id === id)?.kind
    const body = document.querySelector<HTMLElement>("[data-board-view]")
    if (!nextKind || !body || !("startViewTransition" in document)) { writeUrl(id, null); return }
    // The URL syncs into React asynchronously, so hold the transition until the new view is on screen (max 300ms)
    document.startViewTransition(() => new Promise<void>((resolve) => {
      const done = () => { observer.disconnect(); clearTimeout(timer); resolve() }
      const observer = new MutationObserver(() => { if (body.dataset.boardView === nextKind) done() })
      const timer = setTimeout(done, 300)
      observer.observe(body, { attributes: true, attributeFilter: ["data-board-view"] })
      writeUrl(id, null)
      if (body.dataset.boardView === nextKind) done()
    }))
  }, [writeUrl, views])

  const saveAs = (name: string) => {
    const id = newId(name)
    persist([...views, { ...state, q: "", id, name }])
    writeUrl(id, null)
  }
  const save = () => persist(views.map((v) => (v.id === active.id ? { ...state, q: "", id: v.id, name: v.name } : v)))
  const rename = (id: string, name: string) => persist(views.map((v) => (v.id === id ? { ...v, name } : v)))
  const restore = (id: string) => {
    const d = DEFAULT_VIEWS.find((x) => x.id === id)
    if (!d) return
    persist(views.map((v) => (v.id === id ? d : v)))
    writeUrl(id, null)
  }
  const remove = (id: string) => {
    const v = views.find((x) => x.id === id)
    if (!v || !window.confirm(`Delete the view "${v.name}"? Tasks are not affected.`)) return false
    persist(views.filter((x) => x.id !== id))
    if (active.id === id) writeUrl(v.kind, null)
    return true
  }

  // ── Data ────────────────────────────────────────────────────────────────────
  const agentTasks = useMemo(
    () => new Set(Object.keys(agents).filter((k) => k.startsWith("task:")).map((k) => k.slice(5))),
    [agents],
  )
  const shown = useMemo(() => applyView(tasks, state, { agentTasks }), [tasks, state, agentTasks])
  const epics = useMemo(() => {
    const m = new Map<string, { id: string; title: string; open: boolean }>()
    for (const t of tasks) {
      const e = epicOf(t.phase)
      if (!e.id) continue
      const cur = m.get(e.id) ?? { id: e.id, title: e.title, open: false }
      if (!cur.title) cur.title = e.title
      if (t.status !== "done" && t.status !== "cancelled") cur.open = true
      m.set(e.id, cur)
    }
    return [...m.values()].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
  }, [tasks])

  const timeline = state.kind === "timeline"
  useEffect(() => {
    if (!timeline) return
    let alive = true
    const load = () => {
      setEventsLoading(true)
      fetch(`/api/activity${rootParam}&limit=2000`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((d: ActivityEvent[]) => { if (alive) setEvents(Array.isArray(d) ? d : []) })
        .catch((e) => console.warn("[vibedoc] could not load activity:", e))
        .finally(() => { if (alive) setEventsLoading(false) })
    }
    const onSse = (e: Event) => {
      const type = (e as CustomEvent<{ type?: string }>).detail?.type
      if (type !== "chat_saved" && type !== "views_updated") load()
    }
    load()
    window.addEventListener("vibedoc:sse", onSse)
    return () => { alive = false; window.removeEventListener("vibedoc:sse", onSse) }
  }, [timeline, rootParam])

  // ── Keys (board page only): v next view, 1–4 built-ins, f filter, n new task ─
  const order = views.map((v) => v.id).join(",")
  const activeId = active.id
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!shouldHandleShortcut(e) || document.querySelector("[role=dialog]")) return
      const n = Number(e.key)
      const ids = order.split(",")
      if (e.key === "v") select(ids[(ids.indexOf(activeId) + 1) % ids.length])
      else if (n >= 1 && n <= 4) select(BUILT_IN[n - 1])
      else if (e.key === "f") setFilterOpen(true)
      else if (e.key === "n" && !demo) onNewTask()
      else return
      e.preventDefault()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [order, activeId, select, onNewTask, demo])

  // Only tasks still on screen count as selected (a filter or a delete drops the rest)
  const selected = useMemo(() => new Set(shown.map((t) => t.id).filter((id) => picked.has(id))), [shown, picked])
  const toggleSelect = useCallback((ids: string[], on?: boolean) => setPicked((prev) => {
    const next = new Set(prev)
    for (const id of ids) {
      if (on ?? !next.has(id)) next.add(id)
      else next.delete(id)
    }
    return next
  }), [])
  const clearSelection = useCallback(() => setPicked(new Set()), [])
  useEffect(() => {
    if (selected.size === 0) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !document.querySelector("[role=dialog],[role=menu]")) clearSelection() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [selected.size, clearSelection])

  const count = (...s: Task["status"][]) => tasks.filter((t) => s.includes(t.status)).length
  const viewProps = { tasks: shown, allTasks: tasks, state, agentTasks, onOpenTask, selected, onToggleSelect: demo ? undefined : toggleSelect }

  return (
    <div className="flex min-w-0 flex-col">
      <header className="flex items-end gap-6 px-4 pt-8 sm:px-8">
        <div className="min-w-0 grow">
          <h1 className="text-[1.6rem] leading-tight font-semibold tracking-[-0.02em] text-txt">Board</h1>
          <p className="mt-2 text-[1.1rem] leading-snug font-semibold text-txt">
            <span className="font-mono tabular-nums">{count("todo", "in-progress", "review", "blocked")}</span> open ·{" "}
            <span className="font-mono tabular-nums">{count("in-progress")}</span> in progress{" "}
            <span className="font-normal text-muted">
              · <span className="font-mono tabular-nums">{count("done")}</span> done
            </span>
          </p>
        </div>
        {!demo && <button
          type="button"
          onClick={onNewTask}
          className="inline-flex h-8.5 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-accent px-3 text-[13px] font-medium text-accent-fg transition-colors duration-(--duration-fast) ease-out-soft hover:bg-accent/90 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          <Plus aria-hidden className="size-[15px]" />
          New task
          <kbd className="rounded-sm border border-accent-fg/25 bg-accent-fg/15 px-1 py-0.5 font-mono text-[10px] leading-none max-sm:hidden">n</kbd>
        </button>}
      </header>

      <div className="mt-[18px] px-4 sm:px-8">
        <ViewBar views={views} activeId={activeId} onSelect={select} onNew={() => saveAs("New view")} onRename={rename} onDelete={remove}
          customizedIds={views.filter(customized).map((v) => v.id)} onRestore={restore} />
      </div>
      <div className="px-4 pt-3 sm:px-8">
        <ViewToolbar
          state={state}
          onChange={setState}
          epics={epics}
          dirty={dirty}
          activeIsBuiltIn={BUILT_IN.includes(activeId)}
          onSave={save}
          onSaveAs={saveAs}
          onReset={() => select(activeId)}
          searchInputId={SEARCH_ID}
          filterOpen={filterOpen}
          onFilterOpenChange={setFilterOpen}
        />
      </div>

      <div data-board-view={state.kind} className="[view-transition-name:board-view-body]">
      {state.kind === "epic" ? (
        <EpicView {...viewProps} />
      ) : (
        <div className="min-w-0 px-4 pt-[18px] pb-8 sm:px-8">
          {state.kind === "board" && <BoardView {...viewProps} onMoveTask={onMoveTask} />}
          {state.kind === "table" && <TableView {...viewProps} onSort={(sorts) => setState({ ...state, sorts })} />}
          {timeline && (
            <TimelineView {...viewProps} events={events} loading={eventsLoading} onScale={(scale) => setState({ ...state, scale })} />
          )}
        </div>
      )}
      </div>
      {selected.size > 0 && <BulkBar ids={[...selected]} onClear={clearSelection} />}
    </div>
  )
}
