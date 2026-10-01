"use client"

import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Background, BackgroundVariant, Controls, getViewportForBounds, Handle, Position, ReactFlow, type Edge, type Node, type NodeProps, type ReactFlowInstance } from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { FileQuestion, Info, Search, Unlink, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useApp } from "@/context/AppContext"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { KIND_ICON, useOpenNode } from "@/components/memory/EntryRelated"
import { fetchLinkJson, useLinkGeneration } from "@/components/docs/useDocLinks"
import type { BrokenLink, DocGraph as Graph, DocNode, DocNodeKind } from "@/lib/doc-links"
import { STATUS_META, StatusChip, StatusIcon } from "@/components/shared/StatusIcon"
import { statusDefIn, useStatusDefs } from "@/components/shared/status-defs"
import { OwnerChip } from "@/components/shared/OwnerChip"
import { AgentDot } from "@/components/chat/AgentMark"
import type { TaskStatus } from "@/types"
import { forceLayout, graphChanges, hiddenLabels, neighbourhoodIds, stepFocus, type ArrowKey, type LabelBox } from "./force-layout"

// delay: the selection ripple (depth-2 lights after depth-1); quick: no selection, so state changes run on fast.
// enter / exit: a node that appears / disappears during a relayout tween.
type DotData = { node: DocNode; size: number; box: number; dim: boolean; active: boolean; match: boolean; changed: boolean; hue: string; hideLabel: boolean; delay: number; quick: boolean; enter?: boolean; exit?: boolean }
type DotNode = Node<DotData, "dot">
type GraphState = { node: string | null; focus: 0 | 1 | 2; kinds: DocNodeKind[]; q: string }
type XY = { x: number; y: number }
/** A relayout in flight: centres it started from, where it is now, where it goes, and the nodes it removed. */
type Tween = { from: Record<string, XY>; at: Record<string, XY>; to: Record<string, XY>; gone: DotNode[] }

const KINDS: { kind: DocNodeKind; label: string }[] = [
  { kind: "doc", label: "Docs" },
  { kind: "adr", label: "ADRs" },
  { kind: "task", label: "Tasks" },
  { kind: "epic", label: "Epics" },
  { kind: "entry", label: "Entries" },
]
const DEFAULT_KINDS: DocNodeKind[] = ["doc", "adr"]
// React Flow chrome in the app's tokens: Controls read as ghost icon buttons
const FLOW_STYLE = {
  "--xy-background-color": "var(--color-bg)",
  "--xy-controls-box-shadow": "none",
  "--xy-controls-button-background-color": "transparent",
  "--xy-controls-button-background-color-hover": "var(--color-surface2)",
  "--xy-controls-button-color": "var(--color-muted)",
  "--xy-controls-button-color-hover": "var(--color-txt)",
  "--xy-controls-button-border-color": "transparent",
} as React.CSSProperties
const PRO_OPTIONS = { hideAttribution: true }
// edges clear 3:1 on the page in both themes (border2 was 1.46:1); measured, see T103
const EDGE = "color-mix(in srgb, var(--color-muted) 80%, var(--color-bg))"
// a label is 11px sans (16.5px line box) under the dot (mt-1), at most max-w-48 (12rem) wide; ids are 10px mono + mr-1
const LABEL_H = 17
const LABEL_GAP = 4
// ponytail: above this many nodes only the ones on screen render (same knob as MemoryGraph)
const VIRTUALIZE_OVER = 150
// a fitted big graph is unreadable; fit no further out than this and let the user pan
const FIT_MIN_ZOOM = 0.35
const FIT_OPTIONS = { padding: 0.1, minZoom: FIT_MIN_ZOOM, maxZoom: 1 }
// how long a live update marks the nodes it touched (data-changed, for the update flash)
const CHANGED_MS = 1500
const EMPTY_GRAPH: Graph = { nodes: [], edges: [], broken: [], stale: [], targets: {} }
const NONE = new Set<string>()
const SEP = "\u0000"
// below this zoom only the selected / matching labels show, once the graph is big enough to get noisy
const LABEL_ZOOM = 0.6
const LABEL_NODES_OVER = 40
const CENTER = { left: "50%", top: "50%", transform: "translate(-50%, -50%)" }
// every node is at least this big to hit (WCAG 2.5.8), however small its dot
const HIT = 24
const KIND_NAME: Record<DocNodeKind, string> = { doc: "Doc", adr: "ADR", task: "Task", epic: "Epic", entry: "Entry" }
const LEGEND_STATUSES: TaskStatus[] = ["in-progress", "blocked", "done"]
// relayout: positions and camera glide together (the roadmap Arrange tween is 420ms too)
const TWEEN_MS = 420
// ease-out-quart, close to --ease-out-soft; dots and camera share it so they move as one
const easeOut = (k: number) => 1 - Math.pow(1 - k, 4)
// the selection ripple: depth-2 neighbours light this long after depth-1
const RIPPLE_MS = 60
const EXIT_STYLE = { pointerEvents: "none" } as const
const still = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
const ARROWS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"])
const HINT = "Tab moves between files. Enter selects a file; Enter again or O opens it. Arrow keys move to the nearest linked file. Escape clears the search, then the selection. Slash jumps to search."
const ARIA_LABELS = { "node.a11yDescription.default": HINT }

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

