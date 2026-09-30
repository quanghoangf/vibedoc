"use client"

import { memo, useEffect, useMemo, useState, useSyncExternalStore } from "react"
import { Background, BackgroundVariant, Controls, Handle, Position, ReactFlow, type Edge, type Node, type NodeProps } from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { cn } from "@/lib/utils"
import { useApp } from "@/context/AppContext"
import { StatusIcon } from "@/components/shared/StatusIcon"
import { displayStatus } from "@/lib/statuses"
import type { Entry } from "@/lib/entries"
import { GRAPH_COL_W, graphLayout, type GraphNode, type MemoryGraph as Graph } from "@/lib/memory-graph"
import { KIND_ICON, useOpenNode } from "./EntryRelated"

type MemNodeData = { node: GraphNode; status?: string; unlinked: boolean; dim: boolean; active: boolean }
type MemNode = Node<MemNodeData, "mem">

const NODE_W = GRAPH_COL_W - 44
const FLOW_STYLE = { "--xy-background-color": "var(--color-bg)" } as React.CSSProperties
// ponytail: above this many nodes only the ones on screen render; measured smooth at 240 entries either way
const VIRTUALIZE_OVER = 150
// fitting a wide graph shrinks the text past reading; below this zoom, centre it and let the user pan
const FIT_MIN_ZOOM = 0.8

function subscribeTheme(cb: () => void) {
  const mo = new MutationObserver(cb)
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
  return () => mo.disconnect()
}

/** One node: kind icon (or task status), id, label. Handles left and right; edges pick a side by column. */
const MemNodeView = memo(function MemNodeView({ data }: NodeProps<MemNode>) {
  const { node, status, unlinked, dim, active } = data
  const Icon = KIND_ICON[node.kind]
  return (
    <div
      title={node.path}
      style={{ width: NODE_W }}
      className={cn(
        "flex items-center gap-2 rounded-md border bg-surface px-2.5 py-1.5 text-xs transition-opacity",
        node.kind === "entry" ? "border-border2" : "border-border",
        active && "border-accent ring-1 ring-accent",
        unlinked && "border-dashed opacity-60",
        dim && "opacity-25",
      )}
    >
      {["l", "r"].map((side) => (
        <span key={side}>
          <Handle id={side} type="source" position={side === "l" ? Position.Left : Position.Right} isConnectable={false} className="opacity-0" />
          <Handle id={`${side}-t`} type="target" position={side === "l" ? Position.Left : Position.Right} isConnectable={false} className="opacity-0" />
        </span>
      ))}
      {status ? <StatusIcon status={status} className="size-3.5 shrink-0" /> : <Icon className={cn("size-3.5 shrink-0", node.kind === "entry" ? "text-accent" : "text-muted")} aria-hidden />}
      {node.kind !== "doc" && <span className="shrink-0 font-mono text-[10px] text-muted">{node.id}</span>}
      <span className={cn("min-w-0 truncate", node.kind === "entry" ? "text-txt" : "text-muted")}>{node.label}</span>
    </div>
  )
})
const nodeTypes = { mem: MemNodeView }

/**
 * Entries and the tasks, epics, ADRs and docs they link to (R053). Deterministic layout from graphLayout();
 * selecting an entry highlights it and its neighbours. Refetches on every memory_updated SSE event.
 */
export function MemoryGraph({ entries, selectedId, onOpenEntry }: { entries: Entry[]; selectedId: string | null; onOpenEntry: (id: string) => void }) {
  const { rootParam, summary, board } = useApp()
  const open = useOpenNode(onOpenEntry)
  const [graph, setGraph] = useState<Graph | null>(null)
  const isDark = useSyncExternalStore(subscribeTheme, () => document.documentElement.classList.contains("dark"), () => true)

  useEffect(() => {
    let live = true
    fetch(`/api/memory/graph${rootParam}`)
      .then((r) => r.json())
      .then((g: Graph) => { if (live) setGraph(g.nodes ? g : { nodes: [], edges: [] }) })
      .catch((e) => {
        console.warn("Loading the memory graph failed", e)
        if (live) setGraph({ nodes: [], edges: [] })
      })
    return () => { live = false }
  }, [rootParam, summary])

  const { nodes, edges } = useMemo(() => {
    if (!graph) return { nodes: [] as MemNode[], edges: [] as Edge[] }
    const types = Object.fromEntries(entries.map((e) => [e.id, e.type]))
    const pos = graphLayout(graph, types)
    const tasks = new Map(Object.values(board ?? {}).flat().map((t) => [t.id, t]))
    const linked = new Set(graph.edges.flatMap((e) => [e.from, e.to]))
    const focus = selectedId && pos[selectedId]
      ? new Set([selectedId, ...graph.edges.filter((e) => e.from === selectedId || e.to === selectedId).flatMap((e) => [e.from, e.to])])
      : null
    const nodes: MemNode[] = graph.nodes.map((n) => {
      const task = n.kind === "task" ? tasks.get(n.id) : undefined
      return {
        id: n.id,
        type: "mem",
        position: pos[n.id] ?? { x: 0, y: 0 },
        data: {
          node: n,
          status: task ? displayStatus(task) : undefined,
          unlinked: n.kind === "entry" && !linked.has(n.id),
          dim: !!focus && !focus.has(n.id),
          active: n.id === selectedId,
        },
        draggable: false,
      }
    })
    const edges: Edge[] = graph.edges.map((e) => {
      const fx = pos[e.from]?.x ?? 0, tx = pos[e.to]?.x ?? 0
      const leftward = tx < fx
      const hot = !!focus && (e.from === selectedId || e.to === selectedId)
      return {
        id: `${e.from}->${e.to}`,
        source: e.from,
        target: e.to,
        // same column (entry → entry) loops out and back on the right
        sourceHandle: leftward ? "l" : "r",
        targetHandle: leftward ? "r-t" : tx === fx ? "r-t" : "l-t",
        style: { stroke: hot ? "var(--color-accent)" : "var(--color-border2)", strokeWidth: hot ? 1.75 : 1, opacity: focus && !hot ? 0.15 : 1 },
      }
    })
    return { nodes, edges }
  }, [graph, entries, board, selectedId])

  if (!graph) return <p className="text-sm text-muted">Loading graph…</p>
  if (!graph.nodes.length) return <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted">No entries to draw yet.</p>

  return (
    <div aria-label="Memory graph" className="h-[70vh] min-h-[420px] overflow-hidden rounded-xl border border-border">
      <ReactFlow<MemNode>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, n) => open(n.data.node)}
        nodesConnectable={false}
        nodesDraggable={false}
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
    </div>
  )
}
