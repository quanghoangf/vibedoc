"use client"

import { cn } from "@/lib/utils"
import type { DocFile } from "@/types"

function groupDocsBySection(docs: DocFile[]): [string, DocFile[]][] {
  const map: Record<string, DocFile[]> = {}
  for (const doc of docs) {
    if (!map[doc.section]) map[doc.section] = []
    map[doc.section].push(doc)
  }
  return Object.entries(map)
}

interface DocListProps {
  docs: DocFile[]
  selectedDocPath: string | undefined
  searchValue: string
  onSearchChange: (value: string) => void
  onDocClick: (path: string) => void
}

export function DocList({ docs, selectedDocPath, searchValue, onSearchChange, onDocClick }: DocListProps) {
  return (
    <div className="w-56 border-r border-border flex-shrink-0 flex flex-col">
      <div className="p-3 border-b border-border">
        <input
          id="doc-search"
          className="w-full bg-surface2 border border-border rounded-md px-2.5 py-1.5 text-xs font-mono text-txt placeholder:text-muted outline-none focus:border-accent transition-colors"
          placeholder="Search docs..."
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {groupDocsBySection(docs).map(([section, files]) => (
          <div key={section}>
            <div className="px-3 py-1.5 text-xs font-mono text-muted uppercase tracking-wider">
              {section}
            </div>
            {files.map((doc) => (
              <button
                key={doc.path}
                onClick={() => onDocClick(doc.path)}
                className={cn(
                  "w-full text-left px-3 py-1.5 text-xs hover:bg-surface2 transition-colors truncate",
                  selectedDocPath === doc.path
                    ? "text-accent bg-accent/5"
                    : "text-muted hover:text-txt",
                )}
              >
                {doc.name}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
