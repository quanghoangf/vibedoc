"use client"

import { useEffect, useRef } from "react"
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
    code(code: string, lang: string | undefined) {
      if (lang === "mermaid") {
        const escaped = code
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
        return `<div class="mermaid">${escaped}</div>`
      }
      return false // default renderer handles all other code blocks
    },
  },
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
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const html = sanitize(marked.parse(content) as string)
  const containerRef = useRef<HTMLDivElement>(null)

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
        m.default.initialize({ startOnLoad: false, theme: "dark", darkMode: true })
        m.default.run({ nodes }).catch(() => {/* mermaid parse errors are non-fatal */})
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
}
