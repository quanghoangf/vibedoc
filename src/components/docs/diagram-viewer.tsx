"use client"

import { useEffect, useRef, useState, type RefObject } from "react"
import { Maximize, Minus, Plus } from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { tNow, useT } from "@/context/LanguageContext"
import { FIT, panBy, zoomAt, type ZoomPan } from "@/lib/zoom-pan"
import { PASTE_PALETTE, visualBlockToHtml, type RichItem } from "@/lib/rich-copy"

// Diagram tools (T514): each rendered mermaid diagram gets a small toolbar (Fullscreen · Copy image · Copy source),
// each visual block one with Copy (T517), visible on hover / focus-within. The doc markup is innerHTML (sanitize() strips on* attributes), so the buttons are plain
// markup added after Mermaid renders and one delegated click listener per renderer handles them.

// lucide maximize-2, copy and image
const ICON_FULLSCREEN = '<svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="m21 3-7 7"/><path d="m3 21 7-7"/><path d="M9 21H3v-6"/></svg>'
const ICON_COPY = '<svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>'

const ICON_IMAGE = '<svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>'

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
  bar.append(
    button("fullscreen", tNow("docs.diagramFullscreen"), ICON_FULLSCREEN),
    button("copy-image", tNow("docs.diagramCopyImage"), ICON_IMAGE),
    button("copy", tNow("docs.diagramCopySource"), ICON_COPY),
  )
  node.append(bar)
}

/**
 * A wide diagram isn't clipped silently: Mermaid's node gets a frame (once; a theme re-render keeps it) holding a
 * right-edge fade and a "Fit" / "Scroll →" chip, outside the scrolling node so neither scrolls away with the SVG.
 * measureDiagramFrame decides the frame's state.
 */
export function frameDiagram(node: HTMLElement) {
  let frame = node.parentElement
  if (!frame?.hasAttribute("data-diagram-frame")) {
    frame = document.createElement("div")
    frame.className = "diagram-frame not-prose"
    frame.dataset.diagramFrame = ""
    node.replaceWith(frame)
    const fade = document.createElement("div")
    fade.className = "diagram-fade"
    fade.setAttribute("aria-hidden", "true")
    const chip = button("fit", tNow("docs.diagramFitLabel"), "")
    chip.className = "diagram-fit"
    chip.textContent = tNow("docs.diagramFitWidth")
    frame.append(node, fade, chip)
  }
  measureDiagramFrame(frame)
  // Mermaid drew into a pane that may still be settling (the frame just broke out of the prose column, the Linked
  // docs rail or the outline mounting beside it): measure again once layout has caught up, so a diagram that
  // overflows shows its fade and Fit chip at rest, not only after a resize
  requestAnimationFrame(() => requestAnimationFrame(() => { if (frame.isConnected) measureDiagramFrame(frame) }))
}

/**
 * data-wide: the SVG is wider than the prose column, so the frame breaks out of it up to the pane (.doc-preview grid);
 * data-overflow: even there it can't shrink to its 75% floor, so it scrolls (fade + chip, the node takes focus for arrow keys);
 * data-fit: the reader chose Fit, so the SVG scales to the width; data-at-end: scrolled to the right edge (no fade).
 */
export function measureDiagramFrame(frame: HTMLElement) {
  const node = frame.querySelector<HTMLElement>(":scope > .mermaid")
  const svg = node?.querySelector<SVGSVGElement>(":scope > svg")
  if (!node || !svg) return
  // a derived map in a narrow rail always scales to its box: nothing to scroll
  if (frame.closest(".derived-diagram-fit")) {
    frame.removeAttribute("data-overflow")
    node.removeAttribute("tabindex")
    return
  }
  const natural = parseFloat(svg.style.maxWidth) || 0
  const floor = parseFloat(svg.style.minWidth) || natural
  const css = getComputedStyle(node)
  const padX = parseFloat(css.paddingLeft) + parseFloat(css.paddingRight)
  const borderX = node.offsetWidth - node.clientWidth
  const inner = () => node.clientWidth - padX
  delete frame.dataset.wide
  frame.style.maxWidth = ""
  if (natural > inner()) {
    frame.dataset.wide = ""
    frame.style.maxWidth = `${Math.ceil(natural + padX + borderX)}px`
  }
  const overflow = floor > inner() + 1
  frame.toggleAttribute("data-overflow", overflow)
  if (overflow) node.tabIndex = 0
  else {
    node.removeAttribute("tabindex")
    const chip = frame.querySelector<HTMLElement>(":scope > .diagram-fit")
    if (frame.hasAttribute("data-fit") && chip) toggleFit(chip)
  }
  markScrollEnd(node)
}

function markScrollEnd(node: HTMLElement) {
  node.parentElement?.toggleAttribute("data-at-end", node.scrollLeft + node.clientWidth >= node.scrollWidth - 2)
}

