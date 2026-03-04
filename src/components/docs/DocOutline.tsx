"use client"

import { List } from "lucide-react"
import { cn } from "@/lib/utils"

interface Heading { level: number; text: string; anchor: string }

interface DocOutlineProps {
  headings: Heading[]
}

export function DocOutline({ headings }: DocOutlineProps) {
  function scrollTo(anchor: string) {
    document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (headings.length === 0) return null

  return (
    <div className="fixed right-4 top-20 z-40 group">
      {/* Hover trigger - thin bar */}
      <div className="w-1 h-32 bg-muted/20 rounded-full group-hover:opacity-0 transition-opacity duration-200" />
      
      {/* Expanded panel on hover */}
      <div className={cn(
        "absolute right-0 top-0 w-56 max-h-[70vh] bg-surface/95 backdrop-blur-sm border border-border rounded-lg shadow-xl",
        "opacity-0 scale-95 origin-top-right pointer-events-none",
        "group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto",
        "transition-all duration-200 ease-out"
      )}>
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/50">
          <List className="h-3.5 w-3.5 text-accent" />
          <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
            Outline
          </span>
          <span className="text-[10px] text-muted/60 bg-accent/10 px-1.5 py-0.5 rounded-full ml-auto">
            {headings.length}
          </span>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(70vh-44px)] py-2">
          {headings.map((h, i) => (
            <button
              key={i}
              onClick={() => scrollTo(h.anchor)}
              className={cn(
                "w-full text-left text-[13px] py-1.5 px-3 hover:bg-accent/10 transition-colors truncate",
                h.level === 1 && "font-medium text-txt",
                h.level === 2 && "pl-5 text-muted hover:text-txt",
                h.level === 3 && "pl-7 text-muted/70 text-[12px] hover:text-muted",
              )}
            >
              {h.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
