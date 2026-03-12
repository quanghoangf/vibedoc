"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Search, FilePlus, LayoutDashboard, Activity, Brain } from "lucide-react"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"

interface DocFile {
  path: string
  section: string
  name: string
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  onOpenDoc: (path: string) => void
  onNewDoc?: () => void
  rootParam: string
}

export function CommandPalette({ open, onClose, onOpenDoc, onNewDoc, rootParam }: CommandPaletteProps) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<DocFile[]>([])
  const [activeIndex, setActiveIndex] = useState(0)

  const QUICK_ACTIONS = [
    { label: "New Doc", icon: FilePlus, action: () => { onNewDoc?.(); onClose() } },
    { label: "Go to Board", icon: LayoutDashboard, action: () => { router.push("/board"); onClose() } },
    { label: "Go to Activity", icon: Activity, action: () => { router.push("/activity"); onClose() } },
    { label: "Go to Memory", icon: Brain, action: () => { router.push("/memory"); onClose() } },
  ]

  // Reset state when closing
  useEffect(() => {
    if (!open) {
      setQuery("")
      setResults([])
      setActiveIndex(0)
    }
  }, [open])

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      setActiveIndex(0)
      return
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/docs${rootParam}&q=${encodeURIComponent(query)}`)
        const data = await res.json()
        setResults(
          data.results?.map((r: { file: string }) => ({
            path: r.file,
            section: r.file.split("/").slice(0, -1).join("/"),
            name: r.file.split("/").pop()?.replace(/\.md$/, "") ?? r.file,
          })) ?? []
        )
        setActiveIndex(0)
      } catch {}
    }, 300)
    return () => clearTimeout(t)
  }, [query, rootParam])

  function handleSelect(doc: DocFile) {
    onOpenDoc(doc.path)
    onClose()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const showingResults = results.length > 0
    const listLength = showingResults ? results.length : QUICK_ACTIONS.length

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, listLength - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === "Enter") {
      if (showingResults && results[activeIndex]) {
        handleSelect(results[activeIndex])
      } else if (!showingResults && query.length < 2 && QUICK_ACTIONS[activeIndex]) {
        QUICK_ACTIONS[activeIndex].action()
      }
    }
  }

  const showQuickActions = query === ""

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-lg p-0 overflow-hidden bg-surface border-border gap-0">
        <DialogTitle className="sr-only">Command Palette</DialogTitle>
        <div className="flex items-center px-4 h-12">
          <Search className="h-4 w-4 text-muted shrink-0 mr-3" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search docs…"
            className="border-0 bg-transparent h-full text-sm shadow-none focus-visible:ring-0 px-0 placeholder:text-muted"
          />
        </div>
        <div className="border-t border-border" />
        <ScrollArea className="max-h-72">
          {showQuickActions && (
            <div className="py-1">
              {QUICK_ACTIONS.map((action, i) => (
                <button
                  key={action.label}
                  onClick={action.action}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={cn(
                    "flex items-center gap-3 w-full px-4 py-2 text-sm text-left transition-colors",
                    activeIndex === i ? "bg-accent/10 text-txt" : "text-muted hover:text-txt"
                  )}
                >
                  <action.icon className="h-4 w-4 shrink-0" />
                  {action.label}
                </button>
              ))}
            </div>
          )}
          {!showQuickActions && results.length > 0 && (
            <div className="py-1">
              {results.map((doc, i) => (
                <button
                  key={doc.path}
                  onClick={() => handleSelect(doc)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={cn(
                    "flex items-center justify-between w-full px-4 py-2 text-sm text-left transition-colors",
                    activeIndex === i ? "bg-accent/10" : "hover:bg-accent/5"
                  )}
                >
                  <span className="font-medium text-txt truncate">{doc.name}</span>
                  {doc.section && (
                    <span className="text-xs text-muted ml-3 shrink-0 truncate max-w-[40%]">{doc.section}</span>
                  )}
                </button>
              ))}
            </div>
          )}
          {!showQuickActions && query.length >= 2 && results.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-muted">No docs found</div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
