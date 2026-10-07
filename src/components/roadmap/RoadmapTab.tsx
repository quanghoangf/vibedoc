"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import {
  Background,
  BackgroundVariant,
  Controls,
  Position,
  ReactFlow,
  applyNodeChanges,
  type Edge,
  type NodeChange,
  type ReactFlowInstance,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

const MIN_INITIAL_ZOOM = 0.75
const VIEWPORT_PAD = 40
import { AlertTriangle, Bot, ChevronLeft, X, FileText, LayoutGrid, ListTree, Plus, ScrollText, Sparkles } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useApp } from "@/context/AppContext"
import { EmptyState } from "@/components/shared/EmptyState"
import { CopyCommand } from "@/components/shared/CopyCommand"
import { Button } from "@/components/ui/button"
import type { RoadmapItem, RoadmapLayout, RoadmapSource, RoadmapStatus, Task, TaskStatus, UpdateRoadmapItemPatch } from "@/types"
import { pickNextTask } from "@/lib/work-queue"
import { dueState, localToday, roadmapHealth, taskDueSummary, type RoadmapDrift, type TaskInfo } from "@/lib/roadmap-health"
import { cn } from "@/lib/utils"
import { askAgent } from "@/lib/ask-agent"
import { RoadmapTimeline } from "./RoadmapTimeline"
import { FEATURE_W, HORIZON_W, arrangePositions, resolvePositions } from "./layout"
import { StatusDot, nodeTypes, useRoadmapStatusLabel, type RoadmapNode } from "./RoadmapNodes"
import { RoadmapItemPane, RoadmapItemSheet } from "./RoadmapItemSheet"
import { TaskDetailBody } from "@/components/board/TaskDetailPanel"
import { shouldHandleShortcut } from "@/lib/shortcuts"
import { NewItemDialog } from "./NewItemDialog"
import { PlanFromSpecDialog } from "./PlanFromSpecDialog"
import { ReleaseNotesDialog } from "./ReleaseNotesDialog"
import { BreakdownEpicsDialog } from "./BreakdownEpicsDialog"
import { ItemContextMenu, type ContextMenuState, type ItemActions } from "./ItemActionsMenu"
import { useChats } from "@/context/ChatContext"
import { undoToast } from "@/components/ui/toast"
import { tNow, useT } from "@/context/LanguageContext"
import { useFlowAriaLabels } from "@/components/shared/flow-labels"
import type { MessageKey } from "@/i18n"

type ApiResult<T> = { data?: T; error?: string }

async function api<T>(url: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(
      url,
      body === undefined
        ? undefined
        : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    )
    const json = await res.json().catch(() => null)
    if (!res.ok) return { error: json?.error ?? tNow("board.requestFailed", { status: res.status }) }
    return { data: json as T }
  } catch {
    return { error: tNow("roadmap.couldNotReach") }
  }
}

type T = (key: MessageKey, vars?: Record<string, string | number>) => string

/** A drift item in the UI language, from its data (the lib's English `message` is for MCP). */
export function driftText(d: RoadmapDrift, t: T, status: (s: RoadmapStatus) => string): string {
  const v = d.vars
  const st = (s: string) => status(s as RoadmapStatus).toLowerCase()
  switch (d.kind) {
    case "overdue": return t("roadmap.driftOverdue", v)
    case "spec-unmerged": return t("roadmap.driftSpecUnmerged", v)
    case "spec-conflict": return t("roadmap.driftSpecConflict", v)
    case "missing-task": return t("roadmap.driftMissingTask", v)
    case "uncovered-scenario": return t("roadmap.driftUncovered", v)
    case "at-risk": {
      const risks = (d.risks ?? []).map((r) =>
        r.why === "task-overdue" ? t("roadmap.riskTaskOverdue", { id: r.id, due: r.due })
          : r.why === "task-blocked" ? t("roadmap.riskTaskBlocked", { id: r.id })
            : t("roadmap.riskNothingStarted", { due: r.due }))
      return t("roadmap.driftAtRisk", { ...v, risks: risks.join("; ") })
    }
    case "status-mismatch":
      return d.variant === "all-done" ? t("roadmap.driftAllDone", { ...v, status: st(v.status) })
        : d.variant === "horizon" ? t("roadmap.driftHorizon", { ...v, status: st(v.status), expected: st(v.expected) })
          : t("roadmap.driftNotDone", { ...v, status: st(v.status) })
  }
}

