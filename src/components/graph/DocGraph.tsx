"use client"

import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Background, BackgroundVariant, Controls, getViewportForBounds, Handle, Position, ReactFlow, type Edge, type Node, type NodeProps, type ReactFlowInstance } from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { Info, Search, Unlink, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useApp } from "@/context/AppContext"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { KIND_ICON, useOpenNode } from "@/components/memory/EntryRelated"
import { fetchLinkJson, useLinkGeneration } from "@/components/docs/useDocLinks"
import { GRAPH_DEFAULT_KINDS, touchedPaths, type BrokenLink, type DocGraph as Graph, type DocNode, type DocNodeKind, type TouchEvent } from "@/lib/doc-links"
import { STATUS_COLOR_CLASS, StatusChip } from "@/components/shared/StatusIcon"
import { statusDefIn, useStatusDefs } from "@/components/shared/status-defs"
import { OwnerChip } from "@/components/shared/OwnerChip"
import { AgentDot } from "@/components/chat/AgentMark"
import type { StatusDef } from "@/lib/statuses"
import { GRAPH_KEYS } from "@/lib/shortcuts"
import { forceLayout, graphChanges, hiddenLabels, neighbourhoodIds, SPRING, springStep, stepFocus, type ArrowKey, type LabelBox, type SpringWorld } from "./force-layout"

// delay: the selection ripple (depth-2 lights after depth-1); quick: no selection, so state changes run on fast.
// enter / exit: a node that appears / disappears during a relayout tween. unfold: the entrance offset (dot starts
// there, relative to its layout point) and its start delay.
type DotData = { node: DocNode; size: number; box: number; dim: boolean; lit: boolean; active: boolean; match: boolean; changed: boolean; hue: string; hollow: boolean; recent: boolean; hideLabel: boolean; delay: number; quick: boolean; enter?: boolean; exit?: boolean; unfold?: { x: number; y: number; wait: number } }
type DotNode = Node<DotData, "dot">
type LinkEdge = Edge
type GraphState = { node: string | null; focus: 0 | 1 | 2; kinds: DocNodeKind[]; q: string; recent: boolean }
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
const DEFAULT_KINDS: DocNodeKind[] = [...GRAPH_DEFAULT_KINDS]
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
// a fitted big graph is unreadable; fit no further out than this and let the user pan. 0.5 is also the floor that keeps
// every hit area ≥ 24 screen px (HIT / zoom, capped at HIT_MAX)
const FIT_MIN_ZOOM = 0.5
const FIT_OPTIONS = { padding: 0.1, minZoom: FIT_MIN_ZOOM, maxZoom: 1 }
// how long a live update marks the nodes it touched (data-changed, for the update flash)
const CHANGED_MS = 1500
const EMPTY_GRAPH: Graph = { nodes: [], edges: [], broken: [], stale: [], targets: {} }
const NONE = new Set<string>()
const SEP = "\u0000"
// A label shows only while it renders ≥ LABEL_PX on screen (11px × zoom). Below that only the selected file, search
// matches and the lit neighbourhood keep theirs, counter-scaled back to LABEL_PX on a surface chip.
const LABEL_FONT = 11
const LABEL_PX = 9
const LABEL_MIN_ZOOM = LABEL_PX / LABEL_FONT
// the chip's scale for the collision pass, in quarter steps so a zoom gesture re-runs it only a few times
const labelScaleOf = (zoom: number) => (zoom >= LABEL_MIN_ZOOM ? 1 : Math.ceil((LABEL_MIN_ZOOM / zoom) * 4) / 4)
// a chip's px-1 on both sides
const CHIP_PAD = 8
const CENTER = { left: "50%", top: "50%", transform: "translate(-50%, -50%)" }
// every node is at least this big to hit (WCAG 2.5.8) in *screen* px, however small its dot or the zoom: an invisible
// pad of HIT / zoom flow px, capped at the layout's minimum node distance so neighbours never steal each other's clicks
const HIT = 24
const HIT_MAX = 48
// search framing: half a typical label's width beside the outermost matches
const MATCH_PAD_X = 72
const HIT_PAD = `min(${HIT_MAX}px, max(100%, calc(${HIT}px / var(--graph-zoom, 1))))`
const KIND_NAME: Record<DocNodeKind, string> = { doc: "Doc", adr: "ADR", task: "Task", epic: "Epic", entry: "Entry" }
// "Recent": files the activity log says an agent or a human changed in this window (T110)
const RECENT_MS = 24 * 60 * 60 * 1000
// ponytail: the newest 1000 events cover a day of agent work here; page the log if a busy day outgrows it
const ACTIVITY_LIMIT = 1000
// the selection reads without hue (the accent can match a status): accent ring, a bg gap, then a hairline in text colour
const SELECTED_RING = "ring-2 ring-accent ring-offset-2 ring-offset-bg shadow-[0_0_0_5px_var(--color-bg),0_0_0_6px_var(--color-txt)]"
// a search match: a dashed accent ring, so a match never reads as the selection
const MATCH_RING = "outline-1 outline-offset-2 outline-dashed outline-accent"

/** Settled (done / cancelled, custom ones too) draws hollow Pencil Grey; active statuses keep their hue; no status = grey. */
function dotStyle(defs: StatusDef[], status: string | undefined): { hue: string; hollow: boolean } {
  if (!status) return { hue: "text-muted", hollow: false }
  const def = statusDefIn(defs, status)
  const hollow = def.category === "done" || def.category === "cancelled"
  return { hue: hollow ? "text-muted" : STATUS_COLOR_CLASS[def.color].text, hollow }
}
// relayout: positions and camera glide together (the roadmap Arrange tween is 420ms too)
const TWEEN_MS = 420
// ease-out-quart, close to --ease-out-soft; dots and camera share it so they move as one
const easeOut = (k: number) => 1 - Math.pow(1 - k, 4)
// the selection ripple: depth-2 neighbours light this long after depth-1
const RIPPLE_MS = 60
const EXIT_STYLE = { pointerEvents: "none" } as const
// Entrance (mount and Fit): every dot unfolds from near the centre to its layout point, the best-linked file's
// neighbourhood first, and the edges fade in as the dots land. Pure CSS on the compositor (graph-node-unfold), so no
// React render per frame: the old frame-by-frame playback re-rendered every node and edge 60 times a second and stuttered.
const UNFOLD_FROM = 0.85 // a dot starts this share of the way back towards the centre
const UNFOLD_STAGGER_MS = 30
const UNFOLD_STAGGER_CAP = 240
const EDGE_IN_AFTER_MS = 420
// a file with no path to the hub waits like one 8 hops out
const waitOf = (h: number | undefined) => Math.min((h ?? 8) * UNFOLD_STAGGER_MS, UNFOLD_STAGGER_CAP)
const UNFOLD_MS = 900 + UNFOLD_STAGGER_CAP + 520 // dots + stagger + edge fade; then data-unfold comes off the wrapper
// ponytail: transforms only, measured smooth at 192 dots / 687 edges; skip above this if low-end machines stutter
const UNFOLD_MAX_NODES = 400
// hover / keyboard focus: linked dots lean this far toward the one under the pointer
const MAGNET_PX = 8
// a wiggle under this many px is still a click; more is a drag
const DRAG_PX = 4
// a hovered file's edges: one step brighter than EDGE, still neutral (accent stays for selection)
const EDGE_HOVER = "var(--color-muted)"
const still = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
const ARROWS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"])
const HINT = "Tab moves between files, then the unlinked ones below the map. Enter selects a file; Enter again or O opens it. Arrow keys move to the nearest linked file. Escape clears the search, then the selection. Slash jumps to search; Enter there frames every match, then steps through them (Shift+Enter goes back)."
const ARIA_LABELS = { "node.a11yDescription.default": HINT }
// keyboard hints, neutral like the ? sheet (never accent)
const KBD = "rounded-sm border border-border2 bg-surface2 px-1 py-0.5 font-mono text-[10px] leading-none text-txt"

