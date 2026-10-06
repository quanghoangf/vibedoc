"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import { fuzzyFilter } from "@/lib/fuzzy"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { DocFile } from "@/types"
import { useT } from "@/context/LanguageContext"

const MAX_RESULTS = 50

interface QuickOpenProps {
  open: boolean
  onClose: () => void
  onOpenDoc: (path: string) => void
  rootParam: string
}

/** Cmd+P — jump to a doc by fuzzy-matching its path (Cmd+K searches content). */
export function QuickOpen({ open, onClose, onOpenDoc, rootParam }: QuickOpenProps) {
  const [docs, setDocs] = useState<DocFile[]>([])
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const { t } = useT()

  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) { setQuery(""); setActiveIndex(0) }
  }

  // Refetch on every open so new/renamed docs show up
  useEffect(() => {
    if (!open) return
    fetch(`/api/docs${rootParam}`)
      .then((r) => r.json())
      .then((d) => setDocs(Array.isArray(d) ? d : []))
      .catch(() => setDocs([]))
  }, [open, rootParam])

  const matches = useMemo(() => fuzzyFilter(query, docs, (d) => d.path), [query, docs])
  const shown = matches.slice(0, MAX_RESULTS)

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" })
  }, [activeIndex])

  function select(doc: DocFile | undefined) {
    if (!doc) return
    onOpenDoc(doc.path)
    onClose()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || (e.ctrlKey && e.key === "n")) {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, shown.length - 1))
    } else if (e.key === "ArrowUp" || (e.ctrlKey && e.key === "p")) {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      select(shown[activeIndex])
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-xl p-0 overflow-hidden bg-surface border-border gap-0 top-[20%] translate-y-0">
        <DialogTitle className="sr-only">{t("help.goToFile")}</DialogTitle>
        <Input
          autoFocus
          role="combobox"
          aria-expanded={shown.length > 0}
          aria-controls="quick-open-list"
          aria-autocomplete="list"
          aria-activedescendant={shown[activeIndex] ? `quick-open-${activeIndex}` : undefined}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActiveIndex(0) }}
          onKeyDown={handleKeyDown}
          placeholder={t("help.goToFilePlaceholder")}
          className="h-11 rounded-none border-0 border-b border-border bg-transparent px-4 text-sm shadow-none focus-visible:ring-0 placeholder:text-muted"
        />
        <div ref={listRef} id="quick-open-list" role="listbox" aria-label={t("help.files")} className="max-h-80 overflow-y-auto py-1">
          {shown.map((doc, i) => {
            const slash = doc.path.lastIndexOf("/")
            return (
              <div
                key={doc.path}
                id={`quick-open-${i}`}
                data-index={i}
                role="option"
                aria-selected={activeIndex === i}
                onClick={() => select(doc)}
                onMouseMove={() => setActiveIndex(i)}
                className={cn(
                  "flex items-center gap-2.5 w-full px-4 py-1.5 text-left text-sm cursor-pointer transition-colors",
                  activeIndex === i ? "bg-accent/10 text-txt" : "text-muted",
                )}
              >
                <FileText aria-hidden className="h-3.5 w-3.5 shrink-0 opacity-60" />
                <span data-user-content className="truncate text-txt">{doc.path.slice(slash + 1)}</span>
                {slash > 0 && <span data-user-content className="truncate text-xs text-muted">{doc.path.slice(0, slash)}</span>}
              </div>
            )
          })}
          {shown.length === 0 && <div role="presentation" className="px-4 py-6 text-center text-sm text-muted">{t("help.noMatchingFiles")}</div>}
          {matches.length > MAX_RESULTS && (
            <div className="px-4 py-1.5 text-xs text-muted">{t("help.moreFiles", { n: matches.length - MAX_RESULTS })}</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