function taskDueFields(taskIds: string[], tasks: Record<string, TaskInfo>, today: string) {
  const taskDue = taskDueSummary(taskIds, tasks, today)
  return { taskDue, taskDueSoon: !!taskDue?.next && dueState(taskDue.next, "planned", today) === "soon" }
}

function buildNodes(items: RoadmapItem[], layout: RoadmapLayout, prev: RoadmapNode[]): RoadmapNode[] {
  const pos = resolvePositions(items, layout)
  const prevById = new Map(prev.map((n) => [n.id, n]))
  return items.map((item) => {
    const old = prevById.get(item.id)
    return {
      id: item.id,
      type: item.parent === null ? "horizon" : "feature",
      position: pos[item.id] ?? { x: 0, y: 0 },
      data: { item },
      // keep React Flow's measurements/selection across rebuilds
      measured: old?.measured,
      selected: old?.selected,
    }
  })
}

/** Pick the handle sides that face each other. Branches always leave a horizon sideways, like roadmap.sh. */
function sides(a: RoadmapNode, b: RoadmapNode, horizontal: boolean): [Position, Position] {
  const center = (n: RoadmapNode) => ({
    x: n.position.x + (n.measured?.width ?? (n.type === "horizon" ? HORIZON_W : FEATURE_W)) / 2,
    y: n.position.y + (n.measured?.height ?? 48) / 2,
  })
  const ca = center(a)
  const cb = center(b)
  const dx = cb.x - ca.x
  const dy = cb.y - ca.y
  if (horizontal || Math.abs(dx) > Math.abs(dy)) return dx > 0 ? [Position.Right, Position.Left] : [Position.Left, Position.Right]
  return dy > 0 ? [Position.Bottom, Position.Top] : [Position.Top, Position.Bottom]
}

/** Spine: solid up to the current horizon, dashed after. Branch: follows the epic (live = animated accent). */
function edgeStyle(a: RoadmapNode, b: RoadmapNode, spine: boolean): Pick<Edge, "style" | "animated"> {
  if (spine) {
    return a.data.item.status === "done"
      ? { style: { stroke: "var(--color-accent)", strokeWidth: 3 } }
      : { style: { stroke: "var(--color-border2)", strokeWidth: 3, strokeDasharray: "6 6" } }
  }
  const status = b.data.item.status
  if (status === "in-progress") return { animated: true, style: { stroke: "var(--color-accent)", strokeWidth: 2 } }
  if (status === "done") return { style: { stroke: "var(--color-border2)", strokeWidth: 1.5 } }
  return { style: { stroke: "var(--color-border2)", strokeWidth: 1.5, strokeDasharray: "2 5", strokeLinecap: "round" } }
}

function edge(id: string, a: RoadmapNode, b: RoadmapNode, spine: boolean): Edge {
  const [s, t] = sides(a, b, !spine)
  return {
    id,
    source: a.id,
    target: b.id,
    sourceHandle: s,
    targetHandle: `${t}-t`,
    type: spine ? "straight" : "default",
    selectable: false,
    ...edgeStyle(a, b, spine),
  }
}

function subscribeTheme(cb: () => void) {
  const mo = new MutationObserver(cb)
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
  return () => mo.disconnect()
}

/** ?item= (the open item) and &task= (T508: the task open beside the epic pane) live in the URL, so reload and Back keep them. */
function setRoadmapParams(patch: Record<string, string | null>) {
  const p = new URLSearchParams(window.location.search)
  for (const [k, v] of Object.entries(patch)) {
    if (v) p.set(k, v)
    else p.delete(k)
  }
  const qs = p.toString()
  window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname)
}
const setSelectedId = (id: string | null) => setRoadmapParams({ item: id, task: null })
const setTaskId = (id: string | null) => setRoadmapParams({ task: id })

const FLOW_STYLE = { "--xy-background-color": "var(--color-bg)" } as React.CSSProperties

