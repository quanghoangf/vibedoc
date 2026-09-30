"use client"

import { useApp } from "@/context/AppContext"
import type { SelectedDoc } from "@/types"
import { MarkdownEditor } from "./MarkdownEditor"
import { BacklinksPanel } from "./BacklinksPanel"
import { DocActionsMenu, type DocActions } from "./DocActionsMenu"
import { useItemCommands } from "@/components/shared/item-commands"

interface DocViewerProps {
  doc: SelectedDoc | null
  onDirtyChange?: (dirty: boolean) => void
  onContentChange?: (content: string) => void
  docActions?: DocActions
}

export function DocViewer({ doc, onDirtyChange, onContentChange, docActions }: DocViewerProps) {
  const { rootParam, setSelectedDoc, openDoc, editorSettings } = useApp()
  const path = doc?.path ?? ""
  useItemCommands(doc && docActions ? path : null, docActions ? [
    { action: "edit", label: "Rename", run: () => docActions.rename(path) },
    { action: "duplicate", label: "Duplicate", run: () => docActions.duplicate(path) },
    { action: "chat", label: "Chat about this doc", run: () => docActions.chat(path) },
    { action: "remove", label: "Delete", run: () => docActions.remove(path) },
  ] : [])

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
        onContentChange={onContentChange}
        wordWrap={editorSettings.wordWrap}
        lineNumbers={editorSettings.lineNumbers}
        headerActions={docActions && <DocActionsMenu path={doc.path} actions={docActions} />}
      />
      <BacklinksPanel
        docPath={doc.path}
        rootParam={rootParam}
        onOpenDoc={openDoc}
      />
    </div>
  )
}
