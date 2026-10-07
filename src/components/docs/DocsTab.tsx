"use client"

import { useState, useEffect } from "react"
import type { DocFile, SelectedDoc } from "@/types"
import { DocList } from "./DocList"
import { DocViewer } from "./DocViewer"
import type { DocActions } from "./DocActionsMenu"
import { cn } from "@/lib/utils"
import { DOCS_LIST_KEY, TOGGLE_DOCS_LIST_EVENT } from "@/lib/shortcuts"
import { docNode } from "@/lib/doc-links"

// ponytail: module-level like DocList's width — survives page navigation, resets on reload (no localStorage)
let lastListCollapsed = false

interface DocsTabProps {
  docs: DocFile[]
  selectedDoc: SelectedDoc | null
  docSearch: string
  onSearchChange: (value: string) => void
  onDocSelect: (path: string) => void
  onDirtyChange?: (dirty: boolean) => void
  onNewDocClick?: () => void
  onDocDeleted?: (path: string) => void
  onDocRenamed?: (oldPath: string, newPath: string) => void
  rootParam?: string
  docActions?: DocActions
}

export function DocsTab({ docs, selectedDoc, docSearch, onSearchChange, onDocSelect, onDirtyChange, onNewDocClick, onDocDeleted, onDocRenamed, rootParam, docActions }: DocsTabProps) {
  const [liveContent, setLiveContent] = useState(selectedDoc?.content ?? "")
  useEffect(() => { setLiveContent(selectedDoc?.content ?? "") }, [selectedDoc?.path])
  const [listCollapsed, setListCollapsed] = useState(lastListCollapsed)

  useEffect(() => {
    const toggle = () => { lastListCollapsed = !lastListCollapsed; setListCollapsed(lastListCollapsed) }
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key === DOCS_LIST_KEY.key) { e.preventDefault(); toggle() }
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener(TOGGLE_DOCS_LIST_EVENT, toggle)
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener(TOGGLE_DOCS_LIST_EVENT, toggle) }
  }, [])
  // With no doc open the list is the page, so it never hides
  const hideList = listCollapsed && !!selectedDoc
  // An empty project: on phones the viewer's empty state (what fills Docs, New doc) is the page, not an empty list
  const noDocs = !selectedDoc && docs.length === 0 && !docSearch.trim()

  return (
    <div className="flex h-full relative" style={{ minHeight: "calc(100vh - 3rem)" }}>
      <DocList
        className={selectedDoc || noDocs ? "max-md:hidden" : undefined}
        collapsed={hideList}
        docs={docs}
        selectedDocPath={selectedDoc?.path}
        searchValue={docSearch}
        onSearchChange={onSearchChange}
        onDocClick={onDocSelect}
        onNewDocClick={onNewDocClick}
        rootParam={rootParam}
        docActions={docActions}
      />
      <div className={cn("flex-1 min-w-0 overflow-y-auto", !selectedDoc && !noDocs && "max-md:hidden")}>
        <DocViewer
          doc={selectedDoc}
          onDirtyChange={onDirtyChange}
          onContentChange={setLiveContent}
          docActions={docActions}
          content={liveContent}
          docCount={docSearch.trim() ? undefined : { files: docs.length, docs: docs.filter((d) => docNode(d.path, "").kind === "doc").length }}
          onNewDocClick={onNewDocClick}
          listCollapsed={hideList}
          onToggleList={() => window.dispatchEvent(new Event(TOGGLE_DOCS_LIST_EVENT))}
        />
      </div>
    </div>
  )
}