export function RoadmapTab() {
  const { rootParam, openDoc, board, demo, moveTask } = useApp()
  const { showAbout } = useChats()
  const { t } = useT()
  const statusLabel = useRoadmapStatusLabel()
  const flowLabels = useFlowAriaLabels()
  const router = useRouter()
  const searchParams = useSearchParams()
  const view = searchParams.get("view") === "timeline" ? "timeline" : "map"
  const setView = (v: "map" | "timeline") => {
    const params = new URLSearchParams(searchParams.toString())
    if (v === "map") params.delete("view")
    else params.set("view", v)
    const qs = params.toString()
    router.replace(qs ? `/roadmap?${qs}` : "/roadmap")
  }
  const today = localToday()
  const [items, setItems] = useState<RoadmapItem[]>([])
  const [layout, setLayout] = useState<RoadmapLayout>({})
  const [nodes, setNodes] = useState<RoadmapNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const selectedId = searchParams.get("item")
  const taskId = searchParams.get("task")
  // the sheet shows the edit form while this matches the selected item
  const [editingId, setEditingId] = useState<string | null>(null)
  const [menuAt, setMenuAt] = useState<ContextMenuState>(null)
  const [generateSource, setGenerateSource] = useState<RoadmapSource | null>(null)
  const [generating, setGenerating] = useState(false)
  // null = closed; "" = new horizon; "R001" = new feature under R001
  const [createParent, setCreateParent] = useState<string | null>(null)
  const [specOpen, setSpecOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [breakdownOpen, setBreakdownOpen] = useState(false)
  const draggingRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Like roadmap.sh: open at readable zoom, centered horizontally, from the top of the map.
  // fitView on a large roadmap shrinks text to unreadable sizes.
  const rfRef = useRef<ReactFlowInstance<RoadmapNode> | null>(null)
  // false until the map was framed once: it starts hidden when the URL opens a task (no width to frame against)
  const framedRef = useRef(false)
  const showTop = useCallback((rf: ReactFlowInstance<RoadmapNode>, duration = 0) => {
    rfRef.current = rf
    const width = containerRef.current?.clientWidth ?? 0
    const bounds = rf.getNodesBounds(rf.getNodes())
    if (!width || !bounds.width) return
    framedRef.current = true
    const zoom = Math.min(1, Math.max(MIN_INITIAL_ZOOM, (width - VIEWPORT_PAD * 2) / bounds.width))
    rf.setViewport({ x: width / 2 - (bounds.x + bounds.width / 2) * zoom, y: VIEWPORT_PAD - bounds.y * zoom, zoom }, { duration })
  }, [])
  // a roadmap_updated that arrived mid-drag; reloaded once the drag's layout POST lands
  const pendingReloadRef = useRef(false)
  // only the latest load() may apply its response (guards project switches / overlapping SSE reloads)
  const loadSeqRef = useRef(0)

  const isDark = useSyncExternalStore(
    subscribeTheme,
    () => document.documentElement.classList.contains("dark"),
    () => true,
  )

  const applyData = useCallback((nextItems: RoadmapItem[], nextLayout: RoadmapLayout) => {
    setItems(nextItems)
    setLayout(nextLayout)
    setNodes((prev) => buildNodes(nextItems, nextLayout, prev))
  }, [])

  const load = useCallback(() => {
    const seq = ++loadSeqRef.current
    type ListResponse = { items: RoadmapItem[]; layout: RoadmapLayout; generateSource?: RoadmapSource }
    return api<ListResponse>(`/api/roadmap${rootParam}`).then(({ data, error: err }) => {
      if (seq !== loadSeqRef.current) return
      setLoading(false)
      if (err) {
        setError(err)
        // never leave another project's (or stale) items on screen, editable against this root
        applyData([], {})
        setSelectedId(null)
        return
      }
      setError(null)
      setGenerateSource(data?.generateSource ?? null)
      applyData(data?.items ?? [], data?.layout ?? {})
    })
  }, [rootParam, applyData])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const es = new EventSource("/api/events")
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type !== "roadmap_updated") return
        if (draggingRef.current) pendingReloadRef.current = true
        else load()
      } catch {
        // non-JSON keepalive; ignore
      }
    }
    return () => es.close()
  }, [load])

  const edges = useMemo(() => {
    const byId = new Map(nodes.map((n) => [n.id, n]))
    const out: Edge[] = []
    const horizons = items.filter((i) => i.parent === null).sort((a, b) => a.order - b.order)
    horizons.forEach((h, i) => {
      const a = byId.get(h.id)
      const next = horizons[i + 1] && byId.get(horizons[i + 1].id)
      if (a && next) out.push(edge(`spine-${h.id}`, a, next, true))
    })
    for (const item of items) {
      const p = item.parent && byId.get(item.parent)
      const c = byId.get(item.id)
      if (p && c && p.type === "horizon") out.push(edge(`branch-${item.id}`, p, c, false))
    }
    return out
  }, [items, nodes])

  // board is refreshed by AppContext on task_updated, so progress/drift follow task moves live
  const tasksById = useMemo<Record<string, Task>>(
    () => Object.fromEntries(Object.values(board ?? {}).flat().map((t) => [t.id, t])),
    [board],
  )
  const health = useMemo(() => roadmapHealth(items, tasksById, today), [items, tasksById, today])

  const shownNodes = useMemo(() => {
    const allTasks = Object.values(tasksById)
    // chapters number real horizons only; orphans on the spine get none
    const chapters = new Map(items.filter((i) => i.parent === null).sort((a, b) => a.order - b.order).map((h, i) => [h.id, i + 1]))
    return nodes.map((n) => {
      const { item } = n.data
      const kids = items.filter((i) => i.parent === item.id)
      const next = n.type === "feature" && item.status === "in-progress" ? pickNextTask(item, allTasks) : null
      return {
        ...n,
        data: {
          ...n.data,
          progress: health.progress[n.id],
          drift: health.drift.filter((d) => d.id === n.id).map((d) => driftText(d, t, statusLabel)),
          dueState: dueState(item.due, item.status, today),
          ...(n.type === "feature" && {
            ...taskDueFields(item.tasks, tasksById, today),
            taskStatuses: item.tasks.map((id) => tasksById[id]?.status).filter((s): s is TaskStatus => !!s && s !== "cancelled"),
            nextTaskId: next?.kind === "ready" ? next.taskId : null,
          }),
          ...(n.type === "horizon" && {
            chapter: chapters.get(item.id),
            epics: { done: kids.filter((k) => k.status === "done").length, total: kids.length },
          }),
        },
      }
    })
  }, [nodes, items, health, today, tasksById, t, statusLabel])

  const onNodesChange = useCallback(
    (changes: NodeChange<RoadmapNode>[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [],
  )

  function onDragStop(dragged: RoadmapNode[]) {
    draggingRef.current = false
    const positions: RoadmapLayout = Object.fromEntries(
      dragged.map((n) => [n.id, { x: Math.round(n.position.x), y: Math.round(n.position.y) }]),
    )
    // children without a saved position follow their horizon immediately
    applyData(items, { ...layout, ...positions })
    api(`/api/roadmap/layout${rootParam}`, { positions }).then(({ error: err }) => {
      if (err) setError(err)
      if (pendingReloadRef.current) {
        pendingReloadRef.current = false
        load()
      }
    })
  }

  const [arranging, setArranging] = useState(false)

  /** Tidy the whole map: every node glides to its arranged spot, then the layout is saved (Undo puts the old one back). */
  function arrange() {
    const round = (p: { x: number; y: number }) => ({ x: Math.round(p.x), y: Math.round(p.y) })
    const heights = new Map(nodes.map((n) => [n.id, n.measured?.height ?? 48]))
    const before = resolvePositions(items, layout)
    const after: RoadmapLayout = Object.fromEntries(
      Object.entries(arrangePositions(items, (id) => heights.get(id) ?? 48)).map(([id, p]) => [id, round(p)]),
    )
    const previous: RoadmapLayout = Object.fromEntries(Object.entries(before).map(([id, p]) => [id, round(p)]))
    setArranging(true)
    const finish = () => {
      applyData(items, { ...layout, ...after })
      setArranging(false)
      requestAnimationFrame(() => { if (rfRef.current) showTop(rfRef.current, 320) })
      api(`/api/roadmap/layout${rootParam}`, { positions: after }).then(({ error: err }) => {
        if (err) return setError(err)
        undoToast(t("roadmap.arranged"), async () => {
          const { error: undoErr } = await api(`/api/roadmap/layout${rootParam}`, { positions: previous })
          if (undoErr) throw new Error(undoErr)
          await load()
        })
      })
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return finish()
    // ponytail: JS tween of node positions (edges follow because they're derived from nodes); ~40 nodes is cheap
    const from = new Map(nodes.map((n) => [n.id, n.position]))
    const t0 = performance.now()
    const DURATION = 420
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / DURATION)
      const e = 1 - Math.pow(1 - k, 4) // ease-out-quart
      setNodes((nds) => nds.map((n) => {
        const a = from.get(n.id), b = after[n.id]
        return a && b ? { ...n, position: { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e } } : n
      }))
      if (k < 1) requestAnimationFrame(step)
      else finish()
    }
    requestAnimationFrame(step)
  }

  async function generate() {
    setGenerating(true)
    setError(null)
    const { data, error: err } = await api<{ items: RoadmapItem[] }>(`/api/roadmap/generate${rootParam}`, {})
    if (err) {
      setError(err)
      setGenerating(false)
      return
    }
    // freeze the generated arrangement so later additions don't shift auto-placed horizons
    const positions: RoadmapLayout = Object.fromEntries(
      Object.entries(resolvePositions(data?.items ?? [], {})).map(([id, p]) => [id, { x: Math.round(p.x), y: Math.round(p.y) }]),
    )
    const { error: layoutErr } = await api(`/api/roadmap/layout${rootParam}`, { positions })
    await load()
    if (layoutErr) setError(layoutErr)
    setGenerating(false)
  }

  const openTaskCount = Object.values(board ?? {}).flat().filter((t) => t.status !== "cancelled").length
  // A roadmap generated from the project's own ROADMAP.md or tasks is the one-click start; otherwise the agent plans it
  const fromFiles = generateSource === "roadmap-md" || generateSource === "tasks"
  const sourceLabel =
    generateSource === "roadmap-md" ? t("roadmap.sourceRoadmapMd")
      : generateSource === "tasks" ? t("roadmap.sourceTasks", { n: openTaskCount })
        : t("roadmap.sourceStarter")

  async function createItem(title: string): Promise<string | null> {
    const { error: err } = await api(`/api/roadmap/create${rootParam}`, {
      title,
      parent: createParent || null,
    })
    if (err) return err
    await load()
    return null
  }

  async function saveItem(id: string, patch: UpdateRoadmapItemPatch): Promise<string | null> {
    // Optimistic: the patch's fields are the item's fields; a failed write reloads the files
    applyData(items.map((i) => (i.id === id ? { ...i, ...patch } as RoadmapItem : i)), layout)
    const { data, error: err } = await api<{ item: RoadmapItem }>(`/api/roadmap/update${rootParam}`, { id, patch })
    if (err) { await load(); return err }
    const updated = data?.item
    if (updated) applyData(items.map((i) => (i.id === id ? updated : i)), layout)
    else await load()
    return null
  }

  async function deleteItem(id: string): Promise<string | null> {
    type Deleted = { file: string; raw: string; position: { x: number; y: number } | null }
    const { data, error: err } = await api<Deleted>(`/api/roadmap/delete${rootParam}`, { id })
    if (err) return err
    applyData(items.filter((i) => i.id !== id), layout)
    if (data) {
      undoToast(t("board.deletedId", { id }), async () => {
        const { error: undoErr } = await api(`/api/roadmap/restore${rootParam}`, data)
        if (undoErr) throw new Error(undoErr)
        await load()
      })
    }
    return null
  }

  const selected = items.find((i) => i.id === selectedId) ?? null
  // T508: an epic docks on the left; a task clicked in it fills the rest (map hidden behind it). Horizons keep the sheet.
  const epic = selected && selected.parent !== null ? selected : null
  const openTask = epic && taskId ? tasksById[taskId] ?? null : null
  const editingEpic = !!epic && editingId === epic.id

  // Esc closes the task first, then the epic. Dialogs, menus and pickers handle their own Esc.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape" || !shouldHandleShortcut(e)) return
      if (document.querySelector("[role=dialog],[role=menu],[role=listbox],[data-radix-popper-content-wrapper]")) return
      if (openTask) setTaskId(null)
      else if (epic && !editingEpic) setSelectedId(null)
      else return
      e.preventDefault()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [openTask, epic, editingEpic])

  // the map was hidden behind a task on load: frame it once it shows
  const mapShown = !openTask
  useEffect(() => {
    if (mapShown && !framedRef.current && rfRef.current) {
      const rf = rfRef.current
      requestAnimationFrame(() => showTop(rf))
    }
  }, [mapShown, showTop])

  const report = (err: string | null) => { if (err) setError(err) }
  const actions: ItemActions = {
    edit: (id) => { setSelectedId(id); setEditingId(id) },
    setStatus: (id, status) => { saveItem(id, { status }).then(report) },
    move: (id, horizonId) => { saveItem(id, { parent: horizonId }).then(report) },
    addEpic: (horizonId) => { setSelectedId(null); setCreateParent(horizonId) },
    duplicate: async (id) => {
      const src = items.find((i) => i.id === id)
      if (!src) return
      const { data, error: err } = await api<{ item: RoadmapItem }>(`/api/roadmap/create${rootParam}`, {
        title: t("roadmap.copyTitle", { title: src.title }),
        parent: src.parent,
        status: "planned",
        order: src.order + 1,
        due: src.due,
        body: src.body,
      })
      if (err) return setError(err)
      await load()
      if (data?.item) setSelectedId(data.item.id)
    },
    openFile: (file) => openDoc(file),
    chat: (id) => { setSelectedId(null); showAbout({ kind: "epic", id }) },
    remove: async (id) => {
      const err = await deleteItem(id)
      if (err) return setError(err)
      if (selectedId === id) setSelectedId(null)
    },
  }
  const openMenu = (id: string, e: React.MouseEvent) => {
    if (demo) return
    e.preventDefault()
    setMenuAt({ id, x: e.clientX, y: e.clientY })
  }

  const dialog = (
    <>
      <NewItemDialog
        open={createParent !== null}
        heading={createParent ? t("roadmap.newFeatureUnder", { id: createParent }) : t("roadmap.newHorizon")}
        onOpenChange={(v) => { if (!v) setCreateParent(null) }}
        onSubmit={createItem}
      />
      <PlanFromSpecDialog open={specOpen} onOpenChange={setSpecOpen} />
      <ReleaseNotesDialog open={notesOpen} onOpenChange={setNotesOpen} />
      <BreakdownEpicsDialog open={breakdownOpen} onOpenChange={setBreakdownOpen} items={items} />
    </>
  )

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-sm text-muted">{t("roadmap.loading")}</div>
  }

  if (items.length === 0) {
    return (
      <div className="flex-1 p-6">
        {error && <p className="mb-4 text-sm text-danger">{error}</p>}
        <EmptyState
          bordered
          icon="🗺️"
          message={t("roadmap.noRoadmap")}
          lead={t("roadmap.noRoadmapLead")}
          action={demo ? undefined : fromFiles ? (
            <Button size="sm" onClick={generate} disabled={generating} className="bg-accent text-accent-fg hover:bg-accent/90">
              <Sparkles /> {generating ? t("roadmap.generating") : t("roadmap.generateRoadmap")}
            </Button>
          ) : <CopyCommand prompt={false} command="/vibedoc:roadmap" />}
          needsAgent={!demo && !fromFiles}
        />
        {!demo && <div className="mt-4 flex flex-col items-center gap-2">
          {fromFiles && <p className="text-xs text-muted">{t("roadmap.generateHint", { source: sourceLabel })}</p>}
          <div className="flex flex-wrap justify-center gap-2">
            {!fromFiles && (
              <Button size="sm" variant="outline" onClick={generate} disabled={generating} title={t("roadmap.generateHint", { source: sourceLabel })}>
                <Sparkles /> {generating ? t("roadmap.generating") : t("roadmap.generateStarter")}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => askAgent("Plan a roadmap for this project.")} disabled={generating}>
              <Bot /> {t("roadmap.planWithAgent")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setSpecOpen(true)} disabled={generating}>
              <FileText /> {t("roadmap.planFromSpec")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setCreateParent("")} disabled={generating}>
              <Plus /> {t("roadmap.createFirstHorizon")}
            </Button>
          </div>
        </div>}
        {dialog}
      </div>
    )
  }

  return (
    <div className="relative flex flex-1 min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-3 py-2">
        <div className="flex rounded-md border border-border p-0.5 text-xs">
          {(["map", "timeline"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                "whitespace-nowrap rounded-sm px-3 py-1",
                view === v ? "bg-surface2 text-txt" : "text-muted hover:text-txt",
              )}
            >
              {v === "map" ? t("roadmap.viewMap") : t("board.viewTimeline")}
            </button>
          ))}
        </div>
        <RoadmapStats items={items} tasksById={tasksById} />
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {error && <p className="text-xs text-danger">{error}</p>}
          {health.drift.length > 0 && (
            <AttentionMenu
              drift={health.drift}
              onSelect={setSelectedId}
              onApply={demo ? undefined : (d) => d.suggestedStatus && saveItem(d.id, { status: d.suggestedStatus }).then((err) => { if (err) setError(err) })}
            />
          )}
          {!demo && <>
          {view === "map" && (
            <Button size="sm" variant="outline" onClick={arrange} disabled={arranging} title={t("roadmap.arrangeTitle")}>
              <LayoutGrid /> {t("roadmap.arrange")}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setSpecOpen(true)}>
            <FileText /> {t("roadmap.planFromSpec")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setNotesOpen(true)}>
            <ScrollText /> {t("roadmap.releaseNotes")}
          </Button>
          {items.some((i) => i.parent !== null && i.status !== "done") && (
            <Button size="sm" variant="outline" onClick={() => setBreakdownOpen(true)}>
              <ListTree /> {t("roadmap.breakDownEpicsEllipsis")}
            </Button>
          )}
          <Button size="sm" onClick={() => setCreateParent("")} className="bg-accent text-accent-fg hover:bg-accent/90">
            <Plus /> {t("roadmap.horizon")}
          </Button>
          </>}
        </div>
      </div>

      {/* Below lg one of pane / map / task shows at a time, like /manual-tests */}
      <div className="flex min-h-0 flex-1">
        {epic && (
          <aside
            aria-label={`${epic.id} · ${epic.title}`}
            className={cn(
              "min-h-0 w-full flex-col overflow-y-auto border-r border-border bg-surface text-txt animate-list-in lg:w-[min(44%,30rem)] lg:shrink-0",
              openTask ? "hidden lg:flex" : "flex",
            )}
          >
            <RoadmapItemPane
              item={epic}
              items={items}
              onClose={() => setSelectedId(null)}
              editing={!!selected && editingId === selected.id}
              onEditingChange={(v) => setEditingId(v ? selectedId : null)}
              actions={actions}
              onSave={saveItem}
              onDelete={deleteItem}
              onAddFeature={(parentId) => { setSelectedId(null); setCreateParent(parentId) }}
              onEditRaw={(file) => { openDoc(file) }}
              onOpenTask={setTaskId}
              selectedTaskId={openTask?.id ?? null}
              tasksById={tasksById}
              progressById={health.progress}
              onSelect={setSelectedId}
            />
          </aside>
        )}
        <div className={cn("relative min-h-0 min-w-0 flex-1 flex-col", openTask ? "hidden" : epic ? "hidden lg:flex" : "flex")}>
        {view === "map" ? (
          <div ref={containerRef} className="relative flex-1 min-h-0">
            <ReactFlow<RoadmapNode>
              nodes={shownNodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              nodesDraggable={!demo}
              onNodeClick={(_, n) => setSelectedId(n.id)}
              onNodeContextMenu={(e, n) => openMenu(n.id, e)}
              onNodeDragStart={() => { draggingRef.current = true }}
              onNodeDragStop={(_, __, dragged) => onDragStop(dragged)}
              nodesConnectable={false}
              deleteKeyCode={null}
              colorMode={isDark ? "dark" : "light"}
              onInit={showTop}
              minZoom={0.2}
              ariaLabelConfig={flowLabels}
              style={FLOW_STYLE}
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
              <Controls showInteractive={false} />
            </ReactFlow>
          </div>
        ) : (
          <RoadmapTimeline items={items} today={today} onSelect={setSelectedId} onItemContextMenu={openMenu} progressById={health.progress} />
        )}
        </div>
        {epic && openTask && (
          <section aria-label={`${openTask.id} · ${openTask.title}`} data-task-detail={openTask.id} className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-surface text-txt">
            <button type="button" onClick={() => setTaskId(null)} className="flex shrink-0 items-center gap-1 border-b border-border px-5 py-2 text-left text-xs text-muted hover:text-txt lg:hidden">
              <ChevronLeft className="size-3.5" aria-hidden /> {t("roadmap.backToEpic", { id: epic.id })}
            </button>
            <button type="button" onClick={() => setTaskId(null)} aria-label={t("roadmap.closeTask", { id: openTask.id })} className="absolute right-4 top-4 z-10 hidden size-6 place-items-center rounded-xs text-muted opacity-70 transition-opacity hover:opacity-100 focus:outline-hidden focus:ring-2 focus:ring-accent lg:grid">
              <X className="h-4 w-4" />
            </button>
            <TaskDetailBody key={openTask.id} task={openTask} onClose={() => setTaskId(null)} onMove={moveTask} />
          </section>
        )}
      </div>

      <RoadmapItemSheet
        item={epic ? null : selected}
        items={items}
        onClose={() => setSelectedId(null)}
        editing={!!selected && editingId === selected.id}
        onEditingChange={(v) => setEditingId(v ? selectedId : null)}
        actions={actions}
        onSave={saveItem}
        onDelete={deleteItem}
        onAddFeature={(parentId) => { setSelectedId(null); setCreateParent(parentId) }}
        onEditRaw={(file) => { openDoc(file) }}
        onOpenTask={setTaskId}
        selectedTaskId={openTask?.id ?? null}
        tasksById={tasksById}
        progressById={health.progress}
        onSelect={setSelectedId}
      />
      <ItemContextMenu at={menuAt} items={items} actions={actions} onClose={() => setMenuAt(null)} />
      {dialog}
    </div>
  )
}