/** Label width in px as DotView renders it (canvas measure in the page's fonts), capped at max-w-48. */
function labelMeasurer(): (n: DocNode) => number {
  const ctx = document.createElement("canvas").getContext("2d")
  const css = getComputedStyle(document.documentElement)
  const max = 12 * parseFloat(css.fontSize)
  const width = (text: string, font: string) => {
    if (!ctx) return text.length * 6.5
    ctx.font = font
    return ctx.measureText(text).width
  }
  const sans = `11px ${css.getPropertyValue("--font-sans")}`
  const mono = `10px ${css.getPropertyValue("--font-mono")}`
  return (n) => Math.min(max, width(n.label, sans) + (n.kind === "doc" ? 0 : width(n.id, mono) + 4))
}

/** Kind by shape, drawn in currentColor: doc circle, ADR square, epic diamond, task (small) circle, entry ring. */
function Shape({ kind, size, className }: { kind: DocNodeKind; size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" aria-hidden className={cn("shrink-0", className)}>
      {kind === "adr" ? <rect x="0.75" y="0.75" width="8.5" height="8.5" rx="1" fill="currentColor" />
        : kind === "epic" ? <path d="M5 0 10 5 5 10 0 5Z" fill="currentColor" />
        : kind === "entry" ? <circle cx="5" cy="5" r="3.9" fill="none" stroke="currentColor" strokeWidth="2.2" />
        : <circle cx="5" cy="5" r="5" fill="currentColor" />}
    </svg>
  )
}

