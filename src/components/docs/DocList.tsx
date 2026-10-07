"use client"

import { useMemo, useRef, useState, createContext, useContext } from "react"
import { FileText, Folder, FolderOpen, ChevronRight, ChevronsDownUp, ChevronsUpDown, Search, Bot, Plus, CheckSquare, Copy, Check, X, ListFilter } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { DocFile } from "@/types"
import { priorityRank, type Priority } from "@/lib/doc-priority"
import { DocActionsMenu, type DocActions } from "./DocActionsMenu"
import { PriorityBadge } from "@/components/shared/PriorityBadge"
import { isSpecPath } from "@/lib/specs"
import { useT } from "@/context/LanguageContext"
import type { MessageKey } from "@/i18n"
import { DocLintPanel } from "./DocLintPanel"

// ─── Selection context (scoped to DocList, not exported) ──────────────────────

const SelectionCtx = createContext<{
  active: boolean
  selected: Set<string>
  toggle: (path: string) => void
  actions: DocActions | null
  collapsed: Set<string>
  toggleFolder: (folderPath: string) => void
}>({ active: false, selected: new Set(), toggle: () => {}, actions: null, collapsed: new Set(), toggleFolder: () => {} })

// ─── Resizable width ──────────────────────────────────────────────────────────

const DEFAULT_WIDTH = 224
const MIN_WIDTH = 180
const MAX_WIDTH = 560
const KEYBOARD_STEP = 16
// ponytail: module-level, so width survives page navigation but resets on reload
// (no localStorage per project rules); persist via /api/settings if that matters.
let lastWidth = DEFAULT_WIDTH

const clampWidth = (w: number) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, w))

// ─── Tree helpers ─────────────────────────────────────────────────────────────

interface TreeNode {
  name: string
  children: TreeNode[]
  docPath?: string
  priority?: Priority | null
}

type DocOrder = "tree" | "priority"
/** "P1" = P1 and above; "set" = any priority */
type PriorityFilter = "all" | "P0" | "P1" | "P2" | "set"
// P1 / P2 are ranges ("P0 – P1"), the same in every language; the rest are message keys
const FILTER_LABELS: Record<PriorityFilter, MessageKey | string> = { all: "docs.filterAll", P0: "docs.filterP0", P1: "P0 – P1", P2: "P0 – P2", set: "docs.filterSet" }

function passesFilter(p: Priority | null | undefined, filter: PriorityFilter): boolean {
  if (filter === "all") return true
  if (filter === "set") return !!p
  return !!p && priorityRank(p) <= priorityRank(filter)
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/")
}

function buildTree(docs: DocFile[]): TreeNode[] {
  const root: TreeNode = { name: "", children: [] }
  for (const doc of docs) {
    const parts = normalizePath(doc.path).split("/")
    let node = root
    for (let i = 0; i < parts.length - 1; i++) {
      let child = node.children.find(c => c.name === parts[i] && !c.docPath)
      if (!child) {
        child = { name: parts[i], children: [] }
        node.children.push(child)
      }
      node = child
    }
    node.children.push({ name: doc.name, docPath: doc.path, priority: doc.priority, children: [] })
  }
  return root.children
}

function collectFolderPaths(nodes: TreeNode[], prefix = ""): string[] {
  return nodes.flatMap(n => {
    if (n.docPath) return []
    const path = prefix ? `${prefix}/${n.name}` : n.name
    return [path, ...collectFolderPaths(n.children, path)]
  })
}

/** "a/b/c.md" → ["a", "a/b"] — the folder paths that must be open to show the file. */
function ancestorFolders(docPath: string): string[] {
  const parts = normalizePath(docPath).split("/").slice(0, -1)
  return parts.map((_, i) => parts.slice(0, i + 1).join("/"))
}

