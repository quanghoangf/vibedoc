"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { TreePine, SquareStack, Flame, type LucideIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { FileTree } from "./FileTree"
import { FileTreemap } from "./FileTreemap"
import { FileDetail } from "./FileDetail"
import type { ExplorerFile } from "@/types"

type ViewMode = "tree" | "treemap" | "heatmap"
type SortMode = "name" | "mtime" | "updated"

interface ExplorerTabProps {
  files: ExplorerFile[]
  loading: boolean
  view: ViewMode
  root: string
  onEnriched: (path: string, description: string) => void
  onOpenDoc: (path: string) => Promise<void>
}

const VIEWS: { id: ViewMode; Icon: LucideIcon; label: string }[] = [
  { id: "tree", Icon: TreePine, label: "Tree" },
  { id: "treemap", Icon: SquareStack, label: "Treemap" },
  { id: "heatmap", Icon: Flame, label: "Heatmap" },
]

export function ExplorerTab({ files, loading, view, root, onEnriched, onOpenDoc }: ExplorerTabProps) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<string>("all")
  const [sort, setSort] = useState<SortMode>("name")
  const [missingOnly, setMissingOnly] = useState(false)

  const selectedFile = files.find((f) => f.path === selectedPath) ?? null

  const sections = useMemo(
    () => ["all", ...[...new Set(files.map(f => f.section))].sort()],
    [files]
  )

  const filteredFiles = useMemo(() => {
    let result = files

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        f => f.path.toLowerCase().includes(q) || f.description.toLowerCase().includes(q)
      )
    }

    if (activeSection !== "all") {
      result = result.filter(f => f.section === activeSection)
    }

    if (missingOnly) {
      result = result.filter(f => !f.description.trim())
    }

    return [...result].sort((a, b) => {
      if (sort === "mtime") return b.mtime.localeCompare(a.mtime)
      if (sort === "updated") return b.updatedAt.localeCompare(a.updatedAt)
      return a.path.localeCompare(b.path)
    })
  }, [files, search, activeSection, missingOnly, sort])

  // Clear selection when the selected file is filtered out
  useEffect(() => {
    if (selectedPath !== null && !filteredFiles.find(f => f.path === selectedPath)) {
      setSelectedPath(null)
    }
  }, [filteredFiles, selectedPath])

  // Reset section filter when search changes
  useEffect(() => {
    setActiveSection("all")
  }, [search])

  function setView(v: ViewMode) {
    router.push(`/explorer?view=${v}`)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header row 1 */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <span className="font-display font-semibold text-txt text-sm shrink-0">Explorer</span>
        <Input
          id="explorer-search"
          placeholder="Search files and descriptions…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 h-7 text-xs"
        />
        <div className="flex items-center gap-1 shrink-0">
          {VIEWS.map(({ id, Icon, label }) => (
            <Button
              key={id}
              variant={view === id ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs gap-1"
              onClick={() => setView(id)}
            >
              <Icon className="w-3 h-3" />
              {label}
            </Button>
          ))}
          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortMode)}
            className="h-7 px-2 text-xs bg-surface2 border border-border rounded text-txt focus:outline-none focus:border-accent ml-1"
          >
            <option value="name">Name</option>
            <option value="mtime">Modified</option>
            <option value="updated">Described</option>
          </select>
          <button
            onClick={() => setMissingOnly(v => !v)}
            className={cn(
              "h-7 px-2 rounded text-xs transition-colors border ml-1",
              missingOnly
                ? "bg-amber/20 text-amber border-amber/40"
                : "bg-surface2 text-muted border-border hover:text-txt"
            )}
          >
            No desc
          </button>
        </div>
      </div>

      {/* Header row 2: section pills */}
      {sections.length > 2 && (
        <div className="flex items-center gap-1 px-4 py-2 border-b border-border overflow-x-auto shrink-0">
          {sections.map(s => (
            <button
              key={s}
              onClick={() => setActiveSection(s)}
              className={cn(
                "px-2.5 py-0.5 rounded-full text-xs whitespace-nowrap transition-colors",
                activeSection === s
                  ? "bg-accent text-white"
                  : "bg-surface2 text-muted hover:text-txt"
              )}
            >
              {s === "all" ? "All" : s}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-muted text-sm">
          Loading…
        </div>
      ) : view === "treemap" ? (
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <FileTreemap files={filteredFiles} onSelect={setSelectedPath} />
          </div>
          {selectedPath && selectedFile && (
            <div className="w-80 border-l border-border shrink-0">
              <FileDetail
                file={selectedFile}
                root={root}
                onEnriched={onEnriched}
                onOpenDoc={onOpenDoc}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          <div className="w-72 border-r border-border flex flex-col overflow-hidden">
            {filteredFiles.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-muted text-sm">
                No files match your search
              </div>
            ) : (
              <FileTree
                files={filteredFiles}
                selectedPath={selectedPath}
                onSelect={setSelectedPath}
                heatmap={view === "heatmap"}
              />
            )}
          </div>
          <FileDetail
            file={selectedFile}
            root={root}
            onEnriched={onEnriched}
            onOpenDoc={onOpenDoc}
          />
        </div>
      )}
    </div>
  )
}
