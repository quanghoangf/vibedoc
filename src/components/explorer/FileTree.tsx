"use client"

import { useMemo, useState } from "react"
import { FileText, Folder, FolderOpen, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import type { ExplorerFile } from "@/types"

interface TreeNode {
  name: string
  children: TreeNode[]
  file?: ExplorerFile
  folderPath: string // full path for stable keys
}

function buildTree(files: ExplorerFile[]): TreeNode[] {
  const root: TreeNode = { name: "", children: [], folderPath: "" }
  for (const file of files) {
    const parts = file.path.replace(/\\/g, "/").split("/")
    let node = root
    let currentPath = ""
    for (let i = 0; i < parts.length - 1; i++) {
      currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i]
      let child = node.children.find((c) => c.name === parts[i] && !c.file)
      if (!child) {
        child = { name: parts[i], children: [], folderPath: currentPath }
        node.children.push(child)
      }
      node = child
    }
    node.children.push({ name: parts[parts.length - 1], children: [], file, folderPath: file.path })
  }
  return root.children
}

function getHeatmapClass(mtime: string): string {
  const daysDiff = (Date.now() - new Date(mtime).getTime()) / (1000 * 60 * 60 * 24)
  if (daysDiff <= 7) return "text-green-400"
  if (daysDiff <= 28) return "text-yellow-400/70"
  return "text-muted"
}

interface TreeNodeRowProps {
  node: TreeNode
  depth: number
  selectedPath: string | null
  onSelect: (path: string) => void
  heatmap: boolean
  defaultOpen?: boolean
}

function TreeNodeRow({ node, depth, selectedPath, onSelect, heatmap, defaultOpen = false }: TreeNodeRowProps) {
  const [open, setOpen] = useState(defaultOpen)
  const indent = depth * 12

  if (node.file) {
    const isSelected = node.file.path === selectedPath
    const colorClass = heatmap ? getHeatmapClass(node.file.mtime) : "text-muted"
    return (
      <button
        onClick={() => onSelect(node.file!.path)}
        className={cn(
          "w-full flex flex-col gap-0.5 px-2 py-1.5 text-left hover:bg-surface2 transition-colors rounded",
          isSelected && "bg-surface2 ring-1 ring-inset ring-accent/30"
        )}
        style={{ paddingLeft: indent + 8 }}
      >
        <div className="flex items-center gap-1.5">
          <FileText className={cn("w-3.5 h-3.5 flex-shrink-0", colorClass)} />
          <span className="text-xs text-txt truncate">{node.name}</span>
        </div>
        {node.file.description && (
          <p className="text-[10px] text-muted leading-tight truncate" style={{ paddingLeft: 20 }}>
            {node.file.description}
          </p>
        )}
      </button>
    )
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          className="w-full flex items-center gap-1.5 px-2 py-1 text-left hover:bg-surface2 transition-colors rounded"
          style={{ paddingLeft: indent + 8 }}
        >
          <ChevronRight
            className={cn("w-3 h-3 text-muted flex-shrink-0 transition-transform duration-200", open && "rotate-90")}
          />
          {open
            ? <FolderOpen className="w-3.5 h-3.5 text-accent flex-shrink-0" />
            : <Folder className="w-3.5 h-3.5 text-muted flex-shrink-0" />
          }
          <span className="text-xs text-txt font-medium">{node.name}</span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {node.children.map((child) => (
          <TreeNodeRow
            key={child.folderPath}
            node={child}
            depth={depth + 1}
            selectedPath={selectedPath}
            onSelect={onSelect}
            heatmap={heatmap}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}

interface FileTreeProps {
  files: ExplorerFile[]
  selectedPath: string | null
  onSelect: (path: string) => void
  heatmap: boolean
}

export function FileTree({ files, selectedPath, onSelect, heatmap }: FileTreeProps) {
  const tree = useMemo(() => buildTree(files), [files])

  return (
    <ScrollArea className="flex-1">
      <div className="p-2">
        {tree.map((node) => (
          <TreeNodeRow
            key={node.folderPath}
            node={node}
            depth={0}
            selectedPath={selectedPath}
            onSelect={onSelect}
            heatmap={heatmap}
            defaultOpen={true}
          />
        ))}
      </div>
    </ScrollArea>
  )
}
