"use client"

import { memo, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Background, BackgroundVariant, Controls, Handle, Position, ReactFlow, type Edge, type Node, type NodeProps, type ReactFlowInstance } from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useApp } from "@/context/AppContext"
import { Button } from "@/components/ui/button"
import { KIND_ICON, useOpenNode } from "@/components/memory/EntryRelated"
import { LINK_EVENTS } from "@/components/docs/useDocLinks"
import type { DocGraph as Graph, DocNode, DocNodeKind } from "@/lib/doc-links"
import { forceLayout, neighbourhoodIds } from "./force-layout"

type DotData = { node: DocNode; size: number; dim: boolean; active: boolean; match: boolean; orphan: boolean }
type DotNode = Node<DotData, "dot">
type GraphState = { node: string | null; focus: 0 | 1 | 2; kinds: DocNodeKind[]; q: string }

const KINDS: { kind: DocNodeKind; label: string }[] = [
  { kind: "doc", label: "Docs" },
  { kind: "adr", label: "ADRs" },
  { kind: "task", label: "Tasks" },
  { kind: "epic", label: "Epics" },
  { kind: "entry", label: "Entries" },
]
const DEFAULT_KINDS: DocNodeKind[] = ["doc", "adr"]
const FLOW_STYLE = { "--xy-background-color": "var(--color-bg)" } as React.CSSProperties
// ponytail: above this many nodes only the ones on screen render (same knob as MemoryGraph)
const VIRTUALIZE_OVER = 150
// a fitted big graph is unreadable; fit no further out than this and let the user pan
const FIT_MIN_ZOOM = 0.35
// below this zoom only the selected / matching labels show, once the graph is big enough to get noisy
const LABEL_ZOOM = 0.6
const LABEL_NODES_OVER = 40
const CENTER = { left: "50%", top: "50%", transform: "translate(-50%, -50%)" }

function subscribeTheme(cb: () => void) {
  const mo = new MutationObserver(cb)
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
  return () => mo.disconnect()
}

function readState(p: URLSearchParams): GraphState {
  const f = p.get("focus")
  const kinds = p.get("kinds")?.split(",").filter((k): k is DocNodeKind => KINDS.some((x) => x.kind === k))
  return { node: p.get("node"), focus: f === "1" ? 1 : f === "2" ? 2 : 0, kinds: kinds ?? DEFAULT_KINDS, q: p.get("q") ?? "" }
}

/** Native replaceState syncs useSearchParams without a server round trip (as on /board). */
function writeState(s: GraphState) {
  const p = new URLSearchParams(window.location.search)
  const set = (k: string, v: string | null) => (v ? p.set(k, v) : p.delete(k))
  set("node", s.node)
  set("focus", s.node && s.focus ? String(s.focus) : null)
  const kinds = KINDS.map((k) => k.kind).filter((k) => s.kinds.includes(k))
  set("kinds", kinds.join(",") === DEFAULT_KINDS.join(",") ? null : kinds.join(",") || "none")
  set("q", s.q || null)
  window.history.replaceState(null, "", p.size ? `${window.location.pathname}?${p}` : window.location.pathname)
}

/** A dot sized by degree, centred on its layout point; the label hangs below and never takes clicks. */
const DotView = memo(function DotView({ data }: NodeProps<DotNode>) {
  const { node, size, dim, active, match, orphan } = data
  return (
    <div
      title={node.path}
      style={{ width: size, height: size }}
      className={cn("relative rounded-full transition-opacity", node.kind === "doc" ? "bg-muted" : node.kind === "adr" ? "bg-accent" : "bg-border2", orphan && "opacity-50", dim && "opacity-25", (active || match) && "ring-2 ring-accent ring-offset-1 ring-offset-bg")}
    >
      <Handle type="source" position={Position.Top} isConnectable={false} style={CENTER} className="opacity-0" />
      <Handle type="target" position={Position.Top} isConnectable={false} style={CENTER} className="opacity-0" />
      <span
        className={cn(
          "pointer-events-none absolute top-full left-1/2 mt-1 max-w-48 -translate-x-1/2 truncate text-[11px] whitespace-nowrap",
          active || match ? "font-medium text-txt" : "text-muted group-data-[far=true]/graph:hidden",
        )}
      >
        {node.kind !== "doc" && <span className="mr-1 font-mono text-[10px]">{node.id}</span>}
        {node.label}
      </span>
    </div>
  )
})
const nodeTypes = { dot: DotView }

