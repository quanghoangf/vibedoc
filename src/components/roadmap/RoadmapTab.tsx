"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import {
  Background,
  BackgroundVariant,
  Controls,
  Panel,
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
import { AlertTriangle, Plus } from "lucide-react"
import { useApp } from "@/context/AppContext"
import { EmptyState } from "@/components/shared/EmptyState"
import { Button } from "@/components/ui/button"
import type { RoadmapItem, RoadmapLayout, TaskStatus, UpdateRoadmapItemPatch } from "@/types"
import { roadmapHealth, type RoadmapDrift } from "@/lib/roadmap-health"
import { FEATURE_W, HORIZON_W, resolvePositions } from "./layout"
import { StatusBadge, nodeTypes, type RoadmapNode } from "./RoadmapNodes"
import { RoadmapItemSheet } from "./RoadmapItemSheet"
import { NewItemDialog } from "./NewItemDialog"

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
    style: spine
      ? { stroke: "var(--color-accent)", strokeWidth: 4 }
      : { stroke: "var(--color-accent)", strokeWidth: 2, strokeDasharray: "2 6", strokeLinecap: "round", opacity: 0.7 },
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
  const [items, setItems] = useState<RoadmapItem[]>([])
  const [layout, setLayout] = useState<RoadmapLayout>({})
  const [nodes, setNodes] = useState<RoadmapNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // null = closed; "" = new horizon; "R001" = new feature under R001
  const [createParent, setCreateParent] = useState<string | null>(null)
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
    return api<{ items: RoadmapItem[]; layout: RoadmapLayout }>(`/api/roadmap${rootParam}`).then(({ data, error: err }) => {
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
  const health = useMemo(() => {
    const taskStatus: Record<string, TaskStatus> = {}
    for (const t of Object.values(board ?? {}).flat()) taskStatus[t.id] = t.status
    return roadmapHealth(items, taskStatus)
  }, [items, board])

  const shownNodes = useMemo(() => nodes.map((n) => ({
    ...n,
    data: {
      ...n.data,
      progress: health.progress[n.id],
      drift: health.drift.filter((d) => d.id === n.id).map((d) => d.message),
    },
  })), [nodes, health])

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
    <NewItemDialog
      open={createParent !== null}
      heading={createParent ? `New feature under ${createParent}` : "New horizon"}
      onOpenChange={(v) => { if (!v) setCreateParent(null) }}
      onSubmit={createItem}
    />
  )

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-sm text-muted">Loading…</div>
  }

  if (items.length === 0) {
    return (
      <div className="flex-1 p-6">
        {error && <p className="mb-4 text-sm text-danger">{error}</p>}
        <EmptyState icon="🗺️" message="No roadmap yet" subMessage="Items live in plans/roadmap/R*.md" bordered />
        <div className="mt-4 flex justify-center">
          <Button size="sm" onClick={() => setCreateParent("")} className="bg-accent text-white hover:bg-accent/90">
            <Plus /> Create first horizon
          </Button>
        </div>
        {dialog}
      </div>
    )
  }

  return (
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
        <Panel position="top-left">
          <div className="flex flex-col gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-xs text-muted shadow-sm">
            <span className="flex items-center gap-2"><StatusBadge status="done" /> Done</span>
            <span className="flex items-center gap-2"><StatusBadge status="in-progress" /> In progress</span>
            <span className="flex items-center gap-2"><StatusBadge status="planned" /> Planned</span>
          </div>
          {health.drift.length > 0 && (
            <DriftPanel
              drift={health.drift}
              onSelect={setSelectedId}
              onApply={(d) => d.suggestedStatus && saveItem(d.id, { status: d.suggestedStatus }).then((err) => { if (err) setError(err) })}
            />
          )}
        </Panel>
        <Panel position="top-right">
          <Button size="sm" onClick={() => setCreateParent("")} className="bg-accent text-white hover:bg-accent/90">
            <Plus /> Horizon
          </Button>
        </Panel>
        {error && (
          <Panel position="bottom-center">
            <p className="rounded-md border border-danger/40 bg-surface px-3 py-1.5 text-xs text-danger">{error}</p>
          </Panel>
        )}
      </ReactFlow>
      <RoadmapItemSheet
        item={selected}
        items={items}
        onClose={() => setSelectedId(null)}
        onSave={saveItem}
        onDelete={deleteItem}
        onAddFeature={(parentId) => { setSelectedId(null); setCreateParent(parentId) }}
        onEditRaw={(file) => { openDoc(file) }}
      />
      {dialog}
    </div>
  )
}

function DriftPanel({ drift, onSelect, onApply }: {
  drift: RoadmapDrift[]
  onSelect: (id: string) => void
  onApply: (d: RoadmapDrift) => void
}) {
  return (
    <div className="mt-2 w-72 rounded-md border border-amber/50 bg-surface text-xs shadow-sm">
      <p className="flex items-center gap-1.5 border-b border-border px-3 py-2 font-medium text-amber">
        <AlertTriangle className="h-3.5 w-3.5" /> {drift.length} out of sync with tasks
      </p>
      <ul className="max-h-60 overflow-y-auto">
        {drift.map((d) => (
          <li key={`${d.id}-${d.kind}`} className="flex items-start gap-2 border-b border-border px-3 py-2 last:border-0">
            <button type="button" onClick={() => onSelect(d.id)} className="flex-1 text-left text-muted hover:text-txt">
              {d.message}
            </button>
            {d.suggestedStatus && (
              <button
                type="button"
                onClick={() => onApply(d)}
                className="shrink-0 rounded-sm border border-border px-1.5 py-0.5 text-txt hover:border-accent"
                title={`Set status to ${d.suggestedStatus}`}
              >
                → {d.suggestedStatus}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
