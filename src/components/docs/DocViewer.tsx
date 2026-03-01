"use client"

import type { SelectedDoc } from "@/types"
import { MarkdownRenderer } from "./MarkdownRenderer"

interface DocViewerProps {
  doc: SelectedDoc | null
}

export function DocViewer({ doc }: DocViewerProps) {
  if (!doc) {
    return (
      <div className="flex items-center justify-center h-full text-muted text-sm">
        Select a document to read
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
        <span className="text-xs font-mono text-muted">{doc.path}</span>
      </div>
      <MarkdownRenderer content={doc.content} />
    </div>
  )
}
