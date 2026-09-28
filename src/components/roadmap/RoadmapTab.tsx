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
import { AlertTriangle, Bot, FileText, Plus, Sparkles } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useApp } from "@/context/AppContext"
import { EmptyState } from "@/components/shared/EmptyState"
import { Button } from "@/components/ui/button"
import type { RoadmapItem, RoadmapLayout, RoadmapSource, Task, TaskStatus, UpdateRoadmapItemPatch } from "@/types"
import { pickNextTask } from "@/lib/work-queue"
import { dueState, localToday, roadmapHealth, taskDueSummary, type RoadmapDrift, type TaskInfo } from "@/lib/roadmap-health"
import { cn } from "@/lib/utils"
import { askAgent } from "@/lib/ask-agent"
import { RoadmapTimeline } from "./RoadmapTimeline"
import { FEATURE_W, HORIZON_W, resolvePositions } from "./layout"
import { STATUS_LABEL, StatusDot, nodeTypes, type RoadmapNode } from "./RoadmapNodes"
import { RoadmapItemSheet } from "./RoadmapItemSheet"
import { NewItemDialog } from "./NewItemDialog"
import { PlanFromSpecDialog } from "./PlanFromSpecDialog"

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
    if (!res.ok) return { error: json?.error ?? `Request failed (${res.status})` }
    return { data: json as T }
  } catch {
    return { error: "Could not reach the server" }
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

const FLOW_STYLE = { "--xy-background-color": "var(--color-bg)" } as React.CSSProperties

export function RoadmapTab() {
  const { rootParam, openDoc, board } = useApp()
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
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [generateSource, setGenerateSource] = useState<RoadmapSource | null>(null)
  const [generating, setGenerating] = useState(false)
  // null = closed; "" = new horizon; "R001" = new feature under R001
  const [createParent, setCreateParent] = useState<string | null>(null)
  const [specOpen, setSpecOpen] = useState(false)
  const draggingRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Like roadmap.sh: open at readable zoom, centered horizontally, from the top of the map.
  // fitView on a large roadmap shrinks text to unreadable sizes.
  const showTop = useCallback((rf: ReactFlowInstance<RoadmapNode>) => {
    const width = containerRef.current?.clientWidth ?? 0
    const bounds = rf.getNodesBounds(rf.getNodes())
    if (!width || !bounds.width) return
    const zoom = Math.min(1, Math.max(MIN_INITIAL_ZOOM, (width - VIEWPORT_PAD * 2) / bounds.width))
    rf.setViewport({ x: width / 2 - (bounds.x + bounds.width / 2) * zoom, y: VIEWPORT_PAD - bounds.y * zoom, zoom })
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
          drift: health.drift.filter((d) => d.id === n.id).map((d) => d.message),
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
  }, [nodes, items, health, today, tasksById])

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
  const sourceLabel =
    generateSource === "roadmap-md" ? "from ROADMAP.md"
      : generateSource === "tasks" ? `from ${openTaskCount} tasks, grouped by phase`
        : "starter horizons: Shipped · Now · Next · Later"

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
    const { data, error: err } = await api<{ item: RoadmapItem }>(`/api/roadmap/update${rootParam}`, { id, patch })
    if (err) return err
    const updated = data?.item
    if (updated) applyData(items.map((i) => (i.id === id ? updated : i)), layout)
    else await load()
    return null
  }

  async function deleteItem(id: string): Promise<string | null> {
    const { error: err } = await api(`/api/roadmap/delete${rootParam}`, { id })
    if (err) return err
    applyData(items.filter((i) => i.id !== id), layout)
    return null
  }

  const selected = items.find((i) => i.id === selectedId) ?? null

  const dialog = (
    <>
      <NewItemDialog
        open={createParent !== null}
        heading={createParent ? `New feature under ${createParent}` : "New horizon"}
        onOpenChange={(v) => { if (!v) setCreateParent(null) }}
        onSubmit={createItem}
      />
      <PlanFromSpecDialog open={specOpen} onOpenChange={setSpecOpen} />
    </>
  )

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-sm text-muted">Loading…</div>
  }

  if (items.length === 0) {
    return (
      <div className="flex-1 p-6">
        {error && <p className="mb-4 text-sm text-danger">{error}</p>}
        <EmptyState icon="🗺️" message="No roadmap yet" subMessage="Items live in plans/roadmap/R*.md" bordered />
        <div className="mt-4 flex flex-col items-center gap-2">
          <div className="flex gap-2">
            <Button size="sm" onClick={generate} disabled={generating} className="bg-accent text-white hover:bg-accent/90">
              <Sparkles /> {generating ? "Generating…" : "Generate roadmap"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => askAgent("Plan a roadmap for this project.")} disabled={generating}>
              <Bot /> Plan with agent
            </Button>
            <Button size="sm" variant="outline" onClick={() => setSpecOpen(true)} disabled={generating}>
              <FileText /> Plan from spec
            </Button>
            <Button size="sm" variant="outline" onClick={() => setCreateParent("")} disabled={generating}>
              <Plus /> Create first horizon
            </Button>
          </div>
          <p className="text-xs text-muted">Generate {sourceLabel}. Existing files are not modified.</p>
        </div>
        {dialog}
      </div>
    )
  }

  return (
    <div className="relative flex flex-1 min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-4 border-b border-border px-3 py-2">
        <div className="flex rounded-md border border-border p-0.5 text-xs">
          {(["map", "timeline"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                "rounded-sm px-3 py-1 capitalize",
                view === v ? "bg-surface2 text-txt" : "text-muted hover:text-txt",
              )}
            >
              {v}
            </button>
          ))}
        </div>
        <RoadmapStats items={items} tasksById={tasksById} />
        <div className="ml-auto flex items-center gap-2">
          {error && <p className="text-xs text-danger">{error}</p>}
          {health.drift.length > 0 && (
            <AttentionMenu
              drift={health.drift}
              onSelect={setSelectedId}
              onApply={(d) => d.suggestedStatus && saveItem(d.id, { status: d.suggestedStatus }).then((err) => { if (err) setError(err) })}
            />
          )}
          <Button size="sm" variant="outline" onClick={() => setSpecOpen(true)}>
            <FileText /> Plan from spec
          </Button>
          <Button size="sm" onClick={() => setCreateParent("")} className="bg-accent text-white hover:bg-accent/90">
            <Plus /> Horizon
          </Button>
        </div>
      </div>

      {view === "map" ? (
        <div ref={containerRef} className="relative flex-1 min-h-0">
          <ReactFlow<RoadmapNode>
            nodes={shownNodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onNodeClick={(_, n) => setSelectedId(n.id)}
            onNodeDragStart={() => { draggingRef.current = true }}
            onNodeDragStop={(_, __, dragged) => onDragStop(dragged)}
            nodesConnectable={false}
            deleteKeyCode={null}
            colorMode={isDark ? "dark" : "light"}
            onInit={showTop}
            minZoom={0.2}
            style={FLOW_STYLE}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
      ) : (
        <RoadmapTimeline items={items} today={today} onSelect={setSelectedId} />
      )}

      <RoadmapItemSheet
        item={selected}
        items={items}
        onClose={() => setSelectedId(null)}
        onSave={saveItem}
        onDelete={deleteItem}
        onAddFeature={(parentId) => { setSelectedId(null); setCreateParent(parentId) }}
        onEditRaw={(file) => { openDoc(file) }}
        tasksById={tasksById}
        progressById={health.progress}
        onSelect={setSelectedId}
      />
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
  return (
    <div className="hidden items-center gap-4 font-mono text-[11px] text-muted md:flex">
      {(["in-progress", "done", "planned"] as const).map((st) => (
        <span key={st} className="flex items-center gap-1.5">
          <StatusDot status={st} />
          <span className={cn("tabular-nums", st === "in-progress" && count(st) > 0 ? "text-accent" : "text-txt")}>{count(st)}</span>
          {STATUS_LABEL[st].toLowerCase()}
        </span>
      ))}
      {linked.length > 0 && (
        <span className="flex items-center gap-2 border-l border-border pl-4">
          <span className="relative h-1 w-20 overflow-hidden rounded-full bg-border">
            <span className="absolute inset-y-0 left-0 rounded-full bg-teal" style={{ width: `${(done / linked.length) * 100}%` }} />
          </span>
          <span><span className="tabular-nums text-txt">{done}/{linked.length}</span> tasks</span>
        </span>
      )}
    </div>
  )
}