function toggleFit(chip: HTMLElement) {
  const frame = chip.closest<HTMLElement>("[data-diagram-frame]")
  if (!frame) return
  const fit = !frame.hasAttribute("data-fit")
  frame.toggleAttribute("data-fit", fit)
  chip.textContent = tNow(fit ? "docs.diagramScrollWide" : "docs.diagramFitWidth")
  chip.setAttribute("aria-label", tNow(fit ? "docs.diagramScrollLabel" : "docs.diagramFitLabel"))
  chip.title = chip.getAttribute("aria-label") ?? ""
  chip.setAttribute("aria-pressed", String(fit))
  const node = frame.querySelector<HTMLElement>(":scope > .mermaid")
  if (node) markScrollEnd(node)
}

/** A visual block's toolbar (T517): Copy, keeping the look. Static markup, so added once per render of the doc. */
function decorateBlock(block: HTMLElement) {
  block.dataset.tools = ""
  const bar = document.createElement("div")
  bar.className = "diagram-tools"
  bar.dataset.diagramTools = ""
  bar.append(button("copy-rich", tNow("docs.blockCopy"), ICON_COPY))
  block.append(bar)
}

/** The rendered cards back as RichItems (their HTML is the sanitized render, so links and code survive). */
function blockItems(block: HTMLElement): RichItem[] {
  return Array.from(block.querySelectorAll<HTMLElement>(":scope > :is(ol, ul) > li")).map((li) => ({
    icon: li.querySelector(".md-visual-icon")?.textContent ?? undefined,
    title: li.querySelector(".md-visual-title")?.innerHTML ?? "",
    body: li.querySelector(".md-visual-body")?.innerHTML ?? "",
    detail: li.querySelector(".md-visual-detail")?.innerHTML ?? "",
    now: li.hasAttribute("data-now"),
  }))
}

/** Rich + plain on one clipboard item; a browser without ClipboardItem gets the markdown and is told so. */
async function copyBlock(block: HTMLElement) {
  const source = block.dataset.source ?? ""
  if (typeof ClipboardItem === "undefined") {
    await navigator.clipboard.writeText(source)
    toast(tNow("docs.blockCopiedPlain"))
    return
  }
  const accent = `rgb(${getComputedStyle(document.documentElement).getPropertyValue("--rgb-accent").trim().split(/\s+/).join(", ")})`
  const html = visualBlockToHtml(block.dataset.visual ?? "cards", blockItems(block), { ...PASTE_PALETTE, accent })
  await navigator.clipboard.write([new ClipboardItem({
    "text/html": new Blob([html], { type: "text/html" }),
    "text/plain": new Blob([source], { type: "text/plain" }),
  })])
  toast(tNow("docs.blockCopied"))
}

// what the page stylesheet adds to a diagram (status colours, the accent, dashes): inlined so the image matches
const INLINE_PROPS = ["fill", "stroke", "stroke-width", "stroke-dasharray", "opacity", "color", "font-family", "font-size", "font-weight", "background-color"]

const SVG_NS = "http://www.w3.org/2000/svg"

/** The words of a rendered label grouped into its visual lines (by each word's top edge). */
function renderedLines(el: Element): string[] {
  const lines: { top: number; words: string[] }[] = []
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.textContent ?? ""
    for (const m of text.matchAll(/\S+/g)) {
      const r = document.createRange()
      r.setStart(n, m.index)
      r.setEnd(n, m.index + m[0].length)
      const top = Math.round(r.getBoundingClientRect().top)
      const line = lines.find((l) => Math.abs(l.top - top) < 3)
      if (line) line.words.push(m[0])
      else lines.push({ top, words: [m[0]] })
    }
  }
  return lines.sort((a, b) => a.top - b.top).map((l) => l.words.join(" "))
}

/** A <text> centred where the foreignObject was, one <tspan> per rendered line, in the label's colour and font. */
function labelAsText(fo: SVGForeignObjectElement): SVGTextElement {
  const label = (fo.querySelector("span, div, p") ?? fo) as HTMLElement
  const cs = getComputedStyle(label)
  const x = Number(fo.getAttribute("x") ?? 0) + Number(fo.getAttribute("width") ?? 0) / 2
  const y = Number(fo.getAttribute("y") ?? 0) + Number(fo.getAttribute("height") ?? 0) / 2
  const lines = renderedLines(label)
  const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5
  const text = document.createElementNS(SVG_NS, "text")
  text.setAttribute("text-anchor", "middle")
  text.setAttribute("dominant-baseline", "central")
  text.setAttribute("transform", fo.getAttribute("transform") ?? "")
  text.style.cssText = `fill:${cs.color};font-family:${cs.fontFamily};font-size:${cs.fontSize};font-weight:${cs.fontWeight}`
  lines.forEach((line, i) => {
    const span = document.createElementNS(SVG_NS, "tspan")
    span.setAttribute("x", String(x))
    span.setAttribute("y", String(y + (i - (lines.length - 1) / 2) * lh))
    span.textContent = line
    text.append(span)
  })
  return text
}

