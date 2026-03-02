"use client"

import type { DocFile, SelectedDoc } from "@/types"
import { DocList } from "./DocList"
import { DocViewer } from "./DocViewer"

interface DocsTabProps {
  docs: DocFile[]
  selectedDoc: SelectedDoc | null
  docSearch: string
  onSearchChange: (value: string) => void
  onDocSelect: (path: string) => void
  onDirtyChange?: (dirty: boolean) => void
}

export function DocsTab({ docs, selectedDoc, docSearch, onSearchChange, onDocSelect, onDirtyChange }: DocsTabProps) {
  return (
    <div className="flex h-full" style={{ minHeight: "calc(100vh - 3rem)" }}>
      <DocList
        docs={docs}
        selectedDocPath={selectedDoc?.path}
        searchValue={docSearch}
        onSearchChange={onSearchChange}
        onDocClick={onDocSelect}
      />
      <div className="flex-1 overflow-y-auto">
        <DocViewer doc={selectedDoc} onDirtyChange={onDirtyChange} />
      </div>
    </div>
  )
}