/** Epic counts by status double as the legend; tasks = every task linked to an epic. */
function RoadmapStats({ items, tasksById }: { items: RoadmapItem[]; tasksById: Record<string, Task> }) {
  const epics = items.filter((i) => i.parent !== null)
  const count = (st: RoadmapItem["status"]) => epics.filter((e) => e.status === st).length
  const linked = [...new Set(epics.flatMap((e) => e.tasks))].map((id) => tasksById[id]).filter((t) => t && t.status !== "cancelled")
  const done = linked.filter((t) => t.status === "done").length
  const { t } = useT()
  const statusLabel = useRoadmapStatusLabel()
  return (
    <div className="hidden items-center gap-4 whitespace-nowrap font-mono text-[11px] text-muted md:flex">
      {(["in-progress", "paused", "done", "planned"] as const).filter((st) => st !== "paused" || count(st) > 0).map((st) => (
        <span key={st} className="flex items-center gap-1.5">
          <StatusDot status={st} />
          <span className={cn("tabular-nums", st === "in-progress" && count(st) > 0 ? "text-accent" : "text-txt")}>{count(st)}</span>
          {statusLabel(st).toLowerCase()}
        </span>
      ))}
      {linked.length > 0 && (
        <span className="flex items-center gap-2 border-l border-border pl-4">
          <span className="relative h-1 w-20 overflow-hidden rounded-full bg-border">
            <span className="absolute inset-y-0 left-0 rounded-full bg-teal" style={{ width: `${(done / linked.length) * 100}%` }} />
          </span>
          <span><span className="tabular-nums text-txt">{done}/{linked.length}</span> {t("roadmap.tasksWord")}</span>
        </span>
      )}
    </div>
  )
}