/** A shape sized by degree, centred on its layout point; the label hangs below and never takes clicks. */
const DotView = memo(function DotView({ data }: NodeProps<DotNode>) {
  const { node, size, box, dim, active, match, changed, hue, hideLabel, delay, quick, enter, exit } = data
  // The React Flow wrapper (.react-flow__node) takes focus; the halo goes on the dot and the label
  return (
    <div
      title={node.path}
      data-changed={changed || undefined}
      style={{ width: box, height: box }}
      className={cn("flex items-center justify-center", enter && "animate-node-in", exit && "animate-node-out")}
    >
      <div
        style={{ width: size, height: size, transitionDelay: `${delay}ms` }}
        className={cn(
          "relative rounded-full transition-[opacity,box-shadow] ease-out-soft",
          quick ? "duration-(--duration-fast)" : "duration-(--duration-base)",
          changed && "animate-flash",
          hue,
          dim && "opacity-25",
          (active || match) && "ring-2 ring-accent ring-offset-2 ring-offset-bg",
          "in-[[data-id]:focus-visible]:opacity-100 in-[[data-id]:focus-visible]:ring-2 in-[[data-id]:focus-visible]:ring-accent/60 in-[[data-id]:focus-visible]:shadow-[0_0_0_6px_rgb(var(--rgb-accent)/0.15)]",
        )}
      >
        <Shape kind={node.kind} size={size} className="block" />
        <Handle type="source" position={Position.Top} isConnectable={false} style={CENTER} className="opacity-0" />
        <Handle type="target" position={Position.Top} isConnectable={false} style={CENTER} className="opacity-0" />
        <span
          className={cn(
            "pointer-events-none absolute top-full left-1/2 mt-1 max-w-48 -translate-x-1/2 truncate text-[11px] whitespace-nowrap",
            // the zoom threshold fades labels out rather than snapping them
            "transition-opacity duration-(--duration-base) ease-out-soft",
            active || match ? "font-medium text-txt" : cn("text-muted group-data-[far=true]/graph:opacity-0", hideLabel && "hidden"),
            "rounded-sm in-[[data-id]:focus-visible]:block! in-[[data-id]:focus-visible]:opacity-100! in-[[data-id]:focus-visible]:bg-surface in-[[data-id]:focus-visible]:px-1 in-[[data-id]:focus-visible]:text-txt in-[[data-id]:focus-visible]:ring-1 in-[[data-id]:focus-visible]:ring-accent/60 in-[[data-id]:focus-visible]:shadow-[0_0_0_3px_rgb(var(--rgb-accent)/0.15)]",
          )}
        >
          {node.kind !== "doc" && <span className="mr-1 font-mono text-[10px]">{node.id}</span>}
          {node.label}
        </span>
      </div>
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
  const statusDefs = useStatusDefs()
  const router = useRouter()
  const open = useOpenNode((id) => router.push(`/memory?entry=${encodeURIComponent(id)}`))
  const params = useSearchParams()
  const key = params.toString()
  const state = useMemo(() => readState(new URLSearchParams(key)), [key])
  const update = useCallback((patch: Partial<GraphState>) => writeState({ ...readState(new URLSearchParams(window.location.search)), ...patch }), [])

  const [graph, setGraph] = useState<Graph | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  // node paths the last live refresh touched (T105 flashes them); cleared after CHANGED_MS
  const [changed, setChanged] = useState<Set<string>>(NONE)
  const last = useRef<{ root: string; graph: Graph } | null>(null)
  const gen = useLinkGeneration()
  const [rf, setRf] = useState<ReactFlowInstance<DotNode> | null>(null)
  const [far, setFar] = useState(false)
  const [legendOpen, setLegendOpen] = useState(false)
  // the last selected file: the card keeps showing it while it fades out
  const [cardNode, setCardNode] = useState<DocNode | undefined>(undefined)
  const rootRef = useRef<HTMLDivElement>(null)
  const isDark = useSyncExternalStore(subscribeTheme, () => document.documentElement.classList.contains("dark"), () => true)

  // One request per load / SSE burst: fetchLinkJson shares it per generation (strict mode, other link hooks)
  useEffect(() => {
    let live = true
    fetchLinkJson<Graph>(`/api/docs/graph${rootParam}`)
      .then((g) => {
        if (!live) return
        const next = g.nodes ? g : EMPTY_GRAPH
        const prev = last.current?.root === rootParam ? last.current.graph : null
        last.current = { root: rootParam, graph: next }
        const diff = graphChanges(prev, next)
        setGraph(next)
        setError(null)
        if (diff.size) setChanged(diff)
      })
      .catch((e) => {
        console.warn("Loading the doc graph failed", e)
        if (live) setError(e instanceof Error ? e.message : String(e))
      })
    return () => { live = false }
  }, [rootParam, gen, retry])

  useEffect(() => {
    if (!changed.size) return
    const t = setTimeout(() => setChanged(NONE), CHANGED_MS)
    return () => clearTimeout(t)
  }, [changed])

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

  // Unique linked files per visible node (arrow keys, link counts) and the tab order: by label, then path
  const adj = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const e of visible?.edges ?? []) {
      for (const [a, b] of [[e.from, e.to], [e.to, e.from]]) m.set(a, (m.get(a) ?? new Set()).add(b))
    }
    return m
  }, [visible])
  const order = useMemo(
    () => (visible?.paths ?? []).slice().sort((a, b) => (byPath.get(a)?.label ?? a).localeCompare(byPath.get(b)?.label ?? b) || a.localeCompare(b)),
    [visible, byPath],
  )

  // Layout is keyed by the sorted id and edge sets, not object identity: a refresh with the same links keeps every
  // position (a task status change on its own never moves a dot)
  const idsKey = useMemo(() => (visible?.paths ?? []).slice().sort().join(SEP), [visible])
  const edgesKey = useMemo(() => (visible?.edges ?? []).map((e) => `${e.from}${SEP}${e.to}`).sort().join("\n"), [visible])
  const pos = useMemo(() => {
    const ids = idsKey ? idsKey.split(SEP) : []
    const es = edgesKey ? edgesKey.split("\n").map((k) => { const [from, to] = k.split(SEP); return { from, to } }) : []
    return forceLayout(ids.map((id) => ({ id })), es)
  }, [idsKey, edgesKey])

  // Fit on first load, on a filter / focus change, or when the visible set grows or shrinks; never once the user
  // has panned or zoomed (until the filter / focus changes or they press Fit)
  const userMoved = useRef(false)
  const viewKey = `${state.kinds.join(",")}|${focusRoot ?? ""}|${focusRoot ? state.focus : 0}`
  useEffect(() => { userMoved.current = false }, [viewKey])
  // Fits the *target* layout, so the camera glides alongside the position tween instead of after a jump
  useEffect(() => {
    if (!rf || userMoved.current) return
    const id = requestAnimationFrame(() => {
      const el = rootRef.current?.querySelector<HTMLElement>(".react-flow")
      const pts = Object.values(pos)
      if (!el || !pts.length) return
      const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y)
      const x = Math.min(...xs) - HIT, y = Math.min(...ys) - HIT
      const bounds = { x, y, width: Math.max(...xs) + HIT - x, height: Math.max(...ys) + HIT - y }
      const vp = getViewportForBounds(bounds, el.clientWidth, el.clientHeight, FIT_MIN_ZOOM, FIT_OPTIONS.maxZoom, FIT_OPTIONS.padding)
      void rf.setViewport(vp, { duration: still() ? 0 : TWEEN_MS, ease: easeOut })
    })
    return () => cancelAnimationFrame(id)
  }, [rf, pos, viewKey])

  const q = state.q.trim().toLowerCase()
  const matches = useMemo(
    () => (q && visible ? visible.paths.filter((p) => { const n = byPath.get(p); return !!n && (n.label.toLowerCase().includes(q) || n.path.toLowerCase().includes(q) || n.id.toLowerCase().includes(q)) }) : []),
    [q, visible, byPath],
  )

  const { base, edges } = useMemo(() => {
    if (!visible) return { base: [] as DotNode[], edges: [] as Edge[] }
    const degree = new Map<string, number>()
    for (const e of visible.edges) for (const p of [e.from, e.to]) degree.set(p, (degree.get(p) ?? 0) + 1)
    // Selection ripple: depth-1 lights first; with Focus 2 the depth-2 ring lights RIPPLE_MS later
    const near = selected ? neighbourhoodIds(visible.edges, selected, 1) : null
    const lit = selected ? (state.focus === 2 ? neighbourhoodIds(visible.edges, selected, 2) : near) : q ? new Set(matches) : null
    const delayOf = (p: string) => (near && lit?.has(p) && !near.has(p) ? RIPPLE_MS : 0)
    const quick = !selected
    const matched = new Set(matches)
    // tasks are the small circles; everything grows with degree
    const sizeOf = (p: string) => Math.round((byPath.get(p)?.kind === "task" ? 0.7 : 1) * (8 + 4 * Math.sqrt(degree.get(p) ?? 0)))
    // Labels: selected, matches, the lit neighbourhood, then by degree; a lower one that overlaps is hidden
    const keep = new Set([...(selected ? [selected] : []), ...matches])
    const rank = (p: string) => (keep.has(p) ? 2 : lit?.has(p) ? 1 : 0)
    const measure = typeof document === "undefined" ? null : labelMeasurer()
    const boxes: LabelBox[] = measure
      ? order.slice().sort((a, b) => rank(b) - rank(a) || (degree.get(b) ?? 0) - (degree.get(a) ?? 0)).map((p) => {
          const at = pos[p] ?? { x: 0, y: 0 }
          const w = measure(byPath.get(p)!)
          return { id: p, x: at.x - w / 2, y: at.y + sizeOf(p) / 2 + LABEL_GAP, w, h: LABEL_H }
        })
      : []
    const hideLabel = hiddenLabels(boxes, keep)
    // DOM order = tab order, so nodes go in label order
    const nodes: DotNode[] = order.map((p) => {
      const size = sizeOf(p)
      const box = Math.max(size, HIT)
      const at = pos[p] ?? { x: 0, y: 0 }
      const n = byPath.get(p)!
      const links = adj.get(p)?.size ?? 0
      // task / epic: the status hue (custom statuses through their category); every other kind neutral
      const hue = n.status ? STATUS_META[statusDefIn(statusDefs, n.status).category].text : "text-muted"
      return {
        id: p,
        type: "dot",
        position: { x: at.x - box / 2, y: at.y - box / 2 },
        // known size: a fresh node object (every restyle, every tween frame) keeps its handles and stays visible
        // instead of React Flow hiding it, and its edges, until it re-measures
        measured: { width: box, height: box },
        ariaLabel: `${KIND_NAME[n.kind]}${n.kind === "doc" ? "" : ` ${n.id}`} ${n.label}, ${links} link${links === 1 ? "" : "s"}`,
        data: { node: n, size, box, dim: !!lit && !lit.has(p), active: p === selected, match: matched.has(p), changed: changed.has(p), hue, hideLabel: hideLabel.has(p), delay: delayOf(p), quick },
        draggable: false,
      }
    })
    // edges share the nodes' timing (they used to snap)
    const ms = quick ? "var(--duration-fast)" : "var(--duration-base)"
    const transition = ["stroke", "stroke-width", "opacity"].map((pr) => `${pr} ${ms} var(--ease-out-soft)`).join(", ")
    const edges: Edge[] = visible.edges.map((e) => {
      const hot = !!selected && (e.from === selected || e.to === selected)
      // Focus 2: an edge inside the 2-hop ring stays lit, after the ripple delay
      const on = hot || (!!selected && state.focus === 2 && !!lit?.has(e.from) && !!lit.has(e.to))
      return {
        id: `${e.from}->${e.to}`,
        source: e.from,
        target: e.to,
        type: "straight",
        domAttributes: { "aria-hidden": true },
        style: {
          stroke: hot ? "var(--color-accent)" : EDGE,
          strokeWidth: hot ? 1.75 : 1,
          opacity: lit && !on ? 0.15 : 1,
          transition,
          transitionDelay: `${hot ? 0 : Math.max(delayOf(e.from), delayOf(e.to))}ms`,
        },
      }
    })
    return { base: nodes, edges }
  }, [visible, order, adj, pos, byPath, selected, state.focus, q, matches, changed, statusDefs])

  // Relayout tween (filter / focus / data change): dots glide from where they are drawn to the new layout, new ones
  // scale in at their target, removed ones fade out. A new relayout mid-tween starts from the interpolated positions.
  // "Previous render" bookkeeping is state, set while rendering (React's documented pattern), so nothing reads refs.
  const [seen, setSeen] = useState({ pos, base })
  const [tween, setTween] = useState<Tween | null>(null)
  if (seen.base !== base) {
    setSeen({ pos, base })
    if (seen.pos !== pos) {
      // ponytail: per-frame React Flow updates; above VIRTUALIZE_OVER nodes the graph jumps instead of gliding
      const glide = seen.base.length > 0 && base.length > 0 && Math.max(seen.base.length, base.length) <= VIRTUALIZE_OVER && !still()
      const from = tween?.to === seen.pos ? tween.at : seen.pos
      setTween(glide ? { from, at: from, to: pos, gone: seen.base.filter((n) => !pos[n.id]) } : null)
    }
  }
  const tweenFrom = tween?.from
  const tweenTo = tween?.to
  useEffect(() => {
    if (!tweenFrom || !tweenTo) return
    const t0 = performance.now()
    let raf = 0
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / TWEEN_MS)
      if (k >= 1) return setTween(null)
      const e = easeOut(k)
      const at: Record<string, XY> = {}
      for (const [id, b] of Object.entries(tweenTo)) {
        const a = tweenFrom[id] ?? b
        at[id] = { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e }
      }
      setTween((t) => (t && t.from === tweenFrom ? { ...t, at } : t))
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [tweenFrom, tweenTo])
  const nodes = useMemo(() => {
    if (!tween) return base
    const moved = base.map((n): DotNode => {
      if (!tween.from[n.id]) return { ...n, data: { ...n.data, enter: true } }
      const c = tween.at[n.id]
      return c ? { ...n, position: { x: c.x - n.data.box / 2, y: c.y - n.data.box / 2 } } : n
    })
    const gone = tween.gone.map((n): DotNode => ({ ...n, focusable: false, selectable: false, style: EXIT_STYLE, data: { ...n.data, exit: true } }))
    return [...moved, ...gone]
  }, [base, tween])

  // Esc on /graph steps back: clear the search, then the selection, then leave the graph. Capture phase, so
  // React Flow's own Escape (which blurs the node) and the global handler never see it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || document.querySelector("[role=dialog]")) return
      const root = rootRef.current
      const t = e.target instanceof HTMLElement ? e.target : null
      const inside = !!t && !!root?.contains(t)
      if (!root || !(inside || t === document.body || t?.id === "main")) return
      if (state.q) update({ q: "" })
      else if (selected) update({ node: null })
      else if (inside) t.blur()
      else return
      e.preventDefault()
      e.stopPropagation()
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [state.q, selected, update])

  const select = (p: string | null) => update({ node: p })
  /** Keyboard focus to a node; one that's off screen (not rendered when virtualized) is centred first. */
  const focusNode = (p: string) => {
    const find = () => rootRef.current?.querySelector<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(p)}"]`)
    const el = find()
    if (el) return el.focus({ preventScroll: true })
    const at = pos[p]
    if (!rf || !at) return
    userMoved.current = true
    void rf.setCenter(at.x, at.y, { zoom: rf.getZoom() }).then(() => requestAnimationFrame(() => find()?.focus({ preventScroll: true })))
  }
  const pick = (p: string) => {
    select(p)
    const at = pos[p]
    if (!rf || !at) return focusNode(p)
    userMoved.current = true
    void rf.setCenter(at.x, at.y, { zoom: Math.max(rf.getZoom(), 1), duration: still() ? 0 : TWEEN_MS, ease: easeOut }).then(() => focusNode(p))
  }
  // Keys on a focused node (React Flow's wrapper div carries data-id)
  const onNodeKey = (e: React.KeyboardEvent) => {
    const el = e.target as HTMLElement
    const id = el.classList.contains("react-flow__node") ? el.dataset.id : undefined
    const n = id ? byPath.get(id) : undefined
    if (!id || !n || e.metaKey || e.ctrlKey || e.altKey) return
    if (e.key === "Enter") {
      if (id === selected) open(n)
      else select(id)
    } else if (e.key === " ") select(id)
    else if (e.key === "o") open(n)
    else if (ARROWS.has(e.key)) {
      const to = stepFocus(id, e.key as ArrowKey, pos, adj.get(id) ?? [], order)
      if (to) focusNode(to)
    } else return
    e.preventDefault()
  }

  if (error) {
    return (
      <div role="alert" className="m-6 max-w-xl rounded-lg border border-danger/30 bg-danger/5 p-4">
        <p className="text-sm font-medium text-txt">Couldn&apos;t load the link graph.</p>
        <p className="mt-1 text-xs break-words text-muted">{error}</p>
        <Button size="sm" variant="outline" className="mt-3" onClick={() => { setError(null); setRetry((r) => r + 1) }}>Retry</Button>
      </div>
    )
  }
  if (!graph) return <p className="p-6 text-sm text-muted">Loading graph…</p>
  if (!graph.edges.length) {
    return <p className="m-6 rounded-xl border border-dashed border-border p-4 text-sm text-muted">No links between docs yet. Link docs with [text](path.md) or [[name]].</p>
  }

  const sel = selected ? byPath.get(selected) : undefined
  if (sel && sel !== cardNode) setCardNode(sel)
  const card = sel ?? cardNode
  // selected in the URL but its kind is filtered out: say so instead of dropping it
  const hidden = state.node && !selected ? byPath.get(state.node) : undefined
  // Card counts = the edges drawn; links to files the filters / focus hide are "+N hidden"
  const cp = card?.path
  const linked = (es: { from: string; to: string }[]) => cp
    ? { to: new Set(es.filter((e) => e.from === cp && e.to !== cp).map((e) => e.to)).size, from: new Set(es.filter((e) => e.to === cp && e.from !== cp).map((e) => e.from)).size }
    : { to: 0, from: 0 }
  const shown = linked(visible?.edges ?? [])
  const all = linked(graph.edges)
  const hiddenLinks = all.to + all.from - shown.to - shown.from

  return (
    <div ref={rootRef} className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2 border-b border-border px-4 py-2">
        {KINDS.map(({ kind, label }) => {
          const on = state.kinds.includes(kind)
          const count = counts[kind] ?? 0
          return (
            <button
              key={kind}
              type="button"
              aria-pressed={on}
              disabled={!count}
              onClick={() => update({ kinds: on ? state.kinds.filter((k) => k !== kind) : [...state.kinds, kind] })}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-sm border px-2 text-xs outline-none transition-colors duration-(--duration-fast) focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50",
                on ? "border-border2 bg-surface2 text-txt" : "border-border text-muted hover:border-border2 hover:text-txt",
              )}
            >
              <Shape kind={kind} size={kind === "task" ? 7 : 9} className="text-muted" />
              <span className="sr-only md:not-sr-only">{label}</span>
              <span className="font-mono tabular-nums text-muted">{count}</span>
            </button>
          )
        })}
        <button
          type="button"
          aria-expanded={legendOpen}
          aria-controls="graph-legend"
          aria-label="Legend"
          onClick={() => setLegendOpen((o) => !o)}
          className="inline-flex size-7 items-center justify-center rounded-md text-muted outline-none transition-colors duration-(--duration-fast) hover:bg-surface2 hover:text-txt focus-visible:ring-2 focus-visible:ring-accent aria-expanded:bg-surface2 aria-expanded:text-txt xl:hidden"
        >
          <Info className="size-3.5" aria-hidden />
        </button>
        <p id="graph-legend" className={cn("order-last basis-full flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-muted xl:order-none xl:ml-2 xl:flex xl:basis-auto", legendOpen ? "flex" : "hidden")}>
          {KINDS.map(({ kind }) => (
            <span key={kind} className="inline-flex items-center gap-1"><Shape kind={kind} size={kind === "task" ? 6 : 8} />{KIND_NAME[kind].toLowerCase()}</span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            colour = status
            {LEGEND_STATUSES.map((st) => <StatusIcon key={st} status={st} className="size-3" />)}
          </span>
        </p>
        <MissingLinks broken={graph.broken} stale={graph.stale} />
        {/* the misses button carries ml-auto; with none, the search does */}
        <label className={cn("relative flex items-center", !graph.broken.length && !graph.stale.length && "ml-auto")}>
          <Search className="pointer-events-none absolute left-2 size-3.5 text-muted" aria-hidden />
          <input
            id="graph-search"
            type="search"
            value={state.q}
            placeholder="Find a file…"
            aria-label="Find a file in the graph"
            aria-describedby="graph-matches"
            onChange={(e) => update({ q: e.target.value })}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || !matches[0]) return
              e.preventDefault()
              pick(matches[0])
            }}
            className="h-7 w-44 rounded-md border border-border bg-surface pr-14 2xl:w-48 pl-7 text-xs text-txt outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-search-cancel-button]:hidden"
          />
          {/* the count sits inside the input's reserved right padding, so it never shifts the toolbar */}
          <span id="graph-matches" className="pointer-events-none absolute right-2 font-mono text-[10px] text-muted tabular-nums">
            {q ? `${matches.length} match${matches.length === 1 ? "" : "es"}` : ""}
          </span>
        </label>
      </div>

      <div data-far={far && nodes.length > LABEL_NODES_OVER} onKeyDown={onNodeKey} className="group/graph relative min-h-0 flex-1">
        <p id="graph-hint" className="sr-only">{HINT}</p>
        {!state.kinds.length ? (
          <p className="m-6 text-sm text-muted">Turn on a kind to see files.</p>
        ) : (
          <ReactFlow<DotNode>
            aria-label="Doc link graph"
            aria-roledescription="link graph"
            aria-describedby="graph-hint"
            ariaLabelConfig={ARIA_LABELS}
            edgesFocusable={false}
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onInit={setRf}
            onMoveStart={(e) => { if (e) userMoved.current = true }}
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
            fitViewOptions={FIT_OPTIONS}
            minZoom={0.1}
            proOptions={PRO_OPTIONS}
            style={FLOW_STYLE}
          >
            <Background variant={BackgroundVariant.Lines} gap={24} lineWidth={1} color="var(--color-surface2)" />
            <Controls
              showInteractive={false}
              fitViewOptions={FIT_OPTIONS}
              onZoomIn={() => { userMoved.current = true }}
              onZoomOut={() => { userMoved.current = true }}
              onFitView={() => { userMoved.current = false }}
              className="gap-0.5 rounded-md border border-border bg-surface p-0.5 [&_button]:size-7 [&_button]:rounded-md [&_button]:transition-colors [&_button]:duration-(--duration-fast) [&_button]:outline-none [&_button:focus-visible]:ring-2 [&_button:focus-visible]:ring-accent [&_svg]:max-h-3 [&_svg]:max-w-3"
            />
          </ReactFlow>
        )}

        <div aria-live="polite">
          {hidden && (
            <p className="absolute top-3 right-3 z-10 max-w-72 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-muted shadow-lg">
              {hidden.kind !== "doc" && <span className="mr-1 font-mono text-[11px]">{hidden.id}</span>}
              <span className="text-txt">{hidden.label}</span> is hidden by filters ·{" "}
              <button
                type="button"
                onClick={() => update({ kinds: [...state.kinds, hidden.kind] })}
                className="rounded-sm text-accent underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent"
              >
                Show
              </button>
            </p>
          )}
          {card && (
            <aside
              aria-label="Selected file"
              inert={!sel}
              className={cn(
                "absolute top-3 right-3 z-10 w-72 max-w-[calc(100%-1.5rem)] rounded-lg border border-border bg-surface p-3 shadow-lg shadow-black/20",
                // enters with a fade and a 4px slide from the right, leaves faster; it stays mounted for the exit
                "transition-[opacity,translate,visibility] ease-out-soft",
                sel ? "duration-(--duration-base) starting:translate-x-1 starting:opacity-0" : "invisible translate-x-1 opacity-0 duration-(--duration-fast)",
              )}
            >
              {/* reselecting crossfades the content */}
              <div key={card.path} className="animate-[pane-in_var(--duration-fast)_var(--ease-out-soft)]">
              <div className="flex items-start gap-2">
                {(() => { const Icon = KIND_ICON[card.kind]; return <Icon className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden /> })()}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-txt">{card.kind !== "doc" && <span className="mr-1.5 font-mono text-[11px] text-muted">{card.id}</span>}{card.label}</p>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-muted" title={card.path}>{card.path}</p>
                </div>
                <button type="button" aria-label="Clear selection" onClick={() => select(null)} className="rounded p-0.5 text-muted outline-none hover:text-txt focus-visible:ring-2 focus-visible:ring-accent">
                  <X className="size-3.5" />
                </button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-mono text-[10px] font-medium tracking-[0.06em] text-muted uppercase">{KIND_NAME[card.kind]}</span>
                {card.status && <StatusChip status={card.status} />}
                {card.owner && <OwnerChip owner={card.owner} />}
                {(card.kind === "task" || card.kind === "epic") && <AgentDot attach={{ kind: card.kind, id: card.id }} />}
              </div>
              <p className="mt-2 text-xs text-muted">
                Links to <span className="font-mono tabular-nums text-txt">{shown.to}</span> · Linked from <span className="font-mono tabular-nums text-txt">{shown.from}</span>
                {hiddenLinks > 0 && <span className="text-muted"> · <span className="font-mono tabular-nums">+{hiddenLinks}</span> hidden by filters</span>}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Button size="sm" onClick={() => open(card)}>Open</Button>
                <div role="group" aria-label="Focus" className="ml-auto flex items-center rounded-md border border-border text-xs">
                  <span className="px-2 text-muted">Focus</span>
                  {([0, 1, 2] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      aria-pressed={state.focus === f}
                      onClick={() => update({ focus: f })}
                      className={cn("px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-accent", state.focus === f ? "bg-surface2 text-txt" : "text-muted hover:text-txt")}
                    >
                      {f === 0 ? "Off" : f}
                    </button>
                  ))}
                </div>
              </div>
              </div>
            </aside>
          )}
        </div>
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

