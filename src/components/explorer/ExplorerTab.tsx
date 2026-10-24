"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { FolderTree, TreePine, SquareStack, Flame, type LucideIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { FileTree } from "./FileTree"
import { FileTreemap } from "./FileTreemap"
import { FileDetail } from "./FileDetail"
import type { ExplorerFile } from "@/types"
import { useT } from "@/context/LanguageContext"
import type { MessageKey } from "@/i18n"
import { EmptyState } from "@/components/shared/EmptyState"

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

const VIEWS: { id: ViewMode; Icon: LucideIcon; label: MessageKey }[] = [
  { id: "tree", Icon: TreePine, label: "docs.viewTree" },
  { id: "treemap", Icon: SquareStack, label: "docs.viewTreemap" },
  { id: "heatmap", Icon: Flame, label: "docs.viewHeatmap" },
]

export function ExplorerTab({ files, loading, view, root, onEnriched, onOpenDoc }: ExplorerTabProps) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const { t } = useT()
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
      {/* Header row 1: wraps on phones, so the search keeps its width */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 border-b border-border shrink-0">
        <span className="font-display font-semibold text-txt text-sm shrink-0">{t("shell.explorer")}</span>
        <Input
          id="explorer-search"
          type="search"
          placeholder={t("docs.searchFiles")}
          aria-label={t("docs.searchFiles")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-7 min-w-48 flex-1 basis-48 text-xs"
        />
        <div className="flex flex-wrap items-center gap-1 max-md:w-full">
          <div role="group" aria-label={t("docs.view")} className="flex items-center rounded-md border border-border p-0.5">
            {VIEWS.map(({ id, Icon, label }) => (
              <button
                key={id}
                type="button"
                aria-pressed={view === id}
                onClick={() => setView(id)}
                className={cn(
                  "inline-flex h-6 items-center gap-1 rounded-sm px-2 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
                  view === id ? "bg-surface2 text-txt" : "text-muted hover:text-txt",
                )}
              >
                <Icon className="size-3" aria-hidden />
                {t(label)}
              </button>
            ))}
          </div>
          <select
            aria-label={t("docs.sortBy")}
            value={sort}
            onChange={e => setSort(e.target.value as SortMode)}
            className="h-7 min-w-0 rounded-md border border-border bg-bg px-2 text-xs text-txt hover:border-border2 focus-visible:outline-2 focus-visible:outline-accent"
          >
            <option value="name">{t("docs.sortName")}</option>
            <option value="mtime">{t("docs.sortModified")}</option>
            <option value="updated">{t("docs.sortDescribed")}</option>
          </select>
          <button
            type="button"
            aria-pressed={missingOnly}
            onClick={() => setMissingOnly(v => !v)}
            className={cn(
              "h-7 px-2 rounded-md text-xs transition-colors border outline-none focus-visible:ring-2 focus-visible:ring-accent",
              missingOnly
                ? "border-border2 bg-surface2 text-txt"
                : "border-border text-muted hover:border-border2 hover:text-txt"
            )}
          >
            {t("docs.noDesc")}
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
                  ? "bg-accent text-accent-fg"
                  : "bg-surface2 text-muted hover:text-txt"
              )}
            >
              {s === "all" ? t("docs.all") : <span data-user-content>{s}</span>}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-muted text-sm">
          {t("docs.loading")}
        </div>
      ) : files.length === 0 ? (
        <div className="flex-1 overflow-auto p-6">
          <EmptyState
            bordered
            icon={<FolderTree className="size-7" />}
            message={t("docs.explorerEmptyTitle")}
            lead={t("docs.explorerEmptyLead")}
            action={<Button asChild size="sm"><Link href="/setup">{t("docs.writeProjectDocs")}</Link></Button>}
          />
        </div>
      ) : view === "treemap" ? (
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          <div className="min-h-0 flex-1 overflow-hidden">
            <FileTreemap files={filteredFiles} onSelect={setSelectedPath} />
          </div>
          {selectedPath && selectedFile && (
            // phones: a section stacked under the map; md+: a side panel
            <div className="flex shrink-0 overflow-auto border-border max-md:max-h-[45svh] max-md:border-t md:w-80 md:border-l">
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
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* phones: one column, the list over the selected file */}
          <div className={cn("flex flex-col overflow-hidden border-border md:w-72 md:border-r", selectedFile ? "max-md:max-h-[45svh] max-md:border-b" : "max-md:flex-1")}>
            {filteredFiles.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-muted text-sm">
                {t("docs.noFilesMatch")}
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
          <div className={cn("flex min-h-0 flex-1 overflow-auto", !selectedFile && "max-md:hidden")}>
            <FileDetail
              file={selectedFile}
              root={root}
              onEnriched={onEnriched}
              onOpenDoc={onOpenDoc}
            />
          </div>
        </div>
      )}
    </div>
  )
}
