"use client"

import { useState, useCallback } from "react"
import { Link2, FileText } from "lucide-react"
import { cn } from "@/lib/utils"

interface Backlink {
  file: string
  line: number
  text: string
}

interface BacklinksPanelProps {
  docPath: string
  rootParam: string
  onOpenDoc: (path: string) => void
}

export function BacklinksPanel({ docPath, rootParam, onOpenDoc }: BacklinksPanelProps) {
  const [links, setLinks] = useState<Backlink[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [hasFetched, setHasFetched] = useState(false)

  const fetchBacklinks = useCallback(async () => {
    if (hasFetched) return
    setLoading(true)
    try {
      const res = await fetch(`/api/backlinks${rootParam}&path=${encodeURIComponent(docPath)}`)
      const data = await res.json()
      setLinks(data.links ?? [])
    } catch {
      setLinks([])
    } finally {
      setLoading(false)
      setHasFetched(true)
    }
  }, [docPath, rootParam, hasFetched])

  const handleMouseEnter = () => {
    if (!hasFetched) fetchBacklinks()
  }

  return (
    <div className="fixed right-4 bottom-8 z-40 group" onMouseEnter={handleMouseEnter}>
      {/* Hover trigger - small icon */}
      <div className="w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center group-hover:opacity-0 transition-opacity duration-200 shadow-sm">
        <Link2 className="h-4 w-4 text-muted" />
      </div>

      {/* Expanded panel on hover */}
      <div className={cn(
        "absolute right-0 bottom-0 w-72 max-h-[50vh] bg-surface/95 backdrop-blur-sm border border-border rounded-lg shadow-xl",
        "opacity-0 scale-95 origin-bottom-right pointer-events-none",
        "group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto",
        "transition-all duration-200 ease-out"
      )}>
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/50">
          <Link2 className="h-3.5 w-3.5 text-accent" />
          <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
            Referenced by
          </span>
          {links !== null && (
            <span className="text-[10px] text-muted/60 bg-accent/10 px-1.5 py-0.5 rounded-full ml-auto">
              {links.length}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(50vh-44px)]">
          {loading && (
            <div className="px-3 py-6 text-center">
              <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-muted/60 mt-2">Scanning docs...</p>
            </div>
          )}

          {!loading && links !== null && links.length === 0 && (
            <div className="px-3 py-6 text-center">
              <Link2 className="h-8 w-8 text-muted/30 mx-auto mb-2" />
              <p className="text-xs text-muted/60">No other docs link to this file</p>
            </div>
          )}

          {!loading && links !== null && links.length > 0 && (
            <div className="py-1">
              {links.map((link, i) => (
                <button
                  key={`${link.file}-${link.line}-${i}`}
                  onClick={() => onOpenDoc(link.file)}
                  className="w-full text-left px-3 py-2 hover:bg-accent/10 transition-colors group/item"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-muted shrink-0" />
                    <span className="text-sm font-medium text-txt truncate">
                      {link.file.split('/').pop()?.replace(/\.md$/, '')}
                    </span>
                    <span className="text-[10px] text-muted/50 shrink-0">
                      L{link.line}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted/70 mt-1 truncate pl-5">
                    {link.text}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
