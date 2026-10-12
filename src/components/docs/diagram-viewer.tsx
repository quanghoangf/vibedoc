"use client"

import { useEffect, useRef, useState, type RefObject } from "react"
import { Maximize, Minus, Plus } from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { tNow, useT } from "@/context/LanguageContext"
import { FIT, panBy, zoomAt, type ZoomPan } from "@/lib/zoom-pan"

// Diagram tools (T514): each rendered mermaid diagram gets a small toolbar (Fullscreen · Copy source), visible on
// hover / focus-within. The doc markup is innerHTML (sanitize() strips on* attributes), so the buttons are plain
// markup added after Mermaid renders and one delegated click listener per renderer handles them.

// lucide maximize-2 and copy
const ICON_FULLSCREEN = '<svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="m21 3-7 7"/><path d="m3 21 7-7"/><path d="M9 21H3v-6"/></svg>'
const ICON_COPY = '<svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>'

const button = (action: string, label: string, icon: string) => {
  const b = document.createElement("button")
  b.type = "button"
  b.dataset.diagramAction = action
  b.setAttribute("aria-label", label)
  b.title = label
  b.innerHTML = icon
  return b
}

/** Adds the toolbar to a diagram Mermaid just drew (its innerHTML was replaced, so any old toolbar is gone). */
export function decorateDiagram(node: HTMLElement) {
  const bar = document.createElement("div")
  bar.className = "diagram-tools"
  bar.dataset.diagramTools = ""
  bar.append(button("fullscreen", tNow("docs.diagramFullscreen"), ICON_FULLSCREEN), button("copy", tNow("docs.diagramCopySource"), ICON_COPY))
  node.append(bar)
}

export const fencedSource = (src: string) => "```mermaid\n" + src.replace(/\n+$/, "") + "\n```\n"

/** Delegated toolbar clicks on a renderer's container; returns the fullscreen dialog to render next to it. */
export function useDiagramTools(containerRef: RefObject<HTMLElement | null>, html: string) {
  const [open, setOpen] = useState<{ svg: string } | null>(null)
  // kept past the close: Radix calls onCloseAutoFocus after `open` is already null
  const opener = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const root = containerRef.current
    if (!root) return
    const onClick = (e: MouseEvent) => {
      const btn = (e.target as Element | null)?.closest<HTMLElement>("[data-diagram-action]")
      const node = btn?.closest<HTMLElement>(".mermaid")
      if (!btn || !node || !root.contains(btn)) return
      e.preventDefault()
      if (btn.dataset.diagramAction === "fullscreen") {
        const svg = node.querySelector(":scope > svg")
        if (svg) { opener.current = btn; setOpen({ svg: svg.outerHTML }) }
      } else {
        navigator.clipboard.writeText(fencedSource(node.dataset.source ?? ""))
          .then(() => toast(tNow("docs.diagramCopied")), () => toast(tNow("docs.diagramCopyFailed")))
      }
    }
    root.addEventListener("click", onClick)
    return () => root.removeEventListener("click", onClick)
  }, [containerRef, html])
  return <DiagramDialog svg={open?.svg ?? null} opener={opener} onClose={() => setOpen(null)} />
}

const STEP = 1.25

function DiagramDialog({ svg, opener, onClose }: { svg: string | null; opener: RefObject<HTMLElement | null>; onClose: () => void }) {
  const { t } = useT()
  const [view, setView] = useState<ZoomPan>(FIT)
  const [stage, setStage] = useState<HTMLDivElement | null>(null)
  const drag = useRef<{ x: number; y: number } | null>(null)
  // a new diagram opens at Fit; adjusting state during render (not in an effect) per React's guidance
  const [shown, setShown] = useState(svg)
  if (svg !== shown) { setShown(svg); setView(FIT) }

  const center = () => {
    const r = stage?.getBoundingClientRect()
    return r ? { x: r.width / 2, y: r.height / 2 } : { x: 0, y: 0 }
  }
  const zoom = (factor: number) => setView((v) => zoomAt(v, factor, center()))

  // wheel must be non-passive to stop the page from scrolling, so it can't be a React onWheel prop
  useEffect(() => {
    if (!stage) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = stage.getBoundingClientRect()
      setView((v) => zoomAt(v, Math.exp(-e.deltaY * 0.002), { x: e.clientX - r.left, y: e.clientY - r.top }))
    }
    stage.addEventListener("wheel", onWheel, { passive: false })
    return () => stage.removeEventListener("wheel", onWheel)
  }, [stage])

  return (
    <Dialog open={svg !== null} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent
        data-diagram-viewer
        // Radix returns focus to its Trigger, and this dialog has none: send it back to the toolbar button
        onCloseAutoFocus={(e) => { e.preventDefault(); opener.current?.focus() }}
        className="flex h-[100svh] w-screen max-w-none flex-col gap-0 p-0 sm:h-[92vh] sm:w-[96vw] sm:max-w-none"
        onKeyDown={(e) => {
          if (e.key === "+" || e.key === "=") { e.preventDefault(); zoom(STEP) }
          else if (e.key === "-" || e.key === "_") { e.preventDefault(); zoom(1 / STEP) }
          else if (e.key === "0") { e.preventDefault(); setView(FIT) }
        }}
      >
        <div className="flex items-center gap-1 border-b border-border px-3 py-2 pr-12">
          <DialogTitle className="mr-auto text-sm font-medium">{t("docs.diagramViewer")}</DialogTitle>
          <span className="mr-2 font-mono text-[11px] text-muted" data-diagram-scale>{Math.round(view.scale * 100)}%</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t("docs.diagramZoomOut")} title={`${t("docs.diagramZoomOut")} (−)`} onClick={() => zoom(1 / STEP)}><Minus className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t("docs.diagramZoomIn")} title={`${t("docs.diagramZoomIn")} (+)`} onClick={() => zoom(STEP)}><Plus className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5" title={`${t("docs.diagramFit")} (0)`} onClick={() => setView(FIT)}><Maximize className="h-3.5 w-3.5" />{t("docs.diagramFit")}</Button>
        </div>
        <div
          ref={setStage}
          className="diagram-stage relative min-h-0 flex-1 cursor-grab touch-none overflow-hidden bg-bg active:cursor-grabbing"
          onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId) }}
          onPointerMove={(e) => {
            const d = drag.current
            if (!d) return
            drag.current = { x: e.clientX, y: e.clientY }
            setView((v) => panBy(v, e.clientX - d.x, e.clientY - d.y))
          }}
          onPointerUp={() => { drag.current = null }}
          onPointerCancel={() => { drag.current = null }}
        >
          <div
            data-diagram-stage
            className="absolute inset-0 p-6"
            style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, transformOrigin: "0 0" }}
            // the same SVG Mermaid already drew into the doc (sanitized markdown → Mermaid with antiscript)
            dangerouslySetInnerHTML={{ __html: svg ?? "" }}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
