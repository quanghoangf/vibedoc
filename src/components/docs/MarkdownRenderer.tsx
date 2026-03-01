"use client"

import { marked } from "marked"
import { cn } from "@/lib/utils"

// Configure marked for GitHub Flavored Markdown
marked.setOptions({
  gfm: true,
  breaks: false,
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
  return (
    <div
      className={cn("prose-dark", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