/** The diagram as a 2× PNG on the page background, with the page's computed styles inlined into a copy of the SVG. */
async function diagramPng(svg: SVGSVGElement): Promise<Blob> {
  const copy = svg.cloneNode(true) as SVGSVGElement
  const src = [svg, ...svg.querySelectorAll("*")]
  const dst = [copy, ...copy.querySelectorAll("*")]
  src.forEach((el, i) => {
    const cs = getComputedStyle(el)
    const target = dst[i] as HTMLElement | SVGElement
    for (const prop of INLINE_PROPS) target.style.setProperty(prop, cs.getPropertyValue(prop))
  })
  // HTML labels (<foreignObject>) taint a canvas, so the copy gets SVG <text> with the label's rendered lines instead
  const fos = Array.from(svg.querySelectorAll("foreignObject"))
  Array.from(copy.querySelectorAll("foreignObject")).forEach((fo, i) => fo.replaceWith(labelAsText(fos[i])))
  const vb = svg.viewBox.baseVal
  const w = vb?.width || svg.getBoundingClientRect().width, h = vb?.height || svg.getBoundingClientRect().height
  copy.setAttribute("width", String(w))
  copy.setAttribute("height", String(h))
  copy.style.maxWidth = "none"
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)], { type: "image/svg+xml" }))
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const canvas = document.createElement("canvas")
    canvas.width = Math.ceil(w * 2)
    canvas.height = Math.ceil(h * 2)
    const ctx = canvas.getContext("2d")!
    ctx.fillStyle = getComputedStyle(document.body).backgroundColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.scale(2, 2)
    ctx.drawImage(img, 0, 0, w, h)
    return await new Promise<Blob>((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("toBlob"))), "image/png"))
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function copyDiagramImage(node: HTMLElement) {
  const svg = node.querySelector<SVGSVGElement>(":scope > svg")
  if (!svg) return
  const source = fencedSource(node.dataset.source ?? "")
  if (typeof ClipboardItem === "undefined") {
    await navigator.clipboard.writeText(source)
    toast(tNow("docs.blockCopiedPlain"))
    return
  }
  // a promise per type keeps the copy inside the click's user activation while the PNG is drawn
  await navigator.clipboard.write([new ClipboardItem({
    "image/png": diagramPng(svg),
    "text/plain": new Blob([source], { type: "text/plain" }),
  })])
  toast(tNow("docs.diagramImageCopied"))
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
    for (const block of root.querySelectorAll<HTMLElement>(".md-visual:not([data-tools])")) decorateBlock(block)
    const failed = () => toast(tNow("docs.diagramCopyFailed"))
    const onClick = (e: MouseEvent) => {
      const btn = (e.target as Element | null)?.closest<HTMLElement>("[data-diagram-action]")
      if (!btn || !root.contains(btn)) return
      if (btn.dataset.diagramAction === "fit") { e.preventDefault(); toggleFit(btn); return }
      if (btn.dataset.diagramAction === "copy-rich") {
        const block = btn.closest<HTMLElement>(".md-visual")
        if (block) { e.preventDefault(); copyBlock(block).catch(failed) }
        return
      }
      const node = btn.closest<HTMLElement>(".mermaid")
      if (!node) return
      e.preventDefault()
      if (btn.dataset.diagramAction === "copy-image") {
        copyDiagramImage(node).catch(failed)
      } else if (btn.dataset.diagramAction === "fullscreen") {
        const svg = node.querySelector(":scope > svg")
        if (svg) { opener.current = btn; setOpen({ svg: svg.outerHTML }) }
      } else {
        navigator.clipboard.writeText(fencedSource(node.dataset.source ?? ""))
          .then(() => toast(tNow("docs.diagramCopied")), () => toast(tNow("docs.diagramCopyFailed")))
      }
    }
    root.addEventListener("click", onClick)
    // scroll doesn't bubble: capture it to drop the fade at the right edge
    const onScroll = (e: Event) => {
      const node = e.target as HTMLElement
      if (node instanceof HTMLElement && node.parentElement?.hasAttribute("data-diagram-frame")) markScrollEnd(node)
    }
    root.addEventListener("scroll", onScroll, true)
    // the pane resizes (Linked docs column, window): frames re-decide wide / overflow
    // width only, next frame: re-measuring changes heights, which must not feed back into this observer
    let lastWidth = root.clientWidth
    const ro = new ResizeObserver(([entry]) => {
      const w = entry?.contentRect.width ?? 0
      if (w === lastWidth) return
      lastWidth = w
      requestAnimationFrame(() => { for (const f of root.querySelectorAll<HTMLElement>("[data-diagram-frame]")) measureDiagramFrame(f) })
    })
    ro.observe(root)
    return () => {
      root.removeEventListener("click", onClick)
      root.removeEventListener("scroll", onScroll, true)
      ro.disconnect()
    }
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
