"use client"

import { useState, useEffect } from "react"
import { useApp } from "@/context/AppContext"
import { cn } from "@/lib/utils"
import type { SelectedDoc } from "@/types"
import { MarkdownRenderer } from "./MarkdownRenderer"

interface DocViewerProps {
  doc: SelectedDoc | null
  onDirtyChange?: (dirty: boolean) => void
}

export function DocViewer({ doc, onDirtyChange }: DocViewerProps) {
  const { rootParam, setSelectedDoc } = useApp()
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState("")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset edit state when selected doc changes
  useEffect(() => {
    setIsEditing(false)
    setEditContent("")
    setSaved(false)
    setError(null)
    onDirtyChange?.(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.path])

  function startEditing() {
    if (!doc) return
    setEditContent(doc.content)
    setIsEditing(true)
    setSaved(false)
    setError(null)
  }

  function handleContentChange(value: string) {
    setEditContent(value)
    onDirtyChange?.(value !== doc?.content)
  }

  function handleCancel() {
    setIsEditing(false)
    setEditContent("")
    setError(null)
    onDirtyChange?.(false)
  }

  async function handleSave() {
    if (!doc) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/docs${rootParam}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: doc.path, content: editContent }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Save failed")
      }
      setSelectedDoc({ ...doc, content: editContent })
      setIsEditing(false)
      setSaved(true)
      onDirtyChange?.(false)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  if (!doc) {
    return (
      <div className="flex items-center justify-center h-full text-muted text-sm">
        Select a document to read
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border flex-shrink-0">
        <span className="text-xs font-mono text-muted flex-1 truncate">{doc.path}</span>
        {saved && <span className="text-xs text-teal-400">Saved</span>}
        {error && <span className="text-xs text-red-400">{error}</span>}
        {isEditing ? (
          <>
            <button
              onClick={handleSave}
              disabled={saving}
              className={cn(
                "text-xs px-2.5 py-1 rounded border transition-colors",
                saving
                  ? "border-border text-muted cursor-not-allowed"
                  : "border-accent text-accent hover:bg-accent/10"
              )}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="text-xs px-2.5 py-1 rounded border border-border text-muted hover:text-txt hover:border-border2 transition-colors"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={startEditing}
            className="text-xs px-2.5 py-1 rounded border border-border text-muted hover:text-txt hover:border-border2 transition-colors"
          >
            Edit
          </button>
        )}
      </div>

      {/* Content */}
      {isEditing ? (
        <textarea
          className="flex-1 w-full p-6 bg-transparent font-mono text-sm text-txt leading-relaxed resize-none outline-none border-none"
          value={editContent}
          onChange={(e) => handleContentChange(e.target.value)}
          spellCheck={false}
          autoFocus
        />
      ) : (
        <div className="flex-1 overflow-y-auto p-6 max-w-3xl">
          <MarkdownRenderer content={doc.content} />
        </div>
      )}
    </div>
  )
}
