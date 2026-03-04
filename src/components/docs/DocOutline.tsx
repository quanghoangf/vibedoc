"use client"

import { List } from "lucide-react"
import { cn } from "@/lib/utils"

interface Heading { level: number; text: string; anchor: string }

export function DocOutline({ headings }: { headings: Heading[] }) {
  function scrollTo(anchor: string) {
    document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <List className="h-3.5 w-3.5 text-muted" />
        <span className="text-[11px] font-medium text-muted uppercase tracking-wider">Outline</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {headings.length === 0 ? (
          <p className="px-3 py-4 text-xs text-muted">No headings</p>
        ) : (
          <div className="py-1">
            {headings.map((h, i) => (
              <button
                key={i}
                onClick={() => scrollTo(h.anchor)}
                className={cn(
                  "w-full text-left text-xs py-1 hover:text-txt transition-colors truncate",
                  h.level === 1 && "px-3 font-semibold text-txt",
                  h.level === 2 && "px-6 text-muted",
                  h.level === 3 && "px-9 text-muted/70",
                )}
              >
                {h.text}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
