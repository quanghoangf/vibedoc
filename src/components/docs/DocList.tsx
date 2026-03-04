"use client"

import { useMemo } from "react"
import { FileText, Folder, FolderOpen, ChevronRight, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import type { DocFile } from "@/types"

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

interface TreeNodeRowProps {
  node: TreeNode
  depth: number
  selectedPath: string | undefined
  onDocClick: (path: string) => void
  folderPath: string
}

function TreeNodeRow({ node, depth, selectedPath, onDocClick, folderPath }: TreeNodeRowProps) {
  const isFile = !!node.docPath
  const isActive = node.docPath === selectedPath
  const indent = depth * 12

  if (isFile) {
    return (
      <button
        onClick={() => onDocClick(node.docPath!)}
        style={{ paddingLeft: `${8 + indent}px` }}
        className={cn(
          "group w-full flex items-center gap-2 h-7 pr-2 rounded-md text-xs transition-colors",
          isActive
            ? "bg-accent/10 text-accent font-medium"
            : "text-muted hover:text-txt hover:bg-surface2",
        )}
      >
        <FileText className="h-3.5 w-3.5 shrink-0 opacity-50" />
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

interface DocListProps {
  docs: DocFile[]
  selectedDocPath: string | undefined
  searchValue: string
  onSearchChange: (value: string) => void
  onDocClick: (path: string) => void
}

export function DocList({ docs, selectedDocPath, searchValue, onSearchChange, onDocClick }: DocListProps) {
  const tree = useMemo(() => buildTree(docs), [docs])
  const isSearching = searchValue.trim().length > 0

  return (
    <aside className="w-56 flex flex-col border-r border-border flex-shrink-0 bg-sidebar">
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

      <ScrollArea className="flex-1">
        <div className="p-1.5 space-y-0.5">
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
        </div>
      </ScrollArea>
    </aside>
  )
}
