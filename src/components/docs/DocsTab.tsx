"use client"

import { useState, useEffect, useMemo } from "react"
import type { DocFile, SelectedDoc } from "@/types"
import { extractHeadings } from "@/lib/headings"
import { DocList } from "./DocList"
import { DocViewer } from "./DocViewer"
import { DocOutline } from "./DocOutline"

interface DocsTabProps {
  docs: DocFile[]
  selectedDoc: SelectedDoc | null
  docSearch: string
  onSearchChange: (value: string) => void
  onDocSelect: (path: string) => void
  onDirtyChange?: (dirty: boolean) => void
  onNewDocClick?: () => void
  rootParam?: string
}

export function DocsTab({ docs, selectedDoc, docSearch, onSearchChange, onDocSelect, onDirtyChange, onNewDocClick, rootParam }: DocsTabProps) {
  const [liveContent, setLiveContent] = useState(selectedDoc?.content ?? "")
  useEffect(() => { setLiveContent(selectedDoc?.content ?? "") }, [selectedDoc?.path])
  const headings = useMemo(() => extractHeadings(liveContent), [liveContent])

  return (
    <div className="flex h-full" style={{ minHeight: "calc(100vh - 3rem)" }}>
      <DocList
        docs={docs}
        selectedDocPath={selectedDoc?.path}
        searchValue={docSearch}
        onSearchChange={onSearchChange}
        onDocClick={onDocSelect}
        onNewDocClick={onNewDocClick}
        rootParam={rootParam}
      />
      <div className="flex-1 overflow-y-auto">
        <DocViewer doc={selectedDoc} onDirtyChange={onDirtyChange} onContentChange={setLiveContent} />
      </div>
      {selectedDoc && (
        <div className="w-48 shrink-0 border-l border-border flex flex-col overflow-hidden">
          <DocOutline headings={headings} />
        </div>
      )}
    </div>
  )
}
