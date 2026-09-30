"use client"

import { memo, useEffect, useRef } from "react"
import { marked } from "marked"
import { cn } from "@/lib/utils"

// Configure marked for GitHub Flavored Markdown
marked.setOptions({
  gfm: true,
  breaks: false,
})

// Intercept mermaid code blocks — emit a div instead of <pre><code>
marked.use({
  renderer: {
    code({ text: code, lang }) {
      if (lang === "mermaid") {
        // HTML-escape so the raw source sits safely as text in the div.
        // The browser decodes entities back when mermaid reads textContent.
        const escaped = code
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
        return `<div class="mermaid not-prose">${escaped}</div>`
      }
      return false // default renderer handles all other code blocks
    },
  },
})

// Inject id attributes on h1-h6 headings for outline scroll-to
marked.use({
  renderer: {
    heading({ tokens, depth: level }) {
      const text = this.parser.parseInline(tokens)
      // Strip HTML tags before building the anchor slug
      const anchor = text
        .replace(/<[^>]*>/g, "")
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
      return `<h${level} id="${anchor}">${text}</h${level}>\n`
    }
  }
})

function sanitize(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
}

interface MarkdownRendererProps {
  content: string
  className?: string
  /** ms timestamp of the last agent edit; top-level blocks that change within HIGHLIGHT_WINDOW of it get marked */
  highlightSince?: number
}

// The agent's edit lands a moment after its SSE event (span apply or a fetch of the whole file)
const HIGHLIGHT_WINDOW = 3000

export const MarkdownRenderer = memo(function MarkdownRenderer({ content, className, highlightSince = 0 }: MarkdownRendererProps) {
  const html = sanitize(marked.parse(content) as string)
  const containerRef = useRef<HTMLDivElement>(null)
  const prevBlocksRef = useRef<string[] | null>(null)

  // Mark blocks that weren't in the previous render (multiset match, so moved or duplicated blocks don't count).
  // Runs before mermaid replaces its divs, so both renders are compared as raw markup.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const blocks = Array.from(container.children)
    const sigs = blocks.map((b) => b.outerHTML)
    const prev = prevBlocksRef.current
    prevBlocksRef.current = sigs
    if (!prev || Date.now() - highlightSince > HIGHLIGHT_WINDOW) return
    const pool = new Map<string, number>()
    for (const s of prev) pool.set(s, (pool.get(s) ?? 0) + 1)
    blocks.forEach((b, i) => {
      const left = pool.get(sigs[i]) ?? 0
      if (left > 0) pool.set(sigs[i], left - 1)
      else b.classList.add("doc-block-changed")
    })
  }, [html, highlightSince])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let cancelled = false

    // Debounce so rapid keystrokes (live preview) don't thrash mermaid
    const timer = setTimeout(() => {
      if (cancelled) return
      import("mermaid").then((m) => {
        if (cancelled || !container.isConnected) return
        // Query AFTER the async import resolves — gets current DOM, not stale snapshot
        const nodes = Array.from(
          container.querySelectorAll<HTMLElement>(".mermaid:not([data-processed])")
        )
        if (nodes.length === 0) return
        const dark = document.documentElement.classList.contains("dark")
        m.default.initialize({ startOnLoad: false, theme: dark ? "dark" : "neutral", darkMode: dark, securityLevel: "antiscript" })
        // Do NOT suppress errors — suppressing causes mermaid to silently revert
        // the diagram element back to showing raw source text on parse failure.
        m.default.run({ nodes }).catch((e) => { console.error("[mermaid]", e) })
      })
    }, 120)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [html])

  return (
    <div
      ref={containerRef}
      className={cn("prose-dark", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
})