/** Amber pill with the drift count; opens the list (closed by default so it never covers the map). */
function AttentionMenu({ drift, onSelect, onApply }: {
  drift: RoadmapDrift[]
  onSelect: (id: string) => void
  /** Missing in the read-only demo: no "→ status" buttons */
  onApply?: (d: RoadmapDrift) => void
}) {
  const { t } = useT()
  const statusLabel = useRoadmapStatusLabel()
  return (
    <details className="group relative">
      <summary className="flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-md border border-amber/40 bg-amber/10 px-2.5 text-xs font-medium text-txt hover:bg-amber/15 [&::-webkit-details-marker]:hidden">
        <AlertTriangle className="h-3.5 w-3.5 text-amber" /> {t("roadmap.needAttention", { n: drift.length })}
      </summary>
      <ul className="absolute right-0 top-full z-30 mt-1.5 max-h-72 w-80 overflow-y-auto rounded-lg border border-border bg-surface text-xs shadow-xl">
        {drift.map((d) => (
          <li key={`${d.id}-${d.kind}`} className="flex items-start gap-2 border-b border-border px-3 py-2.5 last:border-0">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber" />
            <button type="button" onClick={() => onSelect(d.id)} className="flex-1 text-left leading-relaxed text-muted hover:text-txt">
              {driftText(d, t, statusLabel)}
            </button>
            {d.suggestedStatus && onApply && (
              <button
                type="button"
                onClick={() => onApply(d)}
                className="shrink-0 rounded-sm border border-border px-1.5 py-0.5 font-mono text-[10px] text-txt hover:border-accent hover:text-accent"
                title={t("roadmap.setStatusTo", { status: statusLabel(d.suggestedStatus).toLowerCase() })}
              >
                → {statusLabel(d.suggestedStatus).toLowerCase()}
              </button>
            )}
          </li>
        ))}
      </ul>
    </details>
  )
}