function subscribeTheme(cb: () => void) {
  const mo = new MutationObserver(cb)
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
  return () => mo.disconnect()
}

function readState(p: URLSearchParams): GraphState {
  const f = p.get("focus")
  const kinds = p.get("kinds")?.split(",").filter((k): k is DocNodeKind => KINDS.some((x) => x.kind === k))
  return { node: p.get("node"), focus: f === "1" ? 1 : f === "2" ? 2 : 0, kinds: kinds ?? DEFAULT_KINDS, q: p.get("q") ?? "", recent: p.get("recent") === "1" }
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
  set("recent", s.recent ? "1" : null)
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

/**
 * Kind by shape, drawn in currentColor: doc circle, ADR square, epic diamond, task (small) circle, entry ring.
 * `hollow` (done / cancelled) draws the same shape as an outline, inset so the stroke stays inside the box.
 */
function Shape({ kind, size, hollow, className }: { kind: DocNodeKind; size: number; hollow?: boolean; className?: string }) {
  // the stroke stays ≥ 1.25 screen px on the smallest dot (a 6px task)
  const w = Math.max(1.6, 12.5 / size)
  const paint = hollow ? { fill: "none", stroke: "currentColor", strokeWidth: w } : { fill: "currentColor" }
  const i = hollow ? w / 2 : 0
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" aria-hidden className={cn("shrink-0", className)}>
      {kind === "adr" ? <rect x={0.75 + i} y={0.75 + i} width={8.5 - 2 * i} height={8.5 - 2 * i} rx="1" {...paint} />
        : kind === "epic" ? <path d={hollow ? `M5 ${i * 1.42}L${10 - i * 1.42} 5 5 ${10 - i * 1.42}${i * 1.42} 5Z` : "M5 0 10 5 5 10 0 5Z"} strokeLinejoin="round" {...paint} />
        : kind === "entry" ? <circle cx="5" cy="5" r="3.9" fill="none" stroke="currentColor" strokeWidth="2.2" />
        : <circle cx="5" cy="5" r={5 - i} {...paint} />}
    </svg>
  )
}

