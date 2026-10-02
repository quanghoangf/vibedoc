"use client"

import { useCallback, useEffect, useId, useRef, useState, type RefObject } from "react"
import { createPortal } from "react-dom"
import { Unlink } from "lucide-react"
import { useApp } from "@/context/AppContext"
import { cn } from "@/lib/utils"
import { KIND_ICON } from "@/components/memory/EntryRelated"
import { stripFrontmatter } from "@/lib/doc-priority"
import { displayStatus, resolveStatus } from "@/lib/statuses"
import { StatusChip } from "@/components/shared/StatusIcon"
import { useStatusDefs } from "@/components/shared/status-defs"
import { OwnerChip } from "@/components/shared/OwnerChip"
import { LINK_EVENTS } from "./useDocLinks"

/** What a hovered link points at: a resolved file, or a broken raw target. */
export type PreviewTarget = { path: string; kind: string; label: string } | { broken: string }
type Preview = { title: string; text: string; status?: string; owner?: string }
// open false = fading out: the card stays mounted with its last content until the next one opens. `bounds`: the
// [data-preview-bounds] column the anchor sits in (Linked docs), whose width and left edge the card keeps.
type Card = { key: string; anchor: Element; target: PreviewTarget; rect: DOMRect; bounds?: DOMRect; data: Preview | null; open: boolean }

const SHOW_DELAY = 350
const HIDE_DELAY = 150
// Tabbing through rows: a focus this soon after the last one waits TAB_DELAY, so the card doesn't flicker past every
// row; a single deliberate focus shows at once
const TAB_THROUGH_MS = 500
const TAB_DELAY = 200
// the browser scrolls a newly focused link into view; scroll events this soon after a focus move the card, never hide it
const FOCUS_SCROLL_MS = 150
const CARD_W = 320
const CARD_H = 220
// the card's distance from a column it sits beside, and from the viewport edge
const CARD_GAP = 8
const MAX_TEXT = 400

/** Session cache of fetched previews, keyed by root + path; any file change (LINK_EVENTS) clears it. */
const cache = new Map<string, Preview>()

const meta = (raw: string, key: string) => new RegExp(`^\\*\\*${key}:\\*\\*\\s*(.+)$`, "m").exec(raw)?.[1].trim()

/** Paired emphasis only (`**x**`, `__x__`, `*x*`, `_x_` at word edges): `vibedoc_next_task` keeps its underscores. */
const unemphasize = (s: string) => s
  .replace(/(\*\*|__)(?=\S)([^\n]*?\S)\1/g, "$2")
  .replace(/(^|[^\w*])\*(?=\S)([^*\n]*?\S)\*(?![\w*])/g, "$1$2")
  .replace(/(^|[^\w])_(?=\S)([^_\n]*?\S)_(?!\w)/g, "$1$2")