/** Amber pill with the drift count; opens the list (closed by default so it never covers the map). */
function AttentionMenu({ drift, onSelect, onApply }: {
  drift: RoadmapDrift[]
  onSelect: (id: string) => void
  onApply: (d: RoadmapDrift) => void
}) {
  return (
    <details className="group relative">
      <summary className="flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-md border border-amber/40 bg-amber/10 px-2.5 text-xs font-medium text-amber hover:bg-amber/15 [&::-webkit-details-marker]:hidden">
        <AlertTriangle className="h-3.5 w-3.5" /> {drift.length} need attention
      </summary>
      <ul className="absolute right-0 top-full z-30 mt-1.5 max-h-72 w-80 overflow-y-auto rounded-lg border border-border bg-surface text-xs shadow-xl">
        {drift.map((d) => (
          <li key={`${d.id}-${d.kind}`} className="flex items-start gap-2 border-b border-border px-3 py-2.5 last:border-0">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber" />
            <button type="button" onClick={() => onSelect(d.id)} className="flex-1 text-left leading-relaxed text-muted hover:text-txt">
              {d.message}
            </button>
            {d.suggestedStatus && (
              <button
                type="button"
                onClick={() => onApply(d)}
                className="shrink-0 rounded-sm border border-border px-1.5 py-0.5 font-mono text-[10px] text-txt hover:border-accent hover:text-accent"
                title={`Set status to ${d.suggestedStatus}`}
              >
                → {d.suggestedStatus}
              </button>
            )}
          </li>
        ))}
      </ul>
    </details>
  )
}
