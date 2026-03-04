"use client"

import { useMemo, useState, createContext, useContext } from "react"
import { FileText, Folder, FolderOpen, ChevronRight, Search, Bot, Plus, CheckSquare, Copy, Check, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import type { DocFile } from "@/types"

// ─── Selection context (scoped to DocList, not exported) ──────────────────────

const SelectionCtx = createContext<{
  active: boolean
  selected: Set<string>
  toggle: (path: string) => void
}>({ active: false, selected: new Set(), toggle: () => {} })

// ─── Tree helpers ─────────────────────────────────────────────────────────────

interface TreeNode {
  name: string
  children: TreeNode[]
  docPath?: string
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
    node.children.push({ name: doc.name, docPath: doc.path, children: [] })
  }
  return root.children
}

function formatName(raw: string): string {
  return raw
    .replace(/^\d+-/, "")
    .replace(/[-_]/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase())
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
  const { active: selectMode, selected, toggle } = useContext(SelectionCtx)
  const isFile = !!node.docPath
  const isActive = node.docPath === selectedPath
  const isChecked = node.docPath ? selected.has(node.docPath) : false
  const indent = depth * 12

  if (isFile) {
    return (
      <button
        onClick={() => selectMode ? toggle(node.docPath!) : onDocClick(node.docPath!)}
        style={{ paddingLeft: `${8 + indent}px` }}
        className={cn(
          "group w-full flex items-center gap-2 h-7 pr-2 rounded-md text-xs transition-colors",
          isActive && !selectMode
            ? "bg-accent/10 text-accent font-medium"
            : isChecked
            ? "bg-accent/10 text-accent"
            : "text-muted hover:text-txt hover:bg-surface2",
        )}
      >
        {selectMode ? (
          <span className={cn(
            "h-3.5 w-3.5 shrink-0 rounded border flex items-center justify-center transition-colors",
            isChecked ? "border-accent bg-accent/20" : "border-border",
          )}>
            {isChecked && <Check className="h-2.5 w-2.5 text-accent" />}
          </span>
        ) : (
          <FileText className="h-3.5 w-3.5 shrink-0 opacity-50" />
        )}
        <span className="truncate">{formatName(node.name)}</span>
      </button>
    )
  }

  return (
    <Collapsible defaultOpen className="group/folder">
      <CollapsibleTrigger asChild>
        <button
          style={{ paddingLeft: `${8 + indent}px` }}
          className="w-full flex items-center gap-2 h-7 pr-2 rounded-md text-xs font-medium text-muted hover:text-txt hover:bg-surface2 transition-colors"
        >
          <ChevronRight className="h-3 w-3 shrink-0 transition-transform duration-200 group-data-[state=open]/folder:rotate-90" />
          <Folder className="h-3.5 w-3.5 shrink-0 text-accent/70 group-data-[state=open]/folder:hidden" />
          <FolderOpen className="h-3.5 w-3.5 shrink-0 text-accent/70 hidden group-data-[state=open]/folder:block" />
          <span className="truncate">{formatName(node.name)}</span>
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
}

export function DocList({ docs, selectedDocPath, searchValue, onSearchChange, onDocClick, onNewDocClick, rootParam = "" }: DocListProps) {
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [copyStatus, setCopyStatus] = useState<"idle" | "copying" | "copied">("idle")

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

  const tree = useMemo(() => buildTree(nonAgentDocs), [nonAgentDocs])
  const isSearching = searchValue.trim().length > 0

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
    <SelectionCtx.Provider value={{ active: selectMode, selected, toggle }}>
      <aside className="w-56 flex flex-col border-r border-border flex-shrink-0 bg-sidebar">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">Docs</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { if (selectMode) exitSelectMode(); else setSelectMode(true) }}
              className={cn(
                "h-5 w-5 flex items-center justify-center rounded transition-colors",
                selectMode
                  ? "bg-accent/20 text-accent"
                  : "hover:bg-surface2 text-muted hover:text-accent",
              )}
              title="Select docs"
            >
              <CheckSquare className="h-3.5 w-3.5" />
            </button>
            {onNewDocClick && (
              <button
                onClick={onNewDocClick}
                className="h-5 w-5 flex items-center justify-center rounded hover:bg-surface2 text-muted hover:text-accent transition-colors"
                title="New document"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Search (hidden in select mode) */}
        {!selectMode && (
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted pointer-events-none" />
              <Input
                id="doc-search"
                value={searchValue}
                onChange={e => onSearchChange(e.target.value)}
                placeholder="Search docs..."
                className="pl-7 h-8 text-xs bg-surface2 border-transparent focus:border-border"
              />
            </div>
          </div>
        )}

        {/* File list */}
        <ScrollArea className="flex-1">
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
                      "h-3.5 w-3.5 shrink-0 rounded border flex items-center justify-center transition-colors",
                      isChecked ? "border-accent bg-accent/20" : "border-border",
                    )}>
                      {isChecked && <Check className="h-2.5 w-2.5 text-accent" />}
                    </span>
                    <span className="truncate flex-1 text-left">{doc.name}</span>
                    <span className="text-[10px] opacity-40 truncate max-w-[60px]">
                      {normalizePath(doc.path).split("/").slice(0, -1).join("/") || "root"}
                    </span>
                  </button>
                )
              })
            ) : (
              <>
                {!isSearching && agentConfigs.length > 0 && (
                  <div className="mb-2">
                    <div className="flex items-center gap-1.5 px-2 py-1">
                      <Bot className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                      <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">Agent Config</span>
                      <span className="ml-auto text-[9px] font-medium bg-amber-400/15 text-amber-400 px-1.5 py-0.5 rounded-full">AI</span>
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
                        <span className="truncate">{doc.name}</span>
                      </button>
                    ))}
                    <div className="mt-2 border-t border-border" />
                  </div>
                )}
                {isSearching ? (
                  docs.length === 0 ? (
                    <p className="text-xs text-muted px-2 py-4 text-center">No results</p>
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
                        <span className="font-medium truncate w-full">{formatName(doc.name)}</span>
                        <span className="text-[10px] opacity-50 truncate w-full">
                          {normalizePath(doc.path).split("/").slice(0, -1).join("/")}
                        </span>
                      </button>
                    ))
                  )
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
              <span>{selected.size} selected</span>
              <button onClick={exitSelectMode} className="hover:text-txt transition-colors flex items-center gap-1">
                <X className="h-3 w-3" /> Clear
              </button>
            </div>
            <button
              onClick={handleCopyContext}
              disabled={selected.size === 0 || copyStatus === "copying"}
              className={cn(
                "w-full flex items-center justify-center gap-1.5 h-7 rounded-md text-xs font-medium transition-colors",
                copyStatus === "copied"
                  ? "bg-green-500/20 text-green-400"
                  : selected.size === 0
                  ? "bg-surface2 text-muted cursor-not-allowed"
                  : "bg-accent/20 text-accent hover:bg-accent/30",
              )}
            >
              {copyStatus === "copied" ? (
                <><Check className="h-3 w-3" /> Copied!</>
              ) : (
                <><Copy className="h-3 w-3" /> Copy Context</>
              )}
            </button>
          </div>
        )}
      </aside>
    </SelectionCtx.Provider>
  )
}
