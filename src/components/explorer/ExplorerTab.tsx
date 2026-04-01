"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { TreePine, LayoutGrid, Flame, type LucideIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { FileTree } from "./FileTree"
import { FileCards } from "./FileCards"
import { FileDetail } from "./FileDetail"
import type { ExplorerFile } from "@/types"

type ViewMode = "tree" | "cards" | "heatmap"

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
  { id: "cards", Icon: LayoutGrid, label: "Cards" },
  { id: "heatmap", Icon: Flame, label: "Heatmap" },
]

export function ExplorerTab({ files, loading, view, root, onEnriched, onOpenDoc }: ExplorerTabProps) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [selectedPath, setSelectedPath] = useState<string | null>(null)

  const selectedFile = files.find((f) => f.path === selectedPath) ?? null

  const filteredFiles = search
    ? files.filter(
        (f) =>
          f.path.toLowerCase().includes(search.toLowerCase()) ||
          f.description.toLowerCase().includes(search.toLowerCase())
      )
    : files

  // Clear selection when the selected file is filtered out
  useEffect(() => {
    if (search && selectedFile === null && selectedPath !== null) {
      setSelectedPath(null)
    }
  }, [search, selectedFile, selectedPath])

  function setView(v: ViewMode) {
    router.push(`/explorer?view=${v}`)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
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
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-muted text-sm">
          Loading…
        </div>
      ) : view === "cards" ? (
        filteredFiles.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-muted text-sm">
            No files match your search
          </div>
        ) : (
          <FileCards
            files={filteredFiles}
            selectedPath={selectedPath}
            onSelect={setSelectedPath}
          />
        )
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
