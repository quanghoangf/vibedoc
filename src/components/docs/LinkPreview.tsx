"use client"

import { useEffect, useRef, useState, type RefObject } from "react"
import { createPortal } from "react-dom"
import { Unlink } from "lucide-react"
import { useApp } from "@/context/AppContext"
import { KIND_ICON } from "@/components/memory/EntryRelated"
import { stripFrontmatter } from "@/lib/doc-priority"
import { LINK_EVENTS } from "./useDocLinks"

/** What a hovered link points at: a resolved file, or a broken raw target. */
export type PreviewTarget = { path: string; kind: string; label: string } | { broken: string }
type Preview = { title: string; text: string; status?: string; owner?: string }
type Card = { key: string; target: PreviewTarget; rect: DOMRect; data: Preview | null }

const SHOW_DELAY = 350
const HIDE_DELAY = 150
const CARD_W = 320
const CARD_H = 220
const MAX_TEXT = 400

/** Session cache of fetched previews, keyed by root + path; any file change (LINK_EVENTS) clears it. */
const cache = new Map<string, Preview>()

const meta = (raw: string, key: string) => new RegExp(`^\\*\\*${key}:\\*\\*\\s*(.+)$`, "m").exec(raw)?.[1].trim()

/** Title, owner/status meta and the opening ~400 chars as plain text. A rough strip, not a render. */
function toPreview(raw: string, fallbackTitle: string): Preview {
  const body = stripFrontmatter(raw)
  const h1 = /^#\s+(.+)$/m.exec(body)?.[1].trim()
  const text = body
    .replace(/^#\s+.+$/m, "")
    .replace(/^\*\*[^*\n]+:\*\*.*$/gm, "") // task/epic meta lines
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => b ?? a)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/^\s*(?:#{1,6}|>|[-*+]|\d+\.|\|)\s*/gm, "")
    .replace(/[*_`|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
  return {
    title: h1 ?? fallbackTitle,
    text: text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT).trimEnd()}…` : text,
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
  const [card, setCard] = useState<Card | null>(null)
  // pending show/hide; shared with the card so hovering it cancels the hide
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

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

    const show = (anchor: Element, target: PreviewTarget, delay: number) => {
      const key = "broken" in target ? `!${target.broken}` : `${rootParam}|${target.path}`
      const cached = cache.get(key) ?? null
      clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        if (current !== anchor) return
        setCard({ key, target, rect: anchor.getBoundingClientRect(), data: cached })
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
      }, cached ? 0 : delay)
    }
    const hide = () => {
      clearTimeout(timer.current)
      current = null
      setCard(null)
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
      timer.current = setTimeout(() => setCard(null), HIDE_DELAY)
    }
    const onFocusIn = (e: FocusEvent) => {
      const hit = resolve(e.target as Element)
      if (!hit) return
      current = hit.anchor
      show(hit.anchor, hit.target, 0)
    }
    container.addEventListener("mouseover", onOver)
    container.addEventListener("mouseout", onOut)
    container.addEventListener("focusin", onFocusIn)
    container.addEventListener("focusout", hide)
    window.addEventListener("scroll", hide, true)
    return () => {
      clearTimeout(timer.current)
      container.removeEventListener("mouseover", onOver)
      container.removeEventListener("mouseout", onOut)
      container.removeEventListener("focusin", onFocusIn)
      container.removeEventListener("focusout", hide)
      window.removeEventListener("scroll", hide, true)
    }
  }, [containerRef, resolve, rootParam])

  if (!card) return null
  const { target, rect, data } = card
  const below = rect.bottom + CARD_H < window.innerHeight
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - CARD_W - 8))
  const style = below ? { top: rect.bottom + 6, left, width: CARD_W } : { bottom: window.innerHeight - rect.top + 6, left, width: CARD_W }
  const broken = "broken" in target
  const Icon = broken ? Unlink : KIND_ICON[target.kind as keyof typeof KIND_ICON] ?? KIND_ICON.doc

  return createPortal(
    <div
      role="tooltip"
      style={style}
      onMouseEnter={() => clearTimeout(timer.current)}
      onMouseLeave={() => setCard(null)}
      className="fixed z-[60] flex flex-col gap-1.5 rounded-lg border border-border bg-surface p-3 text-sm text-txt shadow-lg"
    >
      <div className="flex min-w-0 items-center gap-2">
        <Icon className="size-3.5 shrink-0 text-muted" aria-hidden />
        <span className="min-w-0 truncate font-medium">{broken ? "Not found" : data?.title ?? target.label}</span>
      </div>
      <span className="truncate font-mono text-[11px] text-muted">{broken ? target.broken : target.path}</span>
      {!broken && (data?.status || data?.owner) && (
        <span className="text-xs text-muted">{[data.status, data.owner && `Owner: ${data.owner}`].filter(Boolean).join(" · ")}</span>
      )}
      {!broken && <p className="line-clamp-6 text-xs leading-relaxed text-muted">{data ? data.text || "Empty file" : "Loading…"}</p>}
    </div>,
    document.body,
  )
}