/** Title, owner/status meta and the opening ~400 chars as plain text, `inline code` ticks kept. A rough strip, not a render. */
function toPreview(raw: string, fallbackTitle: string): Preview {
  const body = stripFrontmatter(raw)
  const h1 = /^#\s+(.+)$/m.exec(body)?.[1].trim()
  let text = body
    .replace(/^#\s+.+$/m, "")
    .replace(/^\*\*[^*\n]+:\*\*.*$/gm, "") // task/epic meta lines
    .replace(/(`{3,}|~{3,})[\s\S]*?\1/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => b ?? a)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/^\s*(?:[-*+]|\d+\.)\s+\[[ xX]\]\s*/gm, "") // task-list boxes
    .replace(/^\s*(?:#{1,6}|>|[-*+]|\d+\.|\|)\s*/gm, "")
    .split(/(`[^`\n]*`)/)
    .map((part, i) => (i % 2 ? part : unemphasize(part).replace(/\|/g, " ")))
    .join("")
    .replace(/\s+/g, " ")
    .trim()
  if (text.length > MAX_TEXT) {
    text = text.slice(0, MAX_TEXT).trimEnd()
    if ((text.match(/`/g)?.length ?? 0) % 2) text = text.replace(/`(?=[^`]*$)/, "")
    text += "…"
  }
  return {
    title: h1 ?? fallbackTitle,
    text,
    status: meta(raw, "Status"),
    owner: meta(raw, "Owner"),
  }
}

/**
 * Hover/focus preview card for links inside `containerRef` (R056). `resolve` maps an event target to the link
 * element and what it points at; delegated listeners, so it works on rendered markdown as well as React rows.
 */
export function LinkPreview({ containerRef, resolve }: {
  containerRef: RefObject<HTMLElement | null>
  resolve: (el: Element) => { anchor: Element; target: PreviewTarget } | null
}) {
  const { rootParam } = useApp()
  const statusDefs = useStatusDefs()
  const id = useId()
  const [card, setCard] = useState<Card | null>(null)
  // pending show/hide; shared with the card so hovering it cancels the hide
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const close = useCallback(() => setCard((c) => (c?.open ? { ...c, open: false } : c)), [])

  useEffect(() => {
    const onSse = (e: Event) => {
      if (LINK_EVENTS.has((e as CustomEvent<{ type: string }>).detail?.type)) cache.clear()
    }
    window.addEventListener("vibedoc:sse", onSse)
    return () => window.removeEventListener("vibedoc:sse", onSse)
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let current: Element | null = null
    let focusAt = -Infinity
    const measure = (anchor: Element) => ({ rect: anchor.getBoundingClientRect(), bounds: anchor.closest("[data-preview-bounds]")?.getBoundingClientRect() })

    // `delay` applies even to a cached preview when `always` (tabbing through rows); a hover on a cached one is instant
    const show = (anchor: Element, target: PreviewTarget, delay: number, always = false) => {
      const key = "broken" in target ? `!${target.broken}` : `${rootParam}|${target.path}`
      const cached = cache.get(key) ?? null
      clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        if (current !== anchor) return
        setCard({ key, anchor, target, ...measure(anchor), data: cached, open: true })
        if (cached || "broken" in target) return
        fetch(`/api/docs${rootParam}&read=${encodeURIComponent(target.path)}`)
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
          .then((d: { content?: string }) => {
            const p = toPreview(d.content ?? "", target.label)
            cache.set(key, p)
            setCard((c) => (c?.key === key ? { ...c, data: p } : c))
          })
          .catch((e) => {
            console.warn("Link preview failed", e)
            setCard((c) => (c?.key === key ? { ...c, data: { title: target.label, text: "Preview unavailable" } } : c))
          })
      }, cached && !always ? 0 : delay)
    }
    const hide = () => {
      clearTimeout(timer.current)
      current = null
      close()
    }

    const onOver = (e: MouseEvent) => {
      const hit = resolve(e.target as Element)
      if (!hit || hit.anchor === current) return
      current = hit.anchor
      show(hit.anchor, hit.target, SHOW_DELAY)
    }
    const onOut = (e: MouseEvent) => {
      if (!current || current.contains(e.relatedTarget as Node | null)) return
      current = null
      clearTimeout(timer.current)
      // the card stays while the pointer moves onto it (its onMouseEnter clears this timer)
      timer.current = setTimeout(close, HIDE_DELAY)
    }
    const onFocusIn = (e: FocusEvent) => {
      const hit = resolve(e.target as Element)
      // keyboard focus only: a sheet's autofocus after a tap or click must not pop a card
      if (!hit || !hit.anchor.matches(":focus-visible")) return
      const now = performance.now()
      const through = now - focusAt < TAB_THROUGH_MS
      focusAt = now
      current = hit.anchor
      show(hit.anchor, hit.target, through ? TAB_DELAY : 0, through)
    }
    // A scroll right after a focus is the browser bringing the link into view: follow it. Any other scroll hides the card.
    const onScroll = () => {
      const anchor = current
      if (!anchor || performance.now() - focusAt > FOCUS_SCROLL_MS) return hide()
      setCard((c) => (c?.anchor === anchor ? { ...c, ...measure(anchor) } : c))
    }
    container.addEventListener("mouseover", onOver)
    container.addEventListener("mouseout", onOut)
    container.addEventListener("focusin", onFocusIn)
    container.addEventListener("focusout", hide)
    window.addEventListener("scroll", onScroll, true)
    return () => {
      clearTimeout(timer.current)
      container.removeEventListener("mouseover", onOver)
      container.removeEventListener("mouseout", onOut)
      container.removeEventListener("focusin", onFocusIn)
      container.removeEventListener("focusout", hide)
      window.removeEventListener("scroll", onScroll, true)
    }
  }, [containerRef, resolve, rootParam, close])

  // while open: the anchor is described by the card, and Esc closes the card before any sheet/dialog sees it
  const anchor = card?.open ? card.anchor : undefined
  useEffect(() => {
    if (!anchor) return
    anchor.setAttribute("aria-describedby", id)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      e.preventDefault()
      e.stopPropagation()
      clearTimeout(timer.current)
      close()
    }
    window.addEventListener("keydown", onKey, true)
    return () => {
      anchor.removeAttribute("aria-describedby")
      window.removeEventListener("keydown", onKey, true)
    }
  }, [anchor, id, close])

  if (!card) return null
  const { target, rect, bounds, data, open } = card
  // In a column (Linked docs): to its left, top on the row, so it never covers the sibling rows. No room there (the
  // phone sheet): no wider than the column, on its left edge, above the row when it fits, else below. Elsewhere 320px
  // from the link, below it when it fits, kept on screen.
  const side = !!bounds && bounds.left - CARD_GAP - CARD_W >= CARD_GAP
  const below = bounds ? rect.top - CARD_H - 6 < CARD_GAP : rect.bottom + CARD_H < window.innerHeight
  const width = bounds && !side ? Math.min(CARD_W, bounds.width) : CARD_W
  const left = side ? bounds.left - CARD_GAP - CARD_W : Math.max(CARD_GAP, Math.min(bounds ? bounds.left : rect.left, window.innerWidth - width - CARD_GAP))
  const style = side
    ? { top: Math.max(CARD_GAP, Math.min(rect.top, window.innerHeight - CARD_H - CARD_GAP)), left, width }
    : below ? { top: rect.bottom + 6, left, width } : { bottom: window.innerHeight - rect.top + 6, left, width }
  const broken = "broken" in target
  const Icon = broken ? Unlink : KIND_ICON[target.kind as keyof typeof KIND_ICON] ?? KIND_ICON.doc
  const status = !broken && data?.status ? displayStatus(resolveStatus(data.status, statusDefs)) : null

  return createPortal(
    <div
      id={id}
      role="tooltip"
      style={style}
      onMouseEnter={() => clearTimeout(timer.current)}
      onMouseLeave={close}
      className={cn(
        "fixed z-[60] flex flex-col gap-1.5 rounded-lg border border-border bg-surface p-3 text-sm text-txt shadow-lg",
        // Filter/Sort popover vocabulary: fade + scale from 98% out of the anchor edge; the exit only fades
        side ? "origin-top-right" : below ? "origin-top-left" : "origin-bottom-left",
        "duration-(--duration-fast) ease-out-soft",
        open ? "transition-[opacity,scale,visibility] starting:scale-[0.98] starting:opacity-0" : "pointer-events-none invisible scale-[0.98] opacity-0 transition-[opacity,visibility]",
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Icon className="size-3.5 shrink-0 text-muted" aria-hidden />
        <span className="min-w-0 truncate font-medium">{broken ? "Not found" : data?.title ?? target.label}</span>
      </div>
      <span className="truncate font-mono text-[11px] text-muted">{broken ? target.broken : target.path}</span>
      {(status || (!broken && data?.owner)) && (
        <span className="flex items-center gap-2">
          {status && <StatusChip status={status} />}
          {!broken && <OwnerChip owner={data?.owner ?? null} />}
        </span>
      )}
      {!broken && (
        <p className="line-clamp-6 text-xs leading-relaxed text-muted">
          {!data ? "Loading…" : !data.text ? "Empty file" : data.text.split(/`([^`]+)`/).map((part, i) => (i % 2
            ? <code key={i} className="rounded-sm bg-surface2 px-1 font-mono text-[11px] text-txt">{part}</code>
            : part))}
        </p>
      )}
    </div>,
    document.body,
  )
}
