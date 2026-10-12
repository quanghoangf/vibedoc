"use client"

import { useCallback, useEffect, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { MarkdownRenderer } from "@/components/docs/MarkdownRenderer"
import { useApp } from "@/context/AppContext"
import { useT } from "@/context/LanguageContext"
import { depGraphMermaid, taskNeighbourhood } from "@/lib/item-diagrams"
import type { Task } from "@/types"

// Diagrams derived from project data (R097). The source is generated Mermaid, rendered by MarkdownRenderer, so the
// authored diagrams' theme, fullscreen viewer and error box apply as is. Mermaid's own `click` needs a looser
// securityLevel than our antiscript, so node clicks are one delegated listener on the wrapper instead.

// a flowchart node's DOM id: <svg id>-flowchart-<nodeId>-<n>
const NODE_ID_RE = /(?:^|-)flowchart-(T\d+)-\d+$/

/** A rendered Mermaid flowchart whose task nodes (ids `T\d+`) open their task, by click or Enter / Space. */
export function DerivedDiagram({ source, label, onOpen }: { source: string; label: string; onOpen: (id: string) => void }) {
  const ref = useRef<HTMLElement>(null)
  const { t } = useT()
  useEffect(() => {
    const root = ref.current
    if (!root) return
    const idOf = (el: Element | null) => {
      const node = el?.closest("g.node")
      return node ? NODE_ID_RE.exec(node.id)?.[1] ?? null : null
    }
    // Mermaid draws after a debounce and again on a theme switch: make every task node a focusable link as it appears
    const mark = () => {
      for (const node of root.querySelectorAll<SVGGElement>("g.node:not([tabindex])")) {
        const id = idOf(node)
        if (!id) continue
        node.setAttribute("tabindex", "0")
        node.setAttribute("role", "link")
        node.setAttribute("aria-label", t("board.depDiagramOpen", { title: node.textContent?.trim() || id }))
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
  }, [onOpen, t])
  return (
    <section ref={ref} aria-label={label} data-derived-diagram>
      <MarkdownRenderer content={"```mermaid\n" + source + "\n```\n"} className="derived-diagram" />
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