/** A shape sized by degree, centred on its layout point; the label hangs below and never takes clicks. */
const DotView = memo(function DotView({ data }: NodeProps<DotNode>) {
  const { node, size, box, dim, lit, active, match, changed, hue, hollow, recent, hideLabel, delay, quick, enter, exit } = data
  // a dot entering or leaving in a relayout runs node-in / node-out, without the entrance's delay
  const unfold = enter || exit ? undefined : data.unfold
  // The React Flow wrapper (.react-flow__node) takes focus; the halo goes on the dot and the label
  return (
    <div
      title={node.path}
      data-changed={changed || undefined}
      style={{ width: box, height: box, ...(unfold && ({ "--ux": `${unfold.x}px`, "--uy": `${unfold.y}px`, animationDelay: `${unfold.wait}ms` } as React.CSSProperties)) }}
      className={cn("relative flex items-center justify-center", enter && "animate-node-in", exit && "animate-node-out", unfold && "graph-node-unfold")}
    >
      {/* the hit pad: ≥ HIT screen px at any zoom ≥ FIT_MIN_ZOOM; clicks on it bubble to the node */}
      <span data-hit aria-hidden style={{ width: HIT_PAD, height: HIT_PAD }} className="absolute top-1/2 left-1/2 -translate-1/2" />
      {/* live ping: two rings spread from a dot an update touched (outside the dot, so dimming doesn't eat them) */}
      {changed && [0, 1].map((i) => <span key={i} aria-hidden style={{ width: size, height: size }} className={cn("graph-ping", i && "graph-ping-2")} />)}
      <div
        style={{ width: size, height: size, transitionDelay: `${delay}ms` }}
        className={cn(
          "relative rounded-full transition-[opacity,box-shadow,outline-color] ease-out-soft",
          quick ? "duration-(--duration-fast)" : "duration-(--duration-base)",
          hue,
          dim && "opacity-25",
          active ? SELECTED_RING : match && MATCH_RING,
          "in-[[data-id]:focus-visible]:opacity-100",
          // focus halo; on the selected node it goes outside the double ring so the text-colour hairline survives
          // (Enter selects the focused node: the keyboard path must keep selection hue-independent)
          active
            ? "in-[[data-id]:focus-visible]:shadow-[0_0_0_5px_var(--color-bg),0_0_0_6px_var(--color-txt),0_0_0_9px_rgb(var(--rgb-accent)/0.2)]"
            : "in-[[data-id]:focus-visible]:ring-2 in-[[data-id]:focus-visible]:ring-accent/60 in-[[data-id]:focus-visible]:shadow-[0_0_0_6px_rgb(var(--rgb-accent)/0.15)]",
        )}
      >
        <Shape kind={node.kind} size={size} hollow={hollow} className="block" />
        {/* changed in the last 24h: a small accent notch on the dot's shoulder, cut out of the dot by a bg ring */}
        {recent && <span aria-hidden className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-accent ring-1 ring-bg" />}
        <Handle type="source" position={Position.Top} isConnectable={false} style={CENTER} className="opacity-0" />
        <Handle type="target" position={Position.Top} isConnectable={false} style={CENTER} className="opacity-0" />
        <span
          className={cn(
            "pointer-events-none absolute top-full left-1/2 mt-1 max-w-48 origin-top -translate-x-1/2 truncate rounded-sm text-[11px] whitespace-nowrap",
            // the zoom threshold and collisions fade labels rather than snapping them
            "transition-[opacity,background-color] duration-(--duration-base) ease-out-soft",
            active || match ? "font-medium text-txt" : "text-muted",
            // below the readable zoom only the selected file, matches and the lit neighbourhood keep a label: scaled back
            // up to LABEL_PX on a surface chip
            active || match || lit
              ? "group-data-[far=true]/graph:scale-(--label-k) group-data-[far=true]/graph:bg-surface group-data-[far=true]/graph:px-1"
              : "group-data-[far=true]/graph:opacity-0",
            hideLabel && "opacity-0",
            // a keyboard-focused file's label shows too, readable at any zoom
            "group-data-[far=true]/graph:in-[[data-id]:focus-visible]:scale-(--label-k)",
            "in-[[data-id]:focus-visible]:opacity-100! in-[[data-id]:focus-visible]:bg-surface in-[[data-id]:focus-visible]:px-1 in-[[data-id]:focus-visible]:text-txt in-[[data-id]:focus-visible]:ring-1 in-[[data-id]:focus-visible]:ring-accent/60 in-[[data-id]:focus-visible]:shadow-[0_0_0_3px_rgb(var(--rgb-accent)/0.15)]",
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
  const [rf, setRf] = useState<ReactFlowInstance<DotNode, LinkEdge> | null>(null)
  // the label chip scale bucket (1 = labels readable as drawn); the exact zoom goes to CSS vars, never to React state
  const [labelK, setLabelK] = useState(1)
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

  // The activity log, for "Recent": refetched with the graph (task moves and doc edits bump the same generation)
  const [activity, setActivity] = useState<{ events: TouchEvent[]; at: number } | null>(null)
  useEffect(() => {
    let live = true
    fetchLinkJson<TouchEvent[]>(`/api/activity${rootParam}&limit=${ACTIVITY_LIMIT}`)
      .then((events) => { if (live) setActivity({ events: Array.isArray(events) ? events : [], at: Date.now() }) })
      .catch((e) => console.warn("Loading the activity log for Recent failed", e))
    return () => { live = false }
  }, [rootParam, gen])

  useEffect(() => {
    if (!changed.size) return
    const t = setTimeout(() => setChanged(NONE), CHANGED_MS)
    return () => clearTimeout(t)
  }, [changed])

  // Edges are keyed by path (a task's node id is T093, its edges use the file path), so everything here is.
  const byPath = useMemo(() => new Map((graph?.nodes ?? []).map((n) => [n.path, n])), [graph])
  // files an agent or a human changed in the last 24h (every kind, so the chip can turn their kinds on)
  const touched = useMemo(
    () => (graph && activity ? touchedPaths(activity.events, graph.nodes, activity.at - RECENT_MS) : NONE),
    [graph, activity],
  )
  // the legend's statuses: the ones on screen, in the project's order
  const legendStatuses = useMemo(() => {
    const ids = new Set<string>()
    for (const n of graph?.nodes ?? []) if (n.status && state.kinds.includes(n.kind)) ids.add(statusDefIn(statusDefs, n.status).id)
    return statusDefs.filter((d) => ids.has(d.id))
  }, [graph, state.kinds, statusDefs])
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
  // Hops from the best-linked file: the entrance order for dots and edges
  const hops = useMemo(() => {
    const hub = [...adj].reduce<[string, number] | null>((best, [p, s]) => (!best || s.size > best[1] ? [p, s.size] : best), null)?.[0]
    const out = new Map<string, number>(hub ? [[hub, 0]] : [])
    for (let frontier = hub ? [hub] : [], d = 1; frontier.length; d++) {
      const next: string[] = []
      for (const p of frontier) for (const q of adj.get(p) ?? []) if (!out.has(q)) { out.set(q, d); next.push(q) }
      frontier = next
    }
    return out
  }, [adj])
  const order = useMemo(
    () => (visible?.paths ?? []).slice().sort((a, b) => (byPath.get(a)?.label ?? a).localeCompare(byPath.get(b)?.label ?? b) || a.localeCompare(b)),
    [visible, byPath],
  )

  // Layout is keyed by the sorted id and edge sets, not object identity: a refresh with the same links keeps every
  // position (a task status change on its own never moves a dot)
  const idsKey = useMemo(() => (visible?.paths ?? []).slice().sort().join(SEP), [visible])
  const edgesKey = useMemo(() => (visible?.edges ?? []).map((e) => `${e.from}${SEP}${e.to}`).sort().join("\n"), [visible])
  const layoutInput = useMemo(() => ({
    nodes: idsKey ? idsKey.split(SEP).map((id) => ({ id })) : [],
    edges: edgesKey ? edgesKey.split("\n").map((k) => { const [from, to] = k.split(SEP); return { from, to } }) : [],
  }), [idsKey, edgesKey])
  // only linked files get a position; the rest (no visible link) sit on the Unlinked shelf, so they never stretch the fit
  const pos = useMemo(() => forceLayout(layoutInput.nodes, layoutInput.edges), [layoutInput])
  const flowOrder = useMemo(() => order.filter((p) => pos[p]), [order, pos])
  const unlinked = useMemo(() => order.filter((p) => !pos[p]), [order, pos])

  // Entrance on mount and on Fit (never on a live refresh). Every node and edge always carries its unfold offset and
  // delay (inert CSS); a run is only data-unfold on the wrapper, set and cleared through the DOM. Toggling the classes
  // through React re-rendered all 687 edges at the end (a 115ms task on all kinds). a / b alternate so Fit restarts it.
  const unfoldRun = useRef({ timer: 0, b: false })
  const endUnfold = useCallback(() => {
    clearTimeout(unfoldRun.current.timer)
    rootRef.current?.removeAttribute("data-unfold")
  }, [])
  const unfolding = () => !!rootRef.current?.hasAttribute("data-unfold")
  const unfold = useCallback(() => {
    if (still() || layoutInput.nodes.length > UNFOLD_MAX_NODES) return
    const run = unfoldRun.current
    run.b = !run.b
    clearTimeout(run.timer)
    rootRef.current?.setAttribute("data-unfold", run.b ? "b" : "a")
    // off once it's over, so dots React Flow mounts later (virtualized pans, relayout enters) don't replay it
    run.timer = window.setTimeout(endUnfold, UNFOLD_MS)
  }, [layoutInput, endUnfold])
  useEffect(() => endUnfold, [endUnfold])

  // Fit on first load, on a filter / focus change, or when the visible set grows or shrinks; never once the user
  // has panned or zoomed (until the filter / focus changes or they press Fit)
  const userMoved = useRef(false)
  /** The exact zoom to CSS (hit pads, label chips); the coarse label bucket to state, for the collision pass. */
  const applyZoom = useCallback((zoom: number) => {
    const el = rootRef.current
    el?.style.setProperty("--graph-zoom", String(zoom))
    el?.style.setProperty("--label-k", String(Math.max(1, LABEL_MIN_ZOOM / zoom)))
    setLabelK(labelScaleOf(zoom))
  }, [])
  // the canvas stays invisible until the first fit lands, so the unfold starts from the final camera, not a jump
  const [veiled, setVeiled] = useState(true)
  const firstFit = useRef(true)
  const viewKey = `${state.kinds.join(",")}|${focusRoot ?? ""}|${focusRoot ? state.focus : 0}`
  useEffect(() => { userMoved.current = false }, [viewKey])
  // Fits the *target* layout, so the camera glides alongside the position tween instead of after a jump
  useEffect(() => {
    if (!rf || userMoved.current) return
    const id = requestAnimationFrame(() => {
      const el = rootRef.current?.querySelector<HTMLElement>(".react-flow")
      const pts = Object.values(pos)
      if (!el || !pts.length) return setVeiled(false)
      const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y)
      const x = Math.min(...xs) - HIT, y = Math.min(...ys) - HIT
      const bounds = { x, y, width: Math.max(...xs) + HIT - x, height: Math.max(...ys) + HIT - y }
      const vp = getViewportForBounds(bounds, el.clientWidth, el.clientHeight, FIT_MIN_ZOOM, FIT_OPTIONS.maxZoom, FIT_OPTIONS.padding)
      const first = firstFit.current
      firstFit.current = false
      applyZoom(vp.zoom)
      void rf.setViewport(vp, { duration: first || still() ? 0 : TWEEN_MS, ease: easeOut })
      // the label pass for the fitted zoom renders in this frame; the veil and the entrance start in a later one, so
      // neither long task stacks on the other
      if (first) setTimeout(() => { setVeiled(false); unfold() }, 0)
    })
    return () => cancelAnimationFrame(id)
  }, [rf, pos, viewKey, unfold, applyZoom])

  const q = state.q.trim().toLowerCase()
  const matches = useMemo(
    () => (q ? order.filter((p) => { const n = byPath.get(p); return !!n && (n.label.toLowerCase().includes(q) || n.path.toLowerCase().includes(q) || n.id.toLowerCase().includes(q)) }) : []),
    [q, order, byPath],
  )

  const { base, edges } = useMemo(() => {
    if (!visible) return { base: [] as DotNode[], edges: [] as LinkEdge[] }
    const degree = new Map<string, number>()
    for (const e of visible.edges) for (const p of [e.from, e.to]) degree.set(p, (degree.get(p) ?? 0) + 1)
    // Selection ripple: depth-1 lights first; with Focus 2 the depth-2 ring lights RIPPLE_MS later
    const near = selected ? neighbourhoodIds(visible.edges, selected, 1) : null
    // Recent on (and nothing selected or searched): everything the last 24h didn't touch dims
    const lit = selected ? (state.focus === 2 ? neighbourhoodIds(visible.edges, selected, 2) : near) : q ? new Set(matches) : state.recent ? touched : null
    const delayOf = (p: string) => (near && lit?.has(p) && !near.has(p) ? RIPPLE_MS : 0)
    const quick = !selected
    const matched = new Set(matches)
    // tasks are the small circles; everything grows with degree
    const sizeOf = (p: string) => Math.round((byPath.get(p)?.kind === "task" ? 0.7 : 1) * (8 + 4 * Math.sqrt(degree.get(p) ?? 0)))
    // Labels: the selected file, then its direct neighbours, matches, the rest of the lit set, then by degree; a lower one
    // that overlaps is hidden. The selection always shows; zoomed out its neighbours do too, on opaque chips (plain
    // text at full zoom would print over each other, so there they yield). Matches yield: forcing them all stacks chips.
    const far = labelK > 1
    const keep = new Set(selected ? [selected, ...(far ? near ?? [] : [])] : [])
    const rank = (p: string) => (p === selected ? 4 : near?.has(p) ? 3 : matched.has(p) ? 2 : lit?.has(p) ? 1 : 0)
    const measure = typeof document === "undefined" ? null : labelMeasurer()
    // zoomed out, only the always-shown labels compete, at their chip's size; other dots are obstacles too
    const boxes: LabelBox[] = measure
      ? flowOrder.filter((p) => !far || rank(p) > 0).sort((a, b) => rank(b) - rank(a) || (degree.get(b) ?? 0) - (degree.get(a) ?? 0)).map((p) => {
          const at = pos[p]
          const w = (measure(byPath.get(p)!) + (far ? CHIP_PAD : 0)) * labelK
          return { id: p, x: at.x - w / 2, y: at.y + sizeOf(p) / 2 + LABEL_GAP, w, h: LABEL_H * labelK }
        })
      : []
    const dots: LabelBox[] = flowOrder.map((p) => { const r = sizeOf(p) / 2; return { id: p, x: pos[p].x - r, y: pos[p].y - r, w: 2 * r, h: 2 * r } })
    const hideLabel = hiddenLabels(boxes, keep, dots)
    // DOM order = tab order, so nodes go in label order
    const nodes: DotNode[] = flowOrder.map((p) => {
      const size = sizeOf(p)
      const box = Math.max(size, HIT)
      const at = pos[p] ?? { x: 0, y: 0 }
      const n = byPath.get(p)!
      const links = adj.get(p)?.size ?? 0
      // task / epic: an active status's own colour, as on the board and the StatusChip; settled ones hollow grey
      const { hue, hollow } = dotStyle(statusDefs, n.status)
      return {
        id: p,
        type: "dot",
        position: { x: at.x - box / 2, y: at.y - box / 2 },
        // known size: a fresh node object (every restyle, every tween frame) keeps its handles and stays visible
        // instead of React Flow hiding it, and its edges, until it re-measures
        measured: { width: box, height: box },
        ariaLabel: `${KIND_NAME[n.kind]}${n.kind === "doc" ? "" : ` ${n.id}`} ${n.label}, ${links} link${links === 1 ? "" : "s"}${touched.has(p) ? ", changed in the last 24 hours" : ""}${p === selected ? ", selected" : ""}`,
        // the entrance offset: the layout is centred on 0,0, so -at points back at the centre (inert until data-unfold)
        data: { node: n, size, box, dim: !!lit && !lit.has(p), lit: !!lit?.has(p), active: p === selected, match: matched.has(p), changed: changed.has(p), hue, hollow, recent: touched.has(p), hideLabel: hideLabel.has(p), delay: delayOf(p), quick, unfold: { x: -at.x * UNFOLD_FROM, y: -at.y * UNFOLD_FROM, wait: waitOf(hops.get(p)) } },
        draggable: true,
      }
    })
    // edges share the nodes' timing (they used to snap); the ripple delay goes in the shorthand, since React
    // warns when `transition` and `transitionDelay` are mixed on one element
    const ms = quick ? "var(--duration-fast)" : "var(--duration-base)"
    const transition = (delay: number) => ["stroke", "stroke-width", "opacity"].map((pr) => `${pr} ${ms} var(--ease-out-soft) ${delay}ms`).join(", ")
    const edges: LinkEdge[] = visible.edges.map((e) => {
      const hot = !!selected && (e.from === selected || e.to === selected)
      // Focus 2: an edge inside the 2-hop ring stays lit, after the ripple delay
      const on = hot || (!!selected && state.focus === 2 && !!lit?.has(e.from) && !!lit.has(e.to))
      // entrance: fades in as its nearer dot lands (inert until data-unfold)
      const h = Math.min(hops.get(e.from) ?? Infinity, hops.get(e.to) ?? Infinity)
      return {
        id: `${e.from}->${e.to}`,
        source: e.from,
        target: e.to,
        type: "straight",
        className: "graph-edge-in",
        domAttributes: { "aria-hidden": true },
        style: {
          stroke: hot ? "var(--color-accent)" : EDGE,
          strokeWidth: hot ? 1.75 : 1,
          opacity: lit && !on ? 0.15 : 1,
          transition: transition(hot ? 0 : Math.max(delayOf(e.from), delayOf(e.to))),
          animationDelay: `${EDGE_IN_AFTER_MS + waitOf(Number.isFinite(h) ? h : undefined)}ms`,
        },
      }
    })
    return { base: nodes, edges }
  }, [visible, flowOrder, adj, hops, pos, byPath, selected, state.focus, state.recent, touched, q, matches, changed, statusDefs, labelK])

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


  // Live physics (drag, hover magnet): a small spring sim over the touched neighbourhood only, on rAF while anything
  // moves; idle (no loop) once every dot rests. rAF doesn't run in a hidden tab, and springStep clamps the gap after.
  const sim = useRef<SpringWorld>({ bodies: new Map(), layout: {}, shift: {}, drag: null, links: [] })
  const simRaf = useRef(0)
  const [live, setLive] = useState<Record<string, XY> | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const kick = useCallback(() => {
    if (simRaf.current) return
    let last = performance.now()
    const tick = (now: number) => {
      const w = sim.current
      const moving = springStep(w, (now - last) / 1000)
      last = now
      setLive(w.bodies.size ? Object.fromEntries([...w.bodies].map(([id, b]) => [id, { x: b.x, y: b.y }])) : null)
      simRaf.current = moving ? requestAnimationFrame(tick) : 0
    }
    simRaf.current = requestAnimationFrame(tick)
  }, [])
  useEffect(() => () => cancelAnimationFrame(simRaf.current), [])
  // the layout moved under the sim (filter, focus, new link): bodies rest on the new points; gone ones drop
  useEffect(() => {
    const w = sim.current
    w.layout = pos
    for (const id of w.bodies.keys()) if (!pos[id]) w.bodies.delete(id)
    if (w.bodies.size) kick()
  }, [pos, kick])

  /** Hover / keyboard focus: brighten the file's edges and lean its linked dots toward it (springs, interruptible). */
  const magnet = (id: string | null) => {
    setHovered(id)
    const w = sim.current
    // no lean while the entrance plays or a drag holds the neighbourhood
    if (still() || w.drag || unfolding()) return
    const shift: Record<string, XY> = {}
    const h = id ? pos[id] : undefined
    for (const p of (id && h && adj.get(id)) || []) {
      const a = pos[p]
      const d = a ? Math.hypot(h!.x - a.x, h!.y - a.y) : 0
      if (!a || d < 1) continue
      shift[p] = { x: a.x + ((h!.x - a.x) / d) * MAGNET_PX, y: a.y + ((h!.y - a.y) / d) * MAGNET_PX }
      if (!w.bodies.has(p)) w.bodies.set(p, { x: a.x, y: a.y, vx: 0, vy: 0 })
    }
    w.shift = shift
    kick()
  }
  const keyFocused = () => !!rootRef.current?.querySelector(".react-flow__node:focus-visible")
  const centreOf = (n: DotNode) => ({ x: n.position.x + n.data.box / 2, y: n.position.y + n.data.box / 2 })
  /** Drag: the dot follows the pointer, its ≤2-hop neighbourhood (1-hop on big graphs) follows on springs. */
  const onDragStart = (n: DotNode) => {
    endUnfold()
    const w = sim.current
    w.shift = {}
    const at = centreOf(n)
    if (still()) {
      // reduced motion: only the held dot moves, and it snaps back on release
      w.drag = { id: n.id, ...at }
      return setLive({ [n.id]: at })
    }
    const edges = visible?.edges ?? []
    const near = neighbourhoodIds(edges, n.id, order.length > VIRTUALIZE_OVER ? 1 : 2)
    for (const p of near) {
      const a = live?.[p] ?? pos[p]
      if (a && !w.bodies.has(p)) w.bodies.set(p, { x: a.x, y: a.y, vx: 0, vy: 0 })
    }
    w.links = edges.flatMap((e) => {
      const a = pos[e.from], b = pos[e.to]
      if (!a || !b || (!near.has(e.from) && !near.has(e.to))) return []
      return [{ a: e.from, b: e.to, len: Math.hypot(a.x - b.x, a.y - b.y), k: e.from === n.id || e.to === n.id ? SPRING.link : SPRING.link * 0.4 }]
    })
    w.drag = { id: n.id, ...at }
    kick()
  }
  const onDrag = (n: DotNode) => {
    const w = sim.current
    if (!w.drag) return
    w.drag = { id: n.id, ...centreOf(n) }
    if (still()) setLive({ [n.id]: w.drag })
  }
  const onDragStop = () => {
    const w = sim.current
    w.drag = null
    if (still()) {
      w.bodies.clear()
      return setLive(null)
    }
    kick()
  }
  const tweenFrom = tween?.from
  const tweenTo = tween?.to
  useEffect(() => {
    if (!tweenFrom || !tweenTo) return
    const t0 = performance.now()
    let raf = 0
    const step = (now: number) => {
      const k = Math.min(1, Math.max(0, (now - t0) / TWEEN_MS))
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

  // Drawn centre: live physics, else the relayout tween, else the layout (the entrance only offsets the dot in CSS)
  const nodes = useMemo(() => {
    if (!tween && !live) return base
    const moved = base.map((n): DotNode => {
      if (tween && !tween.from[n.id]) return { ...n, data: { ...n.data, enter: true } }
      const c = live?.[n.id] ?? tween?.at[n.id]
      return c ? { ...n, position: { x: c.x - n.data.box / 2, y: c.y - n.data.box / 2 } } : n
    })
    const gone = (tween?.gone ?? []).map((n): DotNode => ({ ...n, focusable: false, selectable: false, draggable: false, style: EXIT_STYLE, data: { ...n.data, exit: true } }))
    return [...moved, ...gone]
  }, [base, tween, live])

  // Edges as drawn: a hovered file's edges one step brighter (the selected file's stay accent). Kept out of `base`,
  // which measures every label.
  const shownEdges = useMemo(() => {
    if (!hovered) return edges
    return edges.map((e): LinkEdge => {
      const hot = !!selected && (e.source === selected || e.target === selected)
      return !hot && (e.source === hovered || e.target === hovered) ? { ...e, style: { ...e.style, stroke: EDGE_HOVER, strokeWidth: 1.5 } } : e
    })
  }, [edges, hovered, selected])

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
  const shelfItem = (p: string) => rootRef.current?.querySelector<HTMLElement>(`[data-shelf] [data-path="${CSS.escape(p)}"]`)
  /** Keyboard focus to a node; one that's off screen (not rendered when virtualized) is centred first; an unlinked one is on the shelf. */
  const focusNode = (p: string) => {
    const find = () => rootRef.current?.querySelector<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(p)}"]`)
    const el = find() ?? shelfItem(p)
    if (el) return el.focus({ preventScroll: !!pos[p] })
    const at = pos[p]
    if (!rf || !at) return
    userMoved.current = true
    void rf.setCenter(at.x, at.y, { zoom: rf.getZoom() }).then(() => requestAnimationFrame(() => find()?.focus({ preventScroll: true })))
  }
  /** Select and centre a file; `focus` moves keyboard focus to it (search cycling keeps it in the search box). */
  const pick = (p: string, focus = true) => {
    select(p)
    const at = pos[p]
    if (!rf || !at) return focus ? focusNode(p) : shelfItem(p)?.scrollIntoView({ block: "nearest", inline: "nearest" })
    userMoved.current = true
    void rf.setCenter(at.x, at.y, { zoom: Math.max(rf.getZoom(), 1), duration: still() ? 0 : TWEEN_MS, ease: easeOut }).then(() => { if (focus) focusNode(p) })
  }
  // Search Enter: the first frames every match, the next ones step through them (Shift+Enter back). i -1 = framed.
  // The cursor is keyed on the query and the match list, so a filter change or a refresh that changes the matches
  // starts over instead of leaving a stale "98 of 0".
  const matchKey = q + SEP + matches.join(SEP)
  const [cursor, setCursor] = useState<{ key: string; i: number } | null>(null)
  const step = cursor?.key === matchKey ? cursor.i : null
  /** Camera to the bounds of every match on the map; when none is on the map, the first shelf match takes focus. */
  const frame = (ps: string[]) => {
    const pts = ps.flatMap((p) => (pos[p] ? [pos[p]] : []))
    const el = rootRef.current?.querySelector<HTMLElement>(".react-flow")
    if (!pts.length) return shelfItem(ps[0])?.scrollIntoView({ block: "nearest", inline: "nearest" })
    if (!rf || !el) return
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y)
    // room for the labels: half a typical one beside the outer dots, one line under the lowest
    const x = Math.min(...xs) - MATCH_PAD_X, y = Math.min(...ys) - HIT
    const bounds = { x, y, width: Math.max(...xs) + MATCH_PAD_X - x, height: Math.max(...ys) + HIT + LABEL_H - y }
    userMoved.current = true
    void rf.setViewport(getViewportForBounds(bounds, el.clientWidth, el.clientHeight, FIT_MIN_ZOOM, FIT_OPTIONS.maxZoom, FIT_OPTIONS.padding), { duration: still() ? 0 : TWEEN_MS, ease: easeOut })
  }
  const onSearchKey = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter" || !matches.length) return
    e.preventDefault()
    // one match: select it and move there, as before
    if (matches.length === 1) return pick(matches[0])
    if (step === null) {
      setCursor({ key: matchKey, i: -1 })
      return frame(matches)
    }
    const i = e.shiftKey ? (step <= 0 ? matches.length - 1 : step - 1) : (step + 1) % matches.length
    setCursor({ key: matchKey, i })
    pick(matches[i], false)
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
      const to = stepFocus(id, e.key as ArrowKey, pos, adj.get(id) ?? [], flowOrder)
      if (to) focusNode(to)
    } else return
    e.preventDefault()
  }

  if (!graph && !error) return <p className="p-6 text-sm text-muted">Loading graph…</p>
  if (graph && !graph.edges.length && !error) {
    return <p className="m-6 rounded-lg border border-dashed border-border p-4 text-sm text-muted">No links between docs yet. Link docs with [text](path.md) or [[name]].</p>
  }
  // a load failure keeps the toolbar (filters, search) and says what to do; the raw error is a details line
  const g = graph ?? EMPTY_GRAPH

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
  const all = linked(g.edges)
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
              {/* a failed load has no counts: "–", not a 0 that claims the project is empty */}
              <span className="font-mono tabular-nums text-muted">{error ? "–" : count}</span>
            </button>
          )
        })}
        <button
          type="button"
          aria-pressed={state.recent}
          disabled={!touched.size && !state.recent}
          title="Files an agent or you changed in the last 24 hours"
          // on: dim everything else, and turn on the kinds the changed files belong to
          onClick={() => update(state.recent ? { recent: false } : { recent: true, kinds: KINDS.map((k) => k.kind).filter((k) => state.kinds.includes(k) || [...touched].some((p) => byPath.get(p)?.kind === k)) })}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-sm border px-2 text-xs outline-none transition-colors duration-(--duration-fast) focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50",
            state.recent ? "border-border2 bg-surface2 text-txt" : "border-border text-muted hover:border-border2 hover:text-txt",
          )}
        >
          <span aria-hidden className="size-1.5 rounded-full bg-accent" />
          Recent
          <span className="font-mono tabular-nums text-muted">{error ? "–" : touched.size}</span>
        </button>
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
          {legendStatuses.length > 0 && (
            <>
              <span>colour = status</span>
              {legendStatuses.map((d) => {
                const { hue, hollow } = dotStyle(statusDefs, d.id)
                return <span key={d.id} className="inline-flex items-center gap-1"><Shape kind="doc" size={7} hollow={hollow} className={hue} />{d.label.toLowerCase()}</span>
              })}
              <span>hollow = done</span>
            </>
          )}
          <span className="inline-flex items-center gap-1"><span aria-hidden className="size-1.5 rounded-full bg-accent" />changed in 24h</span>
        </p>
        <MissingLinks broken={g.broken} />
        {/* the broken-links button carries ml-auto; with none, the search does */}
        <label className={cn("relative flex items-center", !g.broken.length && "ml-auto")}>
          <Search className="pointer-events-none absolute left-2 size-3.5 text-muted" aria-hidden />
          <input
            id="graph-search"
            type="search"
            value={state.q}
            placeholder="Find a file…"
            aria-label="Find a file in the graph"
            aria-describedby="graph-matches"
            onChange={(e) => update({ q: e.target.value })}
            onKeyDown={onSearchKey}
            className="h-7 w-44 rounded-md border border-border bg-surface pr-16 2xl:w-48 pl-7 text-xs text-txt outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-search-cancel-button]:hidden"
          />
          {/* the count sits inside the input's reserved right padding, so it never shifts the toolbar */}
          <span id="graph-matches" className="pointer-events-none absolute right-2 font-mono text-[10px] text-muted tabular-nums">
            {!q ? "" : step !== null && step >= 0 ? `${step + 1} of ${matches.length}` : `${matches.length} match${matches.length === 1 ? "" : "es"}`}
          </span>
          {/* the / hint, as on /board, until there's a count to show */}
          {!q && <kbd aria-hidden className={cn(KBD, "pointer-events-none absolute right-1.5 max-sm:hidden")}>{GRAPH_KEYS.search.key}</kbd>}
        </label>
      </div>

      <div
        data-far={labelK > 1}
        onKeyDown={onNodeKey}
        // keyboard focus pulls like hover (a click also focuses the node, so only :focus-visible counts)
        onFocus={(e) => { const t = e.target as HTMLElement; if (t.classList.contains("react-flow__node") && t.matches(":focus-visible")) magnet(t.dataset.id ?? null) }}
        onBlur={(e) => { const t = e.target as HTMLElement; if (t.classList.contains("react-flow__node") && t.dataset.id === hovered) magnet(null) }}
        className="group/graph relative min-h-0 flex-1"
      >
        <p id="graph-hint" className="sr-only">{HINT}</p>
        {error ? (
          <div role="alert" className="m-6 max-w-xl rounded-lg border border-danger/30 bg-danger/5 p-4">
            <p className="text-sm font-medium text-txt">Couldn&apos;t load the link graph.</p>
            <p className="mt-1 text-xs text-muted">Check that VibeDoc is still running, then try again. Your files are untouched.</p>
            <p className="mt-1 font-mono text-[11px] break-words text-muted">Details: {error}</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => { setError(null); setRetry((r) => r + 1) }}>Retry</Button>
          </div>
        ) : !state.kinds.length ? (
          <div className="m-6 flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted">Every kind is off, so no files are drawn.</p>
            <Button size="sm" variant="outline" onClick={() => update({ kinds: DEFAULT_KINDS })}>Show docs</Button>
          </div>
        ) : (
          <ReactFlow<DotNode, LinkEdge>
            aria-label="Doc link graph"
            aria-roledescription="link graph"
            aria-describedby="graph-hint"
            ariaLabelConfig={ARIA_LABELS}
            edgesFocusable={false}
            nodes={nodes}
            edges={shownEdges}
            nodeTypes={nodeTypes}
            className={cn(veiled && "opacity-0")}
            onInit={setRf}
            onMoveStart={(e) => { if (e) userMoved.current = true }}
            onMove={(_, vp) => applyZoom(vp.zoom)}
            onNodeClick={(_, n) => select(n.id)}
            onNodeDoubleClick={(_, n) => open(n.data.node)}
            // hover yields to keyboard focus: while a node has the focus halo, the pointer doesn't move the lean
            onNodeMouseEnter={(_, n) => { if (!n.data.exit && !keyFocused()) magnet(n.id) }}
            onNodeMouseLeave={(_, n) => { if (n.id === hovered && !keyFocused()) magnet(null) }}
            onNodeDragStart={(_, n) => onDragStart(n)}
            onNodeDrag={(_, n) => onDrag(n)}
            onNodeDragStop={onDragStop}
            nodeClickDistance={DRAG_PX}
            nodeDragThreshold={DRAG_PX}
            autoPanOnNodeDrag={false}
            onPaneClick={() => select(null)}
            nodesConnectable={false}
            nodesDraggable
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
              onFitView={() => { userMoved.current = false; unfold() }}
              className="gap-0.5 rounded-md border border-border bg-surface p-0.5 [&_button]:size-7 [&_button]:rounded-md [&_button]:transition-colors [&_button]:duration-(--duration-fast) [&_button]:outline-none [&_button:focus-visible]:ring-2 [&_button:focus-visible]:ring-accent [&_svg]:max-h-3 [&_svg]:max-w-3"
            />
          </ReactFlow>
        )}

        {/* Unlinked shelf: files with no visible link, off the map so they never stretch the fit; after the map in tab order */}
        {!error && state.kinds.length > 0 && unlinked.length > 0 && (
          <div
            data-shelf
            role="group"
            aria-labelledby="graph-unlinked"
            className="absolute right-3 bottom-3 left-14 z-10 flex items-center gap-1 overflow-x-auto rounded-md border border-border bg-surface p-1 md:left-auto md:max-w-[min(44rem,calc(100%-4.5rem))] md:flex-wrap md:overflow-x-visible md:max-h-17 md:overflow-y-auto"
          >
            <span id="graph-unlinked" className="sticky left-0 shrink-0 bg-surface px-1.5 font-mono text-[10px] font-medium tracking-[0.06em] text-muted uppercase">
              Unlinked <span className="tabular-nums">{unlinked.length}</span>
            </span>
            {unlinked.map((p) => {
              const n = byPath.get(p)!
              const on = p === selected
              const match = q ? matches.includes(p) : false
              const dim = selected ? !on : q ? !match : state.recent && !touched.has(p)
              const { hue, hollow } = dotStyle(statusDefs, n.status)
              return (
                <button
                  key={p}
                  type="button"
                  data-path={p}
                  title={n.path}
                  aria-pressed={on}
                  aria-label={`${KIND_NAME[n.kind]}${n.kind === "doc" ? "" : ` ${n.id}`} ${n.label}, 0 links${touched.has(p) ? ", changed in the last 24 hours" : ""}`}
                  onClick={() => (on ? open(n) : select(p))}
                  className={cn(
                    "inline-flex h-6 max-w-48 shrink-0 items-center gap-1.5 rounded-sm px-1.5 text-[11px] outline-none",
                    "transition-[opacity,background-color,color] duration-(--duration-fast) ease-out-soft hover:bg-surface2 hover:text-txt focus-visible:ring-2 focus-visible:ring-accent",
                    on ? "font-medium text-txt ring-1 ring-accent" : match ? "font-medium text-txt outline-1 -outline-offset-1 outline-dashed outline-accent" : "text-muted",
                    dim && "opacity-25",
                  )}
                >
                  <span className="relative inline-flex">
                    <Shape kind={n.kind} size={n.kind === "task" ? 6 : 8} hollow={hollow} className={hue} />
                    {touched.has(p) && <span aria-hidden className="absolute -top-0.5 -right-0.5 size-1 rounded-full bg-accent ring-1 ring-surface" />}
                  </span>
                  {n.kind !== "doc" && <span className="font-mono text-[10px]">{n.id}</span>}
                  <span className="truncate">{n.label}</span>
                </button>
              )
            })}
          </div>
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
                // phones: a bottom sheet beside the zoom controls (left-14) and above the Unlinked shelf, so the map's
                // top stays clear
                "max-sm:top-auto max-sm:left-14 max-sm:w-auto max-sm:max-w-none",
                unlinked.length > 0 ? "max-sm:bottom-14" : "max-sm:bottom-3",
                // enters with a fade and a 4px slide (from the right; from below on phones), leaves faster; it stays
                // mounted for the exit
                "transition-[opacity,translate,visibility] ease-out-soft",
                sel
                  ? "duration-(--duration-base) starting:opacity-0 sm:starting:translate-x-1 max-sm:starting:translate-y-1"
                  : "invisible opacity-0 duration-(--duration-fast) sm:translate-x-1 max-sm:translate-y-1",
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
              {/* the keys that drive the map, for sighted keyboard users (screen readers get #graph-hint) */}
              <p aria-hidden className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-1 text-[11px] text-muted max-sm:hidden">
                <kbd className={KBD}>{GRAPH_KEYS.select.key}</kbd><kbd className={KBD}>{GRAPH_KEYS.open.key}</kbd> open
                <span aria-hidden>·</span>
                <kbd className={KBD}>←→</kbd> linked
                <span aria-hidden>·</span>
                <kbd className={KBD}>{GRAPH_KEYS.clear.key}</kbd> clear
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
    const k = `${e.from}${SEP}${e.to}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

const MISS_KIND: Record<string, string> = { md: "link", wiki: "wikilink" }
const MISS_FILES_SHOWN = 5

/**
 * "N broken links" (hidden at 0) and the list behind it: md / wiki links to no file, grouped by file, most first; the
 * first 5 files open, "Show all N files" for the rest. A row opens the file at that spot (`openDoc` `?link=`).
 * Stale paths (backticked mentions) are a per-doc lint: /docs Linked docs and the MCP footer list them, not here.
 */
function MissingLinks({ broken }: { broken: BrokenLink[] }) {
  const { openDoc } = useApp()
  const [all, setAll] = useState(false)
  // "Show all" → focus the first newly shown row, so a keyboard user carries on where the list grew
  const firstNew = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (all) firstNew.current?.focus()
  }, [all])
  if (!broken.length) return null
  const byFile = new Map<string, BrokenLink[]>()
  for (const r of [...broken].sort((a, b) => a.line - b.line)) byFile.set(r.from, [...(byFile.get(r.from) ?? []), r])
  const files = [...byFile].sort(([a, ra], [b, rb]) => rb.length - ra.length || a.localeCompare(b))
  const shown = all ? files : files.slice(0, MISS_FILES_SHOWN)
  return (
    <DropdownMenu onOpenChange={(open) => { if (!open) setAll(false) }}>
      <DropdownMenuTrigger className="ml-auto inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted outline-none transition-colors duration-(--duration-fast) hover:bg-surface2 hover:text-txt focus-visible:ring-2 focus-visible:ring-accent data-[state=open]:bg-surface2 data-[state=open]:text-txt">
        <span className="font-mono tabular-nums">{broken.length}</span> broken<span className="max-lg:sr-only"> link{broken.length === 1 ? "" : "s"}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[min(28rem,var(--radix-dropdown-menu-content-available-height))] w-[min(26rem,calc(100vw-2rem))]">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center px-2 pt-2 pb-1 font-mono text-[10px] font-medium tracking-[0.06em] text-muted uppercase">
            Broken links<span className="ml-auto tabular-nums">{broken.length}</span>
          </DropdownMenuLabel>
          {shown.map(([file, items], fi) => (
            <div key={file} role="group" aria-label={`${file}, ${items.length} broken`}>
              <p className="flex items-baseline gap-2 px-2 pt-1.5 font-mono text-[11px] text-txt" title={file}>
                <span className="min-w-0 truncate">{file}</span>
                <span className="ml-auto shrink-0 text-muted tabular-nums">{items.length}</span>
              </p>
              {items.map((r, ri) => (
                <DropdownMenuItem key={`${r.target}:${r.line}`} ref={fi === MISS_FILES_SHOWN && ri === 0 ? firstNew : undefined} onSelect={() => void openDoc(r.from, r.target)} className="gap-2 py-1 text-xs">
                  <Unlink className="size-3.5 text-muted" aria-hidden />
                  <span className="min-w-0 truncate font-mono text-muted">{r.target}</span>
                  <span className="ml-auto shrink-0 text-[11px] text-muted">{MISS_KIND[r.kind] ?? r.kind}</span>
                  <span className="shrink-0 font-mono text-[11px] text-muted tabular-nums">L{r.line}</span>
                </DropdownMenuItem>
              ))}
            </div>
          ))}
          {/* an item, so arrow keys reach it; preventDefault keeps the menu open while it grows */}
          {shown.length < files.length && (
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setAll(true) }} className="mt-1 py-1 text-xs text-muted">
              <span>Show all <span className="font-mono tabular-nums">{files.length}</span> files</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
