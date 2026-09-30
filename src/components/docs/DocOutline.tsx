"use client"

import { List } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface Heading { level: number; text: string; anchor: string }

interface DocOutlineProps {
  headings: Heading[]
}

/** Doc bar button: hover or keyboard focus opens the heading list below it. */
export function DocOutline({ headings }: DocOutlineProps) {
  function scrollTo(anchor: string) {
    document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (headings.length === 0) return null

  return (
    <nav aria-label="Outline" className="group relative">
      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted hover:text-txt" aria-label={`Outline, ${headings.length} headings`}>
        <List className="h-3.5 w-3.5" aria-hidden />
      </Button>

      {/* pt-1 instead of a margin keeps the hover path from the button into the panel unbroken */}
      <div className={cn(
        "absolute right-0 top-full z-40 w-64 pt-1",
        "opacity-0 scale-95 origin-top-right pointer-events-none",
        "group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto",
        "group-focus-within:opacity-100 group-focus-within:scale-100 group-focus-within:pointer-events-auto",
        "transition-[opacity,scale] duration-(--duration-base) ease-out-soft"
      )}>
        <div className="rounded-lg border border-border bg-surface shadow-xl shadow-black/20">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
            <span className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-muted">Outline</span>
            <span className="ml-auto font-mono text-[10px] text-muted">{headings.length}</span>
          </div>
          <div className="overflow-y-auto max-h-[60vh] py-1.5">
            {headings.map((h, i) => (
              <button
                key={i}
                onClick={() => scrollTo(h.anchor)}
                className={cn(
                  "w-full text-left text-[13px] py-1.5 px-3 hover:bg-surface2 focus-visible:bg-surface2 focus-visible:outline-none transition-colors truncate",
                  h.level === 1 && "font-medium text-txt",
                  h.level === 2 && "pl-5 text-muted hover:text-txt",
                  h.level === 3 && "pl-7 text-muted text-[11px] hover:text-txt",
                )}
              >
                {h.text}
              </button>
            ))}
          </div>
        </div>
      </div>
    </nav>
  )
}
