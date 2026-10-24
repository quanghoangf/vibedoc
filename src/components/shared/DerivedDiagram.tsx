"use client"

import { useCallback, useEffect, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { MarkdownRenderer } from "@/components/docs/MarkdownRenderer"
import { useApp } from "@/context/AppContext"
import { useT } from "@/context/LanguageContext"
import { depGraphMermaid, epicGraph, epicGraphMermaid, taskNeighbourhood, type EpicScenario } from "@/lib/item-diagrams"
import { useStatusLabel } from "@/components/shared/StatusIcon"
import type { Task } from "@/types"

// Diagrams derived from project data (R097). The source is generated Mermaid, rendered by MarkdownRenderer, so the
// authored diagrams' theme, fullscreen viewer and error box apply as is. Mermaid's own `click` needs a looser
// securityLevel than our antiscript, so node clicks are one delegated listener on the wrapper instead.

// a flowchart node's DOM id: <svg id>-flowchart-<nodeId>-<n>
const NODE_ID_RE = /(?:^|-)flowchart-([A-Za-z]\w*)-\d+$/
const ITEM_ID_RE = /^[TS]\d+$/
const isItemId = (id: string) => ITEM_ID_RE.test(id)

/**
 * A rendered Mermaid flowchart whose clickable nodes (default: task / scenario ids `T\d+`, `S\d+`; `isLink` decides)
 * open by click or Enter / Space.
 */
export function DerivedDiagram({ source, label, onOpen, isLink = isItemId, fit = false }: {
  source: string
  label: string
  onOpen: (id: string) => void
  isLink?: (id: string) => boolean
  /** Always scale to the box (a narrow rail): no Actual size control; Fullscreen still shows it large */
  fit?: boolean
}) {
  const ref = useRef<HTMLElement>(null)
  const { t } = useT()
  const statusLabel = useStatusLabel()
  useEffect(() => {
    const root = ref.current
    if (!root) return
    const idOf = (el: Element | null) => {
      const node = el?.closest("g.node")
      const id = node ? NODE_ID_RE.exec(node.id)?.[1] ?? null : null
      return id && isLink(id) ? id : null
    }
    // Mermaid draws after a debounce and again on a theme switch: make every task node a focusable link as it appears
    const mark = () => {
      // a map wider than the pane opens on the item it is about (the accent node), not on its left edge
      for (const svg of root.querySelectorAll<SVGSVGElement>(".mermaid > svg:not([data-centred])")) {
        const focus = svg.querySelector("g.node.accent")
        const box = svg.parentElement
        if (!focus || !box) continue
        svg.dataset.centred = ""
        const f = focus.getBoundingClientRect(), b = box.getBoundingClientRect()
        box.scrollLeft += f.left + f.width / 2 - (b.left + b.width / 2)
      }
      for (const node of root.querySelectorAll<SVGGElement>("g.node:not([tabindex])")) {
        const id = idOf(node)
        if (!id) continue
        node.setAttribute("tabindex", "0")
        node.setAttribute("role", "link")
        // the status lives in the node's class (its stroke): name it too, so it isn't colour only
        const st = /\bst-([a-z-]+)/.exec(node.getAttribute("class") ?? "")?.[1]
        const named = st && st !== "missing" ? ` · ${statusLabel(st)}` : ""
        node.setAttribute("aria-label", t("board.depDiagramOpen", { title: (node.textContent?.trim() || id) + named }))
        node.style.cursor = "pointer"
      }
    }
    const mo = new MutationObserver(mark)
    mo.observe(root, { childList: true, subtree: true })
    mark()
    const onClick = (e: MouseEvent) => { const id = idOf(e.target as Element); if (id) onOpen(id) }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " ") return
      const id = idOf(e.target as Element)
      if (id) { e.preventDefault(); onOpen(id) }
    }
    root.addEventListener("click", onClick)
    root.addEventListener("keydown", onKey)
    return () => { mo.disconnect(); root.removeEventListener("click", onClick); root.removeEventListener("keydown", onKey) }
  }, [onOpen, t, isLink, statusLabel])
  return (
    <section ref={ref} aria-label={label} data-derived-diagram>
      <MarkdownRenderer content={"```mermaid\n" + source + "\n```\n"} className={fit ? "derived-diagram derived-diagram-fit" : "derived-diagram"} />
    </section>
  )
}

/** A task's dependencies and dependents (T520); nothing when it has neither. Updates with the board (SSE). */
export function TaskDepsDiagram({ task, onNavigate, className = "px-5 pt-3" }: { task: Task; onNavigate?: () => void; className?: string }) {
  const { board } = useApp()
  const { t } = useT()
  const router = useRouter()
  // only the generated text matters: an unrelated board refresh yields the same string and draws nothing new
  const source = useMemo(() => {
    const g = taskNeighbourhood(task.id, board ? Object.values(board).flat() : [])
    return g ? depGraphMermaid(g, task.id) : null
  }, [board, task.id])
  const open = useCallback((id: string) => {
    if (id === task.id) return
    onNavigate?.()
    router.push(`/board?task=${encodeURIComponent(id)}`)
  }, [onNavigate, router, task.id])
  if (!source) return null
  return (
    <div className={className} data-task-deps={task.id}>
      <h3 className="mb-1 text-[11px] font-medium tracking-wide text-muted uppercase">{t("board.depDiagram")}</h3>
      <DerivedDiagram source={source} label={t("board.depDiagram")} onOpen={open} />
    </div>
  )
}

/** An epic's tasks with dependency order and the scenarios each covers (T521); nothing for an epic without tasks.
 *  The epic sheet mounts it only inside its open "Map" disclosure, so it never draws unasked. */
export function EpicDiagram({ taskIds, tasks, scenarios, onOpenTask, onOpenScenario }: {
  taskIds: string[]
  tasks: Task[]
  scenarios: EpicScenario[]
  onOpenTask: (id: string) => void
  onOpenScenario: (id: string) => void
}) {
  const { t } = useT()
  const graph = useMemo(() => epicGraph(taskIds, tasks.map((x) => ({ ...x, covers: x.covers ?? [] })), scenarios), [taskIds, tasks, scenarios])
  const source = useMemo(() => epicGraphMermaid(graph), [graph])
  const open = useCallback((id: string) => (id.startsWith("S") ? onOpenScenario(id) : onOpenTask(id)), [onOpenScenario, onOpenTask])
  if (graph.tasks.length === 0) return null
  return (
    <div data-epic-diagram>
      <DerivedDiagram source={source} label={t("roadmap.diagram")} onOpen={open} />
    </div>
  )
}
