"use client"

import { useApp } from "@/context/AppContext"
import type { SelectedDoc } from "@/types"
import { MarkdownEditor } from "./MarkdownEditor"

interface DocViewerProps {
  doc: SelectedDoc | null
  onDirtyChange?: (dirty: boolean) => void
}

export function DocViewer({ doc, onDirtyChange }: DocViewerProps) {
  const { rootParam, setSelectedDoc } = useApp()

  if (!doc) {
    return (
      <div className="flex items-center justify-center h-full text-muted text-sm">
        Select a document to read
      </div>
    )
  }

  async function handleSave(content: string) {
    const res = await fetch(`/api/docs${rootParam}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: doc!.path, content }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error ?? "Save failed")
    }
    setSelectedDoc({ ...doc!, content })
  }

  return (
    <div className="flex flex-col h-full">
      <MarkdownEditor
        docPath={doc.path}
        initialContent={doc.content}
        onSave={handleSave}
        onDirtyChange={onDirtyChange}
      />
    </div>
  )
}
