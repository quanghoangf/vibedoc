"use client"

import { useMemo } from "react"
import { FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import type { ExplorerFile } from "@/types"

const SOURCE_LABEL: Record<ExplorerFile['source'], string> = { ai: 'AI', extracted: 'Auto' }
const SOURCE_VARIANT: Record<ExplorerFile['source'], 'default' | 'secondary'> = { ai: 'default', extracted: 'secondary' }

interface FileCardsProps {
  files: ExplorerFile[]
  selectedPath: string | null
  onSelect: (path: string) => void
}

export function FileCards({ files, selectedPath, onSelect }: FileCardsProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, ExplorerFile[]>()
    for (const f of files) {
      const section = f.section || "root"
      const existing = map.get(section) ?? []
      existing.push(f)
      map.set(section, existing)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [files])

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-6">
        {grouped.map(([section, sectionFiles]) => (
          <div key={section}>
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2 px-1">
              {section}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {sectionFiles.map((file) => (
                <button
                  key={file.path}
                  onClick={() => onSelect(file.path)}
                  className={cn(
                    "flex flex-col gap-1.5 p-3 rounded-lg border border-border text-left",
                    "hover:border-accent/50 hover:bg-surface2 transition-all",
                    selectedPath === file.path && "border-accent/50 bg-surface2"
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                    <span className="text-xs font-medium text-txt truncate flex-1">{file.name}</span>
                    <Badge variant={SOURCE_VARIANT[file.source]} className="text-[10px] px-1 py-0 h-4 flex-shrink-0">
                      {SOURCE_LABEL[file.source]}
                    </Badge>
                  </div>
                  {file.description ? (
                    <p className="text-[10px] text-muted leading-relaxed line-clamp-2">
                      {file.description}
                    </p>
                  ) : (
                    <p className="text-[10px] text-muted italic">No description</p>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}