const MISS_KIND: Record<string, string> = { md: "link", wiki: "wikilink", code: "path" }

/**
 * "N broken · M stale paths" (zero parts dropped) and the list behind it, grouped by file. Broken = md / wiki links
 * to no file; stale = backticked paths to missing files. A row opens the file at that spot (`openDoc` `?link=`).
 */
function MissingLinks({ broken, stale }: { broken: BrokenLink[]; stale: BrokenLink[] }) {
  const { openDoc } = useApp()
  if (!broken.length && !stale.length) return null
  const byFile = (rows: BrokenLink[]) => {
    const files = new Map<string, BrokenLink[]>()
    for (const r of [...rows].sort((a, b) => a.from.localeCompare(b.from) || a.line - b.line)) files.set(r.from, [...(files.get(r.from) ?? []), r])
    return [...files]
  }
  const section = (title: string, rows: BrokenLink[], Icon: typeof Unlink) => rows.length > 0 && (
    <DropdownMenuGroup>
      <DropdownMenuLabel className="flex items-center px-2 pt-2 pb-1 font-mono text-[10px] font-medium tracking-[0.06em] text-muted uppercase">
        {title}<span className="ml-auto tabular-nums">{rows.length}</span>
      </DropdownMenuLabel>
      {byFile(rows).map(([file, items]) => (
        <div key={file} role="group" aria-label={file}>
          <p className="truncate px-2 pt-1.5 font-mono text-[11px] text-txt" title={file}>{file}</p>
          {items.map((r) => (
            <DropdownMenuItem key={`${r.target}:${r.line}`} onSelect={() => void openDoc(r.from, r.target)} className="gap-2 py-1 text-xs">
              <Icon className="size-3.5 text-muted" aria-hidden />
              <span className="min-w-0 truncate font-mono text-muted">{r.target}</span>
              <span className="ml-auto shrink-0 text-[11px] text-muted">{MISS_KIND[r.kind] ?? r.kind}</span>
              <span className="shrink-0 font-mono text-[11px] text-muted tabular-nums">L{r.line}</span>
            </DropdownMenuItem>
          ))}
        </div>
      ))}
    </DropdownMenuGroup>
  )
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="ml-auto inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted outline-none transition-colors duration-(--duration-fast) hover:bg-surface2 hover:text-txt focus-visible:ring-2 focus-visible:ring-accent data-[state=open]:bg-surface2 data-[state=open]:text-txt">
        {broken.length > 0 && <span><span className="font-mono tabular-nums">{broken.length}</span> broken</span>}
        {broken.length > 0 && stale.length > 0 && <span>·</span>}
        {stale.length > 0 && <span><span className="font-mono tabular-nums">{stale.length}</span> stale<span className="max-2xl:sr-only"> path{stale.length === 1 ? "" : "s"}</span></span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[min(28rem,var(--radix-dropdown-menu-content-available-height))] w-[min(26rem,calc(100vw-2rem))]">
        {section("Broken links", broken, Unlink)}
        {broken.length > 0 && stale.length > 0 && <DropdownMenuSeparator />}
        {section("Stale paths", stale, FileQuestion)}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