/** "api-reference" → "Api Reference", "DOMAIN_MAP" → "Domain Map"; a short all-caps word in a mixed name (HLD, MCP) stays. */
function formatName(raw: string): string {
  const words = raw.replace(/^\d+-/, "").split(/[-_ ]+/)
  const shouty = words.length > 1 && words.every(w => w === w.toUpperCase())
  return words
    .map(w => !shouty && /^[A-Z0-9]{2,4}$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")
}

// ─── Tree node row ────────────────────────────────────────────────────────────

interface TreeNodeRowProps {
  node: TreeNode
  depth: number
  selectedPath: string | undefined
  onDocClick: (path: string) => void
  folderPath: string
}

function TreeNodeRow({ node, depth, selectedPath, onDocClick, folderPath }: TreeNodeRowProps) {
  const { active: selectMode, selected, toggle, actions, collapsed, toggleFolder } = useContext(SelectionCtx)
  const [menuOpen, setMenuOpen] = useState(false)
  const { t } = useT()
  const isFile = !!node.docPath
  const isActive = node.docPath === selectedPath
  const isChecked = node.docPath ? selected.has(node.docPath) : false
  const indent = depth * 12

  if (isFile) {
    return (
      <div
        onContextMenu={(e) => { if (!selectMode && actions) { e.preventDefault(); setMenuOpen(true) } }}
        className={cn(
          "group w-full flex items-center gap-2 h-7 pr-1 rounded-md text-xs transition-colors",
          isActive && !selectMode
            ? "bg-accent/10 text-accent font-medium"
            : isChecked
            ? "bg-accent/10 text-accent"
            : "text-muted hover:text-txt hover:bg-surface2",
        )}
      >
        <button
          onClick={() => selectMode ? toggle(node.docPath!) : onDocClick(node.docPath!)}
          style={{ paddingLeft: `${8 + indent}px` }}
          title={node.docPath}
          className="flex-1 flex items-center gap-2 h-full truncate"
        >
          {selectMode ? (
            <span className={cn(
              "h-3.5 w-3.5 shrink-0 rounded-sm border flex items-center justify-center transition-colors",
              isChecked ? "border-accent bg-accent/20" : "border-border",
            )}>
              {isChecked && <Check className="h-2.5 w-2.5 text-accent" />}
            </span>
          ) : (
            <FileText className="h-3.5 w-3.5 shrink-0 opacity-50" />
          )}
          <span data-user-content className="truncate">{formatName(node.name)}</span>
          {isSpecPath(node.docPath!) && (
            <span className="ml-auto inline-flex h-4 shrink-0 items-center rounded-sm border border-border px-1 text-[10px] leading-none text-muted">{t("docs.capabilitySpec")}</span>
          )}
          {node.priority && <PriorityBadge priority={node.priority} className={isSpecPath(node.docPath!) ? undefined : "ml-auto"} />}
        </button>
        {!selectMode && actions && (
          <DocActionsMenu
            path={node.docPath!}
            actions={actions}
            open={menuOpen}
            onOpenChange={setMenuOpen}
            className="size-5 rounded-sm opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
          />
        )}
      </div>
    )
  }

  return (
    <Collapsible open={!collapsed.has(folderPath)} onOpenChange={() => toggleFolder(folderPath)}>
      <CollapsibleTrigger asChild>
        <button
          style={{ paddingLeft: `${8 + indent}px` }}
          className="group/trigger w-full flex items-center gap-2 h-7 pr-2 rounded-md text-xs font-medium text-muted hover:text-txt hover:bg-surface2 transition-colors"
        >
          {/* Keyed off this trigger's own data-state: /folder would also match any open ancestor folder */}
          <ChevronRight className="h-3 w-3 shrink-0 transition-transform duration-200 group-data-[state=open]/trigger:rotate-90" />
          <Folder className="h-3.5 w-3.5 shrink-0 text-accent/70 group-data-[state=open]/trigger:hidden" />
          <FolderOpen className="h-3.5 w-3.5 shrink-0 text-accent/70 hidden group-data-[state=open]/trigger:block" />
          <span data-user-content className="truncate">{formatName(node.name)}</span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        {node.children.map(child => (
          <TreeNodeRow
            key={child.docPath ?? child.name}
            node={child}
            depth={depth + 1}
            selectedPath={selectedPath}
            onDocClick={onDocClick}
            folderPath={`${folderPath}/${child.name}`}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}

// ─── DocList ──────────────────────────────────────────────────────────────────

interface DocListProps {
  docs: DocFile[]
  selectedDocPath: string | undefined
  searchValue: string
  onSearchChange: (value: string) => void
  onDocClick: (path: string) => void
  onNewDocClick?: () => void
  rootParam?: string
  docActions?: DocActions
  className?: string
  /** Slid shut (⌘\); content stays mounted but inert */
  collapsed?: boolean
}

export function DocList({ docs, selectedDocPath, searchValue, onSearchChange, onDocClick, onNewDocClick, rootParam = "", docActions, className, collapsed: listCollapsed = false }: DocListProps) {
  const [selectMode, setSelectMode] = useState(false)
  const { t } = useT()
  const filterLabel = (f: PriorityFilter) => (FILTER_LABELS[f].startsWith("docs.") ? t(FILTER_LABELS[f] as MessageKey) : FILTER_LABELS[f])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [copyStatus, setCopyStatus] = useState<"idle" | "copying" | "copied">("idle")
  const [pendingNewPath, setPendingNewPath] = useState<string | null>(null)
  const [width, setWidth] = useState(lastWidth)
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [revealedPath, setRevealedPath] = useState(selectedDocPath)
  const [order, setOrder] = useState<DocOrder>("tree")
  const [filter, setFilter] = useState<PriorityFilter>("all")

  const agentConfigs = useMemo(() => docs.filter(d => {
    const p = normalizePath(d.path)
    return p === 'CLAUDE.md' || p === 'AGENTS.md' ||
           p.endsWith('/CLAUDE.md') || p.endsWith('/AGENTS.md')
  }), [docs])

  const nonAgentDocs = useMemo(() => docs.filter(d => {
    const p = normalizePath(d.path)
    return p !== 'CLAUDE.md' && p !== 'AGENTS.md' &&
           !p.endsWith('/CLAUDE.md') && !p.endsWith('/AGENTS.md')
  }), [docs])

  const shownDocs = useMemo(() => nonAgentDocs.filter(d => passesFilter(d.priority, filter)), [nonAgentDocs, filter])
  const tree = useMemo(() => buildTree(shownDocs), [shownDocs])
  const byPriority = useMemo<TreeNode[]>(() => [...shownDocs]
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || a.path.localeCompare(b.path))
    .map(d => ({ name: d.name, docPath: d.path, priority: d.priority, children: [] })),
  [shownDocs])
  const viewChanged = order !== "tree" || filter !== "all"
  const folderPaths = useMemo(() => collectFolderPaths(tree), [tree])
  const isSearching = searchValue.trim().length > 0
  const allCollapsed = folderPaths.length > 0 && folderPaths.every(p => collapsed.has(p))

  // Opening a doc (click, Cmd+P, Cmd+K) expands its folders once; adjusting state
  // during render instead of in an effect avoids a second paint.
  if (selectedDocPath !== revealedPath) {
    setRevealedPath(selectedDocPath)
    const ancestors = selectedDocPath ? ancestorFolders(selectedDocPath) : []
    if (ancestors.some(a => collapsed.has(a))) {
      setCollapsed(prev => {
        const next = new Set(prev)
        ancestors.forEach(a => next.delete(a))
        return next
      })
    }
  }

  function toggleFolder(folderPath: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(folderPath)) next.delete(folderPath)
      else next.add(folderPath)
      return next
    })
  }

  function resizeTo(w: number) {
    lastWidth = clampWidth(w)
    setWidth(lastWidth)
  }

  function toggle(path: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  function exitSelectMode() {
    setSelectMode(false)
    setSelected(new Set())
    setCopyStatus("idle")
  }

  async function handleCopyContext() {
    if (selected.size === 0) return
    setCopyStatus("copying")
    try {
      const res = await fetch(`/api/context${rootParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths: [...selected] }),
      })
      const { context } = await res.json()
      await navigator.clipboard.writeText(context)
      setCopyStatus("copied")
      setTimeout(() => setCopyStatus("idle"), 2000)
    } catch {
      setCopyStatus("idle")
    }
  }

  return (
    <SelectionCtx.Provider value={{ active: selectMode, selected, toggle, actions: docActions ?? null, collapsed, toggleFolder }}>
      <aside
        style={{ width: listCollapsed ? 0 : width }}
        inert={listCollapsed}
        aria-hidden={listCollapsed || undefined}
        className={cn(
          "relative flex flex-col border-r border-border shrink-0 bg-sidebar max-md:w-full! max-md:border-r-0",
          // no transition while dragging the edge, or the panel lags the pointer
          !dragging && "transition-[width,border-color] duration-(--duration-slow) ease-out-soft",
          listCollapsed && "border-transparent",
          className,
        )}
      >
        {/* Resize handle — drag, arrow keys, or double-click to reset */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={t("docs.resizePanel")}
          aria-valuenow={width}
          aria-valuemin={MIN_WIDTH}
          aria-valuemax={MAX_WIDTH}
          tabIndex={0}
          onPointerDown={(e) => {
            e.preventDefault()
            e.currentTarget.setPointerCapture(e.pointerId)
            dragRef.current = { startX: e.clientX, startWidth: width }
            setDragging(true)
          }}
          onPointerMove={(e) => {
            if (dragRef.current) resizeTo(dragRef.current.startWidth + e.clientX - dragRef.current.startX)
          }}
          onPointerUp={() => { dragRef.current = null; setDragging(false) }}
          onDoubleClick={() => resizeTo(DEFAULT_WIDTH)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") resizeTo(width - KEYBOARD_STEP)
            else if (e.key === "ArrowRight") resizeTo(width + KEYBOARD_STEP)
          }}
          className="absolute -right-1 top-0 z-10 h-full w-2 cursor-col-resize max-md:hidden after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:transition-colors hover:after:bg-accent/60 focus-visible:outline-none focus-visible:after:bg-accent active:after:bg-accent"
        />
        <div className={cn("min-h-0 flex-1 overflow-hidden transition-opacity duration-(--duration-base)", listCollapsed && "opacity-0")}>
        <div style={{ width }} className="flex h-full flex-col max-md:w-full!">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-muted">{t("shell.docs")}</span>
          <div className="flex items-center gap-1">
            {!selectMode && !isSearching && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      "h-5 w-5 flex items-center justify-center rounded-sm transition-colors",
                      viewChanged ? "bg-accent/20 text-accent" : "hover:bg-surface2 text-muted hover:text-accent",
                    )}
                    title={t("docs.sortFilterTitle")}
                    aria-label={viewChanged ? t("docs.sortFilterLabel", { order: order === "priority" ? t("docs.orderByPriority") : t("docs.orderFolders"), filter: filterLabel(filter) }) : t("docs.sortFilterTitle")}
                  >
                    <ListFilter className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuLabel className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-muted">{t("docs.order")}</DropdownMenuLabel>
                  <DropdownMenuRadioGroup value={order} onValueChange={(v) => setOrder(v as DocOrder)}>
                    <DropdownMenuRadioItem value="tree">{t("docs.folders")}</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="priority">{t("board.priority")}</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-muted">{t("board.show")}</DropdownMenuLabel>
                  <DropdownMenuRadioGroup value={filter} onValueChange={(v) => setFilter(v as PriorityFilter)}>
                    {(Object.keys(FILTER_LABELS) as PriorityFilter[]).map(f => (
                      <DropdownMenuRadioItem key={f} value={f}>{filterLabel(f)}</DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {!selectMode && !isSearching && order === "tree" && folderPaths.length > 0 && (
              <button
                onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(folderPaths))}
                className="h-5 w-5 flex items-center justify-center rounded-sm hover:bg-surface2 text-muted hover:text-accent transition-colors"
                title={allCollapsed ? t("docs.expandAll") : t("docs.collapseAll")}
                aria-label={allCollapsed ? t("docs.expandAll") : t("docs.collapseAll")}
              >
                {allCollapsed ? <ChevronsUpDown className="h-3.5 w-3.5" /> : <ChevronsDownUp className="h-3.5 w-3.5" />}
              </button>
            )}
            <button
              onClick={() => { if (selectMode) exitSelectMode(); else setSelectMode(true) }}
              className={cn(
                "h-5 w-5 flex items-center justify-center rounded-sm transition-colors",
                selectMode
                  ? "bg-accent/20 text-accent"
                  : "hover:bg-surface2 text-muted hover:text-accent",
              )}
              title={t("docs.selectDocs")}
              aria-label={t("docs.selectDocs")}
              aria-pressed={selectMode}
            >
              <CheckSquare className="h-3.5 w-3.5" />
            </button>
            {onNewDocClick && (
              <button
                onClick={onNewDocClick}
                className="h-5 w-5 flex items-center justify-center rounded-sm hover:bg-surface2 text-muted hover:text-accent transition-colors"
                title={t("docs.newDocument")}
                aria-label={t("docs.newDocument")}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {!selectMode && <DocLintPanel />}

        {/* Search (hidden in select mode) */}
        {!selectMode && (
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted pointer-events-none" />
              <Input
                id="doc-search"
                value={searchValue}
                onChange={e => onSearchChange(e.target.value)}
                placeholder={t("docs.searchDocs")}
                className="pl-7 h-8 text-xs bg-surface2 border-transparent focus:border-border"
              />
            </div>
          </div>
        )}

        {/* File list */}
        {/* Radix wraps content in a display:table div that grows with its widest row; block keeps rows to the panel width so they truncate */}
        <ScrollArea className="flex-1 [&_[data-radix-scroll-area-viewport]>div]:block!">
          <div className="p-1.5 space-y-0.5">
            {selectMode ? (
              // Flat list in select mode
              docs.map(doc => {
                const isChecked = selected.has(doc.path)
                return (
                  <button
                    key={doc.path}
                    onClick={() => toggle(doc.path)}
                    className={cn(
                      "w-full flex items-center gap-2 h-7 px-2 rounded-md text-xs transition-colors",
                      isChecked ? "bg-accent/10 text-accent" : "text-muted hover:text-txt hover:bg-surface2",
                    )}
                  >
                    <span className={cn(
                      "h-3.5 w-3.5 shrink-0 rounded-sm border flex items-center justify-center transition-colors",
                      isChecked ? "border-accent bg-accent/20" : "border-border",
                    )}>
                      {isChecked && <Check className="h-2.5 w-2.5 text-accent" />}
                    </span>
                    <span data-user-content className="truncate flex-1 text-left">{formatName(doc.name)}</span>
                    <span className="max-w-[45%] shrink-0 truncate font-mono text-[10px] text-muted">
                      {normalizePath(doc.path).split("/").slice(0, -1).join("/") || t("docs.root")}
                    </span>
                  </button>
                )
              })
            ) : (
              <>
                {!isSearching && agentConfigs.length > 0 && (
                  <div className="mb-2">
                    <div className="flex items-center gap-1.5 px-2 py-1">
                      <Bot className="h-3.5 w-3.5 text-muted shrink-0" aria-hidden />
                      <span className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-muted">{t("docs.agentConfig")}</span>
                    </div>
                    {agentConfigs.map(doc => (
                      <button
                        key={doc.path}
                        onClick={() => onDocClick(doc.path)}
                        className={cn(
                          "w-full flex items-center gap-2 h-7 px-2 rounded-md text-xs transition-colors",
                          doc.path === selectedDocPath
                            ? "bg-accent/10 text-accent font-medium"
                            : "text-muted hover:text-txt hover:bg-surface2",
                        )}
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0 opacity-50" />
                        <span data-user-content className="truncate">{doc.name}</span>
                      </button>
                    ))}
                    <div className="mt-2 border-t border-border" />
                  </div>
                )}
                {isSearching ? (
                  docs.length === 0 ? (
                    <p className="text-xs text-muted px-2 py-4 text-center">{t("docs.noResults")}</p>
                  ) : (
                    docs.map(doc => (
                      <button
                        key={doc.path}
                        onClick={() => onDocClick(doc.path)}
                        className={cn(
                          "w-full flex flex-col items-start gap-0.5 px-2 py-1.5 rounded-md text-xs transition-colors text-left",
                          doc.path === selectedDocPath
                            ? "bg-accent/10 text-accent"
                            : "text-muted hover:text-txt hover:bg-surface2",
                        )}
                      >
                        <span data-user-content className="font-medium truncate w-full">{formatName(doc.name)}</span>
                        <span className="w-full truncate font-mono text-[10px] text-muted">
                          {normalizePath(doc.path).split("/").slice(0, -1).join("/")}
                        </span>
                      </button>
                    ))
                  )
                ) : shownDocs.length === 0 && filter !== "all" ? (
                  <p className="text-xs text-muted px-2 py-4 text-center">
                    {t("docs.noDocsAtPriority")}{" "}
                    <button onClick={() => setFilter("all")} className="text-accent hover:underline">{t("docs.showAll")}</button>
                  </p>
                ) : order === "priority" ? (
                  byPriority.map(node => (
                    <TreeNodeRow key={node.docPath} node={node} depth={0} selectedPath={selectedDocPath} onDocClick={onDocClick} folderPath={node.name} />
                  ))
                ) : (
                  tree.map(node => (
                    <TreeNodeRow
                      key={node.docPath ?? node.name}
                      node={node}
                      depth={0}
                      selectedPath={selectedDocPath}
                      onDocClick={onDocClick}
                      folderPath={node.name}
                    />
                  ))
                )}
              </>
            )}
          </div>
        </ScrollArea>

        {/* Footer — shown when select mode is active */}
        {selectMode && (
          <div className="border-t border-border p-2 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-muted">
              <span>{t("docs.selectedCount", { n: selected.size })}</span>
              <button onClick={exitSelectMode} className="hover:text-txt transition-colors flex items-center gap-1">
                <X className="h-3 w-3" /> {t("docs.clear")}
              </button>
            </div>
            <button
              onClick={handleCopyContext}
              disabled={selected.size === 0 || copyStatus === "copying"}
              className={cn(
                "w-full flex items-center justify-center gap-1.5 h-7 rounded-md text-xs font-medium transition-colors",
                copyStatus === "copied"
                  ? "bg-teal/15 text-teal"
                  : selected.size === 0
                  ? "bg-surface2 text-muted cursor-not-allowed"
                  : "bg-accent/20 text-accent hover:bg-accent/30",
              )}
            >
              {copyStatus === "copied" ? (
                <><Check className="h-3 w-3" /> {t("docs.copied")}</>
              ) : (
                <><Copy className="h-3 w-3" /> {t("docs.copyContext")}</>
              )}
            </button>
          </div>
        )}
        </div>
        </div>
      </aside>
    </SelectionCtx.Provider>
  )
}