/**
 * Every .md file in the project and the links between them (R056), like Obsidian's graph view. Deterministic
 * force layout per (visible nodes, edges); selection only restyles. The URL holds the state (?node&focus&kinds&q).
 */
export function DocGraph() {
  const { rootParam } = useApp()
  const router = useRouter()
  const open = useOpenNode((id) => router.push(`/memory?entry=${encodeURIComponent(id)}`))
  const params = useSearchParams()
  const key = params.toString()
  const state = useMemo(() => readState(new URLSearchParams(key)), [key])
  const update = useCallback((patch: Partial<GraphState>) => writeState({ ...readState(new URLSearchParams(window.location.search)), ...patch }), [])

  const [graph, setGraph] = useState<Graph | null>(null)
  const [tick, setTick] = useState(0)
  const [rf, setRf] = useState<ReactFlowInstance<DotNode> | null>(null)
  const [far, setFar] = useState(false)
  const isDark = useSyncExternalStore(subscribeTheme, () => document.documentElement.classList.contains("dark"), () => true)

  useEffect(() => {
    const onSse = (e: Event) => {
      if (LINK_EVENTS.has((e as CustomEvent<{ type: string }>).detail?.type)) setTick((t) => t + 1)
    }
    window.addEventListener("vibedoc:sse", onSse)
    return () => window.removeEventListener("vibedoc:sse", onSse)
  }, [])

  useEffect(() => {
    let live = true
    fetch(`/api/docs/graph${rootParam}`)
      .then((r) => r.json())
      .then((g: Graph) => { if (live) setGraph(g.nodes ? g : { nodes: [], edges: [], broken: [], targets: {} }) })
      .catch((e) => {
        console.warn("Loading the doc graph failed", e)
        if (live) setGraph({ nodes: [], edges: [], broken: [], targets: {} })
      })
    return () => { live = false }
  }, [rootParam, tick])

  // Edges are keyed by path (a task's node id is T093, its edges use the file path), so everything here is.
  const byPath = useMemo(() => new Map((graph?.nodes ?? []).map((n) => [n.path, n])), [graph])
  const counts = useMemo(() => {
    const c: Partial<Record<DocNodeKind, number>> = {}
    for (const n of graph?.nodes ?? []) c[n.kind] = (c[n.kind] ?? 0) + 1
    return c
  }, [graph])

  const selected = state.node && byPath.has(state.node) && state.kinds.includes(byPath.get(state.node)!.kind) ? state.node : null
  const focusRoot = selected && state.focus ? selected : null

  // What's on screen: the kinds that are on, cut to the focus neighbourhood. Doesn't depend on plain selection.
  const visible = useMemo(() => {
    if (!graph) return null
    const kept = new Set(graph.nodes.filter((n) => state.kinds.includes(n.kind)).map((n) => n.path))
    let edges = dedupe(graph.edges.filter((e) => e.from !== e.to && kept.has(e.from) && kept.has(e.to)))
    if (focusRoot && state.focus) {
      const near = neighbourhoodIds(edges, focusRoot, state.focus)
      for (const p of kept) if (!near.has(p)) kept.delete(p)
      edges = edges.filter((e) => kept.has(e.from) && kept.has(e.to))
    }
    return { paths: [...kept], edges }
  }, [graph, state.kinds, focusRoot, state.focus])

  const pos = useMemo(() => (visible ? forceLayout(visible.paths.map((id) => ({ id })), visible.edges) : {}), [visible])

  // Re-fit after every re-layout (filter / focus change); fitView on the component only runs once
  useEffect(() => {
    if (!rf) return
    const id = requestAnimationFrame(() => void rf.fitView({ padding: 0.1, minZoom: FIT_MIN_ZOOM, maxZoom: 1, duration: 250 }))
    return () => cancelAnimationFrame(id)
  }, [rf, pos])

  const q = state.q.trim().toLowerCase()
  const matches = useMemo(
    () => (q && visible ? visible.paths.filter((p) => { const n = byPath.get(p); return !!n && (n.label.toLowerCase().includes(q) || n.path.toLowerCase().includes(q) || n.id.toLowerCase().includes(q)) }) : []),
    [q, visible, byPath],
  )

  const { nodes, edges } = useMemo(() => {
    if (!visible) return { nodes: [] as DotNode[], edges: [] as Edge[] }
    const degree = new Map<string, number>()
    for (const e of visible.edges) for (const p of [e.from, e.to]) degree.set(p, (degree.get(p) ?? 0) + 1)
    const lit = selected ? neighbourhoodIds(visible.edges, selected, 1) : q ? new Set(matches) : null
    const matched = new Set(matches)
    const nodes: DotNode[] = visible.paths.map((p) => {
      const d = degree.get(p) ?? 0
      const size = Math.round(8 + 4 * Math.sqrt(d))
      const at = pos[p] ?? { x: 0, y: 0 }
      return {
        id: p,
        type: "dot",
        position: { x: at.x - size / 2, y: at.y - size / 2 },
        data: { node: byPath.get(p)!, size, dim: !!lit && !lit.has(p), active: p === selected, match: matched.has(p), orphan: d === 0 },
        draggable: false,
      }
    })
    const edges: Edge[] = visible.edges.map((e) => {
      const hot = !!selected && (e.from === selected || e.to === selected)
      return {
        id: `${e.from}->${e.to}`,
        source: e.from,
        target: e.to,
        type: "straight",
        style: { stroke: hot ? "var(--color-accent)" : "var(--color-border2)", strokeWidth: hot ? 1.75 : 1, opacity: lit && !hot ? 0.15 : 1 },
      }
    })
    return { nodes, edges }
  }, [visible, pos, byPath, selected, q, matches])

  const select = (p: string | null) => update({ node: p })
  const pick = (p: string) => {
    select(p)
    const at = pos[p]
    if (rf && at) void rf.setCenter(at.x, at.y, { zoom: Math.max(rf.getZoom(), 1), duration: 300 })
  }

  if (!graph) return <p className="p-6 text-sm text-muted">Loading graph…</p>
  if (!graph.edges.length) {
    return <p className="m-6 rounded-xl border border-dashed border-border p-4 text-sm text-muted">No links between docs yet. Link docs with [text](path.md) or [[name]].</p>
  }

  const sel = selected ? byPath.get(selected) : undefined
  const linksTo = selected ? new Set(graph.edges.filter((e) => e.from === selected && e.to !== selected).map((e) => e.to)).size : 0
  const linkedFrom = selected ? new Set(graph.edges.filter((e) => e.to === selected && e.from !== selected).map((e) => e.from)).size : 0

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
        {KINDS.map(({ kind, label }) => {
          const on = state.kinds.includes(kind)
          return (
            <button
              key={kind}
              type="button"
              aria-pressed={on}
              onClick={() => update({ kinds: on ? state.kinds.filter((k) => k !== kind) : [...state.kinds, kind] })}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-accent",
                on ? "border-accent bg-accent/10 text-txt" : "border-border text-muted hover:text-txt",
              )}
            >
              {label} <span className="font-mono tabular-nums text-muted">{counts[kind] ?? 0}</span>
            </button>
          )
        })}
        <label className="relative ml-auto flex items-center">
          <Search className="pointer-events-none absolute left-2 size-3.5 text-muted" aria-hidden />
          <input
            id="graph-search"
            type="search"
            value={state.q}
            placeholder="Find a file…"
            aria-label="Find a file in the graph"
            onChange={(e) => update({ q: e.target.value })}
            onKeyDown={(e) => { if (e.key === "Enter" && matches[0]) pick(matches[0]) }}
            className="h-7 w-56 rounded-md border border-border bg-surface pr-2 pl-7 text-xs text-txt outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent"
          />
        </label>
        {q && <span className="text-xs text-muted tabular-nums">{matches.length} match{matches.length === 1 ? "" : "es"}</span>}
        <span className="text-xs text-muted tabular-nums" title="Links whose target file doesn't exist">
          {graph.broken.length} broken link{graph.broken.length === 1 ? "" : "s"}
        </span>
      </div>

      <div aria-label="Doc link graph" data-far={far && nodes.length > LABEL_NODES_OVER} className="group/graph relative min-h-0 flex-1">
        <ReactFlow<DotNode>
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onInit={setRf}
          onMove={(_, vp) => setFar(vp.zoom < LABEL_ZOOM)}
          onNodeClick={(_, n) => select(n.id)}
          onNodeDoubleClick={(_, n) => open(n.data.node)}
          onPaneClick={() => select(null)}
          nodesConnectable={false}
          nodesDraggable={false}
          zoomOnDoubleClick={false}
          deleteKeyCode={null}
          colorMode={isDark ? "dark" : "light"}
          onlyRenderVisibleElements={nodes.length > VIRTUALIZE_OVER}
          fitView
          fitViewOptions={{ padding: 0.1, minZoom: FIT_MIN_ZOOM, maxZoom: 1 }}
          minZoom={0.1}
          style={FLOW_STYLE}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>

        {sel && (
          <aside aria-label="Selected file" className="absolute top-3 right-3 z-10 w-72 rounded-xl border border-border bg-surface p-3 shadow-lg">
            <div className="flex items-start gap-2">
              {(() => { const Icon = KIND_ICON[sel.kind]; return <Icon className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden /> })()}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-txt">{sel.kind !== "doc" && <span className="mr-1.5 font-mono text-[11px] text-muted">{sel.id}</span>}{sel.label}</p>
                <p className="mt-0.5 truncate font-mono text-[11px] text-muted" title={sel.path}>{sel.path}</p>
              </div>
              <button type="button" aria-label="Clear selection" onClick={() => select(null)} className="rounded p-0.5 text-muted outline-none hover:text-txt focus-visible:ring-2 focus-visible:ring-accent">
                <X className="size-3.5" />
              </button>
            </div>
            <p className="mt-2 text-xs text-muted">
              Links to <span className="font-mono tabular-nums text-txt">{linksTo}</span> · Linked from <span className="font-mono tabular-nums text-txt">{linkedFrom}</span>
            </p>
            <div className="mt-3 flex items-center gap-2">
              <Button size="sm" onClick={() => open(sel)}>Open</Button>
              <div role="group" aria-label="Focus" className="ml-auto flex items-center rounded-md border border-border text-xs">
                <span className="px-2 text-muted">Focus</span>
                {([0, 1, 2] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={state.focus === f}
                    onClick={() => update({ focus: f })}
                    className={cn("px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-accent", state.focus === f ? "bg-accent/15 text-txt" : "text-muted hover:text-txt")}
                  >
                    {f === 0 ? "Off" : f}
                  </button>
                ))}
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}

/** One edge per ordered pair (a file can link to another on many lines). */
function dedupe<E extends { from: string; to: string }>(edges: E[]): E[] {
  const seen = new Set<string>()
  return edges.filter((e) => {
    const k = `${e.from}\u0000${e.to}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}
