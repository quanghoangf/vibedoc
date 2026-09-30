"use client"

import { useState, useCallback } from "react"
import { Link2, FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

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
    <div className="group relative" onMouseEnter={handleMouseEnter} onFocus={handleMouseEnter}>
      {/* Doc bar button — hover or keyboard focus opens the list below it */}
      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted hover:text-txt" aria-label="Referenced by">
        <Link2 className="h-3.5 w-3.5" aria-hidden />
      </Button>

      {/* before: bridges the 4px gap so the hover path from the button into the panel stays unbroken */}
      <div className={cn(
        "absolute right-0 top-full z-40 mt-1 w-72 max-h-[50vh] bg-surface border border-border rounded-lg shadow-xl shadow-black/20",
        "before:absolute before:inset-x-0 before:-top-1.5 before:h-1.5",
        "opacity-0 scale-95 origin-top-right pointer-events-none",
        "group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto",
        "group-focus-within:opacity-100 group-focus-within:scale-100 group-focus-within:pointer-events-auto",
        "transition-[opacity,scale] duration-(--duration-base) ease-out-soft"
      )}>
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-muted">
            Referenced by
          </span>
          {links !== null && (
            <span className="ml-auto font-mono text-[10px] text-muted">
              {links.length}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(50vh-44px)]">
          {loading && (
            <div className="px-3 py-6 text-center">
              <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-muted mt-2">Scanning docs…</p>
            </div>
          )}

          {!loading && links !== null && links.length === 0 && (
            <div className="px-3 py-6 text-center">
              <p className="text-xs text-muted">No other docs link to this file</p>
            </div>
          )}

          {!loading && links !== null && links.length > 0 && (
            <div className="py-1">
              {links.map((link, i) => (
                <button
                  key={`${link.file}-${link.line}-${i}`}
                  onClick={() => onOpenDoc(link.file)}
                  className="w-full text-left px-3 py-2 hover:bg-surface2 focus-visible:bg-surface2 focus-visible:outline-none transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-muted shrink-0" />
                    <span className="text-sm font-medium text-txt truncate">
                      {link.file.split('/').pop()?.replace(/\.md$/, '')}
                    </span>
                    <span className="font-mono text-[10px] text-muted shrink-0">
                      L{link.line}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted mt-1 truncate pl-5">
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
