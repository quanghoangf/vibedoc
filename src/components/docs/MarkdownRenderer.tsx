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
    if (!containerRef.current) return
    const nodes = Array.from(
      containerRef.current.querySelectorAll(".mermaid:not([data-processed])")
    )
    if (nodes.length === 0) return
    import("mermaid").then((m) => {
      m.default.initialize({
        startOnLoad: false,
        theme: "dark",
        darkMode: true,
      })
      m.default.run({ nodes: nodes as HTMLElement[] })
    })
  }, [html])

  return (
    <div
      ref={containerRef}
      className={cn("prose-dark", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
