# File Explorer Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dedicated `/explorer` page in VibeDoc with 3 switchable views (Tree, Cards, Heatmap) that shows all `.md` files with AI-generated descriptions, plus a `vibedoc_get_file_map` MCP tool.

**Architecture:** New `ExplorerFile` type extends `DocFile` with `description`, `source`, `updatedAt`, and `mtime`. Descriptions are cached in `.vibedoc-descriptions.json`. Three new core functions (`readDescriptions`, `writeDescriptions`, `listExplorerFiles`) plus `enrichDescription` (calls Claude Haiku) live exclusively in `core.ts`. The UI is a 4-component system: `ExplorerTab` (shell + view switcher) → `FileTree` / `FileCards` + `FileDetail`.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, `@anthropic-ai/sdk` (new dep), existing shadcn UI components (`Button`, `Input`, `Badge`, `ScrollArea`, `Collapsible`)

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/lib/core.ts` | Add `ExplorerFile`, `DescriptionCache` types + 5 new functions |
| Modify | `src/types/index.ts` | Re-export `ExplorerFile`, `DescriptionCache` |
| Create | `src/app/api/explorer/route.ts` | GET (list files+descriptions) + POST (enrich one file) |
| Modify | `src/app/api/docs/route.ts` | Auto-enrich on POST (fire-and-forget) |
| Modify | `src/app/api/mcp/route.ts` | Add `vibedoc_get_file_map` tool |
| Create | `src/components/explorer/FileDetail.tsx` | Right panel: path, description, badges, buttons |
| Create | `src/components/explorer/FileTree.tsx` | Collapsible tree with optional heatmap colouring |
| Create | `src/components/explorer/FileCards.tsx` | Grid of cards grouped by section |
| Create | `src/components/explorer/ExplorerTab.tsx` | Layout shell + view switcher |
| Create | `src/app/(app)/explorer/page.tsx` | Page: fetches data, owns local state |
| Modify | `src/components/layout/AppSidebar.tsx` | Add Explorer nav item |
| Modify | `src/app/(app)/layout.tsx` | Add `e` keyboard shortcut |

---

## Task 1: Install @anthropic-ai/sdk

**Files:**
- Modify: `package.json` (via pnpm)

- [ ] **Step 1: Install the package**

```bash
cd /mnt/f/hoang/nextjs/vibedoc && pnpm add @anthropic-ai/sdk
```

Expected: package added to `dependencies` in `package.json` and `pnpm-lock.yaml` updated.

- [ ] **Step 2: Commit**

```bash
cd /mnt/f/hoang/nextjs/vibedoc && git add package.json pnpm-lock.yaml && git commit -m "feat: add @anthropic-ai/sdk for file description enrichment"
```

---

## Task 2: Add ExplorerFile types to core.ts and types/index.ts

**Files:**
- Modify: `src/lib/core.ts` (after `DocFile` interface, around line 38)
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add types to core.ts**

In `src/lib/core.ts`, after the `DocFile` interface (after line 38), add:

```typescript
export interface DescriptionCache {
  [path: string]: {
    description: string
    source: 'extracted' | 'ai'
    updatedAt: string
  }
}

export interface ExplorerFile {
  path: string
  name: string
  section: string
  description: string
  source: 'extracted' | 'ai'
  updatedAt: string
  mtime: string
}
```

- [ ] **Step 2: Re-export from src/types/index.ts**

In `src/types/index.ts`, change the first export line from:
```typescript
export type { Task, TaskBoard, TaskStatus, DocFile, ActivityEvent, Project } from "@/lib/core"
```
to:
```typescript
export type { Task, TaskBoard, TaskStatus, DocFile, ActivityEvent, Project, ExplorerFile, DescriptionCache } from "@/lib/core"
```

- [ ] **Step 3: Verify build**

```bash
cd /mnt/f/hoang/nextjs/vibedoc && pnpm run build 2>&1 | tail -5
```
Expected: build passes (or only pre-existing errors, none related to `ExplorerFile`).

- [ ] **Step 4: Commit**

```bash
cd /mnt/f/hoang/nextjs/vibedoc && git add src/lib/core.ts src/types/index.ts && git commit -m "feat: add ExplorerFile and DescriptionCache types"
```

---

## Task 3: Add description cache functions to core.ts

**Files:**
- Modify: `src/lib/core.ts` (add after the `ACTIVITY_FILE` constant block, around line 449)

- [ ] **Step 1: Add the three synchronous/async cache helpers**

In `src/lib/core.ts`, after the line `const ACTIVITY_FILE = '.vibedoc-activity.json'` (line 449), add:

```typescript
// ─── Description cache ────────────────────────────────────────────────────────

const DESCRIPTIONS_FILE = '.vibedoc-descriptions.json'

export async function readDescriptions(root: string): Promise<DescriptionCache> {
  try {
    const raw = await fs.readFile(path.join(root, DESCRIPTIONS_FILE), 'utf8')
    return JSON.parse(raw) as DescriptionCache
  } catch {
    return {}
  }
}

export async function writeDescriptions(root: string, cache: DescriptionCache): Promise<void> {
  await fs.writeFile(path.join(root, DESCRIPTIONS_FILE), JSON.stringify(cache, null, 2), 'utf8')
}

export function extractDescription(content: string): string {
  const lines = content.split('\n')
  for (const line of lines) {
    const m = line.match(/^#{1,3}\s+(.+)/)
    if (m) return m[1].trim().slice(0, 120)
  }
  for (const line of lines) {
    const t = line.trim()
    if (t && !t.startsWith('#') && !t.startsWith('```') && !t.startsWith('|') && !t.startsWith('-')) {
      return t.slice(0, 120)
    }
  }
  return ''
}
```

- [ ] **Step 2: Verify build**

```bash
cd /mnt/f/hoang/nextjs/vibedoc && pnpm run build 2>&1 | tail -5
```
Expected: build passes.

- [ ] **Step 3: Commit**

```bash
cd /mnt/f/hoang/nextjs/vibedoc && git add src/lib/core.ts && git commit -m "feat: add description cache helpers to core.ts"
```

---

## Task 4: Add enrichDescription and listExplorerFiles to core.ts

**Files:**
- Modify: `src/lib/core.ts` (add after the cache helpers from Task 3)

- [ ] **Step 1: Add enrichDescription**

In `src/lib/core.ts`, directly after `extractDescription`, add:

```typescript
export async function enrichDescription(filePath: string, root: string): Promise<string> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const fullPath = path.join(root, filePath)
  const content = await fs.readFile(fullPath, 'utf8')

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 100,
    messages: [{
      role: 'user',
      content: `Write a single sentence (max 120 characters) describing what this file is about. Output ONLY the sentence, nothing else.\n\n${content.slice(0, 2000)}`,
    }],
  })

  const block = message.content[0] as { type: string; text: string }
  const description = block.text.trim().slice(0, 120)

  const cache = await readDescriptions(root)
  cache[filePath] = { description, source: 'ai', updatedAt: new Date().toISOString() }
  await writeDescriptions(root, cache)

  return description
}

export async function listExplorerFiles(root: string): Promise<ExplorerFile[]> {
  const docs = await listDocs(root)
  const cache = await readDescriptions(root)

  return Promise.all(docs.map(async (doc) => {
    const cached = cache[doc.path]
    let description = cached?.description ?? ''
    const source: 'extracted' | 'ai' = cached?.source ?? 'extracted'
    const updatedAt = cached?.updatedAt ?? new Date().toISOString()

    if (!cached) {
      try {
        const content = await fs.readFile(path.join(root, doc.path), 'utf8')
        description = extractDescription(content)
      } catch { /* ignore */ }
    }

    let mtime = new Date().toISOString()
    try {
      const stat = await fs.stat(path.join(root, doc.path))
      mtime = stat.mtime.toISOString()
    } catch { /* ignore */ }

    return { path: doc.path, name: doc.name, section: doc.section, description, source, updatedAt, mtime }
  }))
}
```

- [ ] **Step 2: Verify build**

```bash
cd /mnt/f/hoang/nextjs/vibedoc && pnpm run build 2>&1 | tail -5
```
Expected: build passes.

- [ ] **Step 3: Commit**

```bash
cd /mnt/f/hoang/nextjs/vibedoc && git add src/lib/core.ts && git commit -m "feat: add enrichDescription and listExplorerFiles to core.ts"
```

---

## Task 5: Create /api/explorer route

**Files:**
- Create: `src/app/api/explorer/route.ts`

- [ ] **Step 1: Create the route file**

Create `src/app/api/explorer/route.ts` with this content:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getConfiguredRoot, listExplorerFiles, enrichDescription } from '@/lib/core'

export async function GET(req: NextRequest) {
  try {
    const root = req.nextUrl.searchParams.get('root') || getConfiguredRoot()
    const files = await listExplorerFiles(root)
    return NextResponse.json(files)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 501 })
  }
  try {
    const body = await req.json()
    const root = (body.root as string) || getConfiguredRoot()
    const filePath = body.path as string
    if (!filePath) return NextResponse.json({ error: 'path is required' }, { status: 400 })
    const description = await enrichDescription(filePath, root)
    return NextResponse.json({ description, source: 'ai' })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify build**

```bash
cd /mnt/f/hoang/nextjs/vibedoc && pnpm run build 2>&1 | tail -5
```
Expected: build passes.

- [ ] **Step 3: Commit**

```bash
cd /mnt/f/hoang/nextjs/vibedoc && git add src/app/api/explorer/route.ts && git commit -m "feat: add /api/explorer route (GET list + POST enrich)"
```

---

## Task 6: Auto-enrich on doc creation

**Files:**
- Modify: `src/app/api/docs/route.ts`

- [ ] **Step 1: Add enrichDescription import**

In `src/app/api/docs/route.ts`, change the import line (line 2) from:
```typescript
import { listDocs, readDoc, searchDocs, writeDoc, createDoc, renameDoc, deleteDoc, getConfiguredRoot } from '@/lib/core'
```
to:
```typescript
import { listDocs, readDoc, searchDocs, writeDoc, createDoc, renameDoc, deleteDoc, getConfiguredRoot, enrichDescription } from '@/lib/core'
```

- [ ] **Step 2: Fire-and-forget enrichment after doc creation**

In `src/app/api/docs/route.ts`, in the `POST` handler, after the `emitUpdate('doc_created', ...)` call (line 39), add:

```typescript
    // Fire-and-forget: enrich description asynchronously (doesn't block response)
    if (process.env.ANTHROPIC_API_KEY) {
      enrichDescription(docPath, root).catch(() => { /* ignore enrichment failures */ })
    }
```

The full POST handler should look like:
```typescript
export async function POST(req: NextRequest) {
  try {
    const root = req.nextUrl.searchParams.get('root') || getConfiguredRoot()
    const { path: docPath, content } = await req.json()
    await createDoc(docPath, content, root)
    emitUpdate('doc_created', { path: docPath })
    // Fire-and-forget: enrich description asynchronously (doesn't block response)
    if (process.env.ANTHROPIC_API_KEY) {
      enrichDescription(docPath, root).catch(() => { /* ignore enrichment failures */ })
    }
    return NextResponse.json({ ok: true, path: docPath }, { status: 201 })
  } catch (e) {
    const nodeErr = e as NodeJS.ErrnoException
    if (nodeErr.code === 'EEXIST') return NextResponse.json({ error: 'File already exists' }, { status: 409 })
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
```

- [ ] **Step 3: Verify build**

```bash
cd /mnt/f/hoang/nextjs/vibedoc && pnpm run build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
cd /mnt/f/hoang/nextjs/vibedoc && git add src/app/api/docs/route.ts && git commit -m "feat: auto-enrich description when doc is created"
```

---

## Task 7: Add vibedoc_get_file_map MCP tool

**Files:**
- Modify: `src/app/api/mcp/route.ts`

- [ ] **Step 1: Add listExplorerFiles to the import**

In `src/app/api/mcp/route.ts`, add `listExplorerFiles` to the core import (line 18):
```typescript
import {
  getConfiguredRoot, listDocs, readDoc, searchDocs, writeDoc, createDoc, getContext,
  getProjectSummary, listTasks, getTask, updateTaskStatus,
  logDecision, readMemory, updateMemory, logSessionStart,
  findBacklinks, appendDoc, renameDoc, deleteDoc,
  TaskStatus, listExplorerFiles,
} from '@/lib/core'
```

- [ ] **Step 2: Add tool definition to TOOLS array**

In `src/app/api/mcp/route.ts`, add this entry to the `TOOLS` array just before the closing `]` (after line 203):

```typescript
  {
    name: 'vibedoc_get_file_map',
    description: 'Get a structured map of all documentation files with descriptions and last-modified dates. Use at session start to orient yourself without reading each file individually.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
```

- [ ] **Step 3: Add case to handleTool switch**

In `src/app/api/mcp/route.ts`, in the `handleTool` switch (after the last `case` block before the closing `}`), add:

```typescript
    case 'vibedoc_get_file_map': {
      const files = await listExplorerFiles(root)
      return JSON.stringify(files, null, 2)
    }
```

- [ ] **Step 4: Verify build**

```bash
cd /mnt/f/hoang/nextjs/vibedoc && pnpm run build 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
cd /mnt/f/hoang/nextjs/vibedoc && git add src/app/api/mcp/route.ts && git commit -m "feat: add vibedoc_get_file_map MCP tool"
```

---

## Task 8: Create FileDetail component

**Files:**
- Create: `src/components/explorer/FileDetail.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/explorer/FileDetail.tsx`:

```typescript
"use client"

import { useState } from "react"
import { FileText, RefreshCw, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { ExplorerFile } from "@/types"

interface FileDetailProps {
  file: ExplorerFile | null
  root: string
  onEnriched: (path: string, description: string) => void
  onOpenDoc: (path: string) => Promise<void>
}

export function FileDetail({ file, root, onEnriched, onOpenDoc }: FileDetailProps) {
  const [enriching, setEnriching] = useState(false)
  const [flashGreen, setFlashGreen] = useState(false)

  if (!file) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Select a file to see details
      </div>
    )
  }

  const parts = file.path.split("/")

  async function handleEnrich() {
    setEnriching(true)
    try {
      const res = await fetch("/api/explorer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: file!.path, ...(root ? { root } : {}) }),
      })
      const data = await res.json()
      if (res.ok) {
        onEnriched(file!.path, data.description)
        setFlashGreen(true)
        setTimeout(() => setFlashGreen(false), 1500)
      }
    } finally {
      setEnriching(false)
    }
  }

  return (
    <div className="flex-1 p-6 flex flex-col gap-4 overflow-auto">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
        <FileText className="w-3.5 h-3.5 flex-shrink-0" />
        {parts.map((part, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-muted">/</span>}
            <span className={i === parts.length - 1 ? "text-txt font-medium" : ""}>
              {part}
            </span>
          </span>
        ))}
      </div>

      <p className={`text-sm leading-relaxed transition-colors duration-500 ${flashGreen ? "text-green-400" : "text-txt"}`}>
        {file.description || (
          <span className="text-muted-foreground italic">
            No description yet — click Re-enrich to generate one
          </span>
        )}
      </p>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant={file.source === "ai" ? "default" : "secondary"} className="text-[10px]">
          {file.source === "ai" ? "AI" : "Auto"}
        </Badge>
        <span>Updated {new Date(file.updatedAt).toLocaleDateString()}</span>
        <span className="ml-auto">Modified {new Date(file.mtime).toLocaleDateString()}</span>
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={handleEnrich} disabled={enriching}>
          <RefreshCw className={`w-3 h-3 mr-1.5 ${enriching ? "animate-spin" : ""}`} />
          Re-enrich
        </Button>
        <Button variant="outline" size="sm" onClick={() => onOpenDoc(file.path)}>
          <ExternalLink className="w-3 h-3 mr-1.5" />
          Open in Docs
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd /mnt/f/hoang/nextjs/vibedoc && pnpm run build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
cd /mnt/f/hoang/nextjs/vibedoc && git add src/components/explorer/FileDetail.tsx && git commit -m "feat: add FileDetail component for explorer"
```

---

## Task 9: Create FileTree component

**Files:**
- Create: `src/components/explorer/FileTree.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/explorer/FileTree.tsx`:

```typescript
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
}

function buildTree(files: ExplorerFile[]): TreeNode[] {
  const root: TreeNode = { name: "", children: [] }
  for (const file of files) {
    const parts = file.path.replace(/\\/g, "/").split("/")
    let node = root
    for (let i = 0; i < parts.length - 1; i++) {
      let child = node.children.find((c) => c.name === parts[i] && !c.file)
      if (!child) {
        child = { name: parts[i], children: [] }
        node.children.push(child)
      }
      node = child
    }
    node.children.push({ name: parts[parts.length - 1], children: [], file })
  }
  return root.children
}

function getHeatmapClass(mtime: string): string {
  const daysDiff = (Date.now() - new Date(mtime).getTime()) / (1000 * 60 * 60 * 24)
  if (daysDiff <= 7) return "text-green-400"
  if (daysDiff <= 28) return "text-yellow-400/70"
  return "text-muted-foreground"
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
    const colorClass = heatmap ? getHeatmapClass(node.file.mtime) : "text-muted-foreground"
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
        {node.children.map((child, i) => (
          <TreeNodeRow
            key={`${child.name}-${i}`}
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
        {tree.map((node, i) => (
          <TreeNodeRow
            key={`${node.name}-${i}`}
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
```

- [ ] **Step 2: Verify build**

```bash
cd /mnt/f/hoang/nextjs/vibedoc && pnpm run build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
cd /mnt/f/hoang/nextjs/vibedoc && git add src/components/explorer/FileTree.tsx && git commit -m "feat: add FileTree component with heatmap mode"
```

---

## Task 10: Create FileCards component

**Files:**
- Create: `src/components/explorer/FileCards.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/explorer/FileCards.tsx`:

```typescript
"use client"

import { useMemo } from "react"
import { FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import type { ExplorerFile } from "@/types"

interface FileCardsProps {
  files: ExplorerFile[]
  selectedPath: string | null
  onSelect: (path: string) => void
}

export function FileCards({ files, selectedPath, onSelect }: FileCardsProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, ExplorerFile[]>()
    for (const f of files) {
      const section = f.path.includes("/") ? f.path.split("/")[0] : "root"
      const existing = map.get(section) ?? []
      existing.push(f)
      map.set(section, existing)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [files])

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-6">
        {grouped.map(([section, sectionFiles]) => (
          <div key={section}>
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2 px-1">
              {section}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {sectionFiles.map((file) => (
                <button
                  key={file.path}
                  onClick={() => onSelect(file.path)}
                  className={cn(
                    "flex flex-col gap-1.5 p-3 rounded-lg border border-border text-left",
                    "hover:border-accent/50 hover:bg-surface2 transition-all",
                    selectedPath === file.path && "border-accent/50 bg-surface2"
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                    <span className="text-xs font-medium text-txt truncate flex-1">{file.name}</span>
                    <Badge
                      variant={file.source === "ai" ? "default" : "secondary"}
                      className="text-[10px] px-1 py-0 h-4 flex-shrink-0"
                    >
                      {file.source === "ai" ? "AI" : "Auto"}
                    </Badge>
                  </div>
                  {file.description ? (
                    <p className="text-[10px] text-muted leading-relaxed line-clamp-2">
                      {file.description}
                    </p>
                  ) : (
                    <p className="text-[10px] text-muted italic">No description</p>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd /mnt/f/hoang/nextjs/vibedoc && pnpm run build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
cd /mnt/f/hoang/nextjs/vibedoc && git add src/components/explorer/FileCards.tsx && git commit -m "feat: add FileCards component for explorer card view"
```

---

## Task 11: Create ExplorerTab component

**Files:**
- Create: `src/components/explorer/ExplorerTab.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/explorer/ExplorerTab.tsx`:

```typescript
"use client"

import { useState } from "react"
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
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          Loading…
        </div>
      ) : view === "cards" ? (
        <FileCards
          files={filteredFiles}
          selectedPath={selectedPath}
          onSelect={setSelectedPath}
        />
      ) : (
        <div className="flex-1 flex overflow-hidden">
          <div className="w-72 border-r border-border flex flex-col overflow-hidden">
            <FileTree
              files={filteredFiles}
              selectedPath={selectedPath}
              onSelect={setSelectedPath}
              heatmap={view === "heatmap"}
            />
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
```

- [ ] **Step 2: Verify build**

```bash
cd /mnt/f/hoang/nextjs/vibedoc && pnpm run build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
cd /mnt/f/hoang/nextjs/vibedoc && git add src/components/explorer/ExplorerTab.tsx && git commit -m "feat: add ExplorerTab shell with view switcher"
```

---

## Task 12: Create explorer page

**Files:**
- Create: `src/app/(app)/explorer/page.tsx`

- [ ] **Step 1: Create the page**

Create `src/app/(app)/explorer/page.tsx`:

```typescript
"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useApp } from "@/context/AppContext"
import { ExplorerTab } from "@/components/explorer/ExplorerTab"
import type { ExplorerFile } from "@/types"

function ExplorerContent() {
  const { rootParam, activeProject, openDoc } = useApp()
  const searchParams = useSearchParams()
  const view = (searchParams.get("view") as "tree" | "cards" | "heatmap") || "tree"
  const [files, setFiles] = useState<ExplorerFile[]>([])
  const [loading, setLoading] = useState(true)

  const fetchFiles = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/explorer${rootParam}`)
      const data = await res.json()
      setFiles(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }, [rootParam])

  useEffect(() => {
    fetchFiles()
  }, [fetchFiles])

  function handleEnriched(path: string, description: string) {
    setFiles((prev) =>
      prev.map((f) =>
        f.path === path
          ? { ...f, description, source: "ai" as const, updatedAt: new Date().toISOString() }
          : f
      )
    )
  }

  return (
    <ExplorerTab
      files={files}
      loading={loading}
      view={view}
      root={activeProject}
      onEnriched={handleEnriched}
      onOpenDoc={openDoc}
    />
  )
}

export default function ExplorerPage() {
  return (
    <div className="flex flex-col h-full">
      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Loading…
          </div>
        }
      >
        <ExplorerContent />
      </Suspense>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd /mnt/f/hoang/nextjs/vibedoc && pnpm run build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
cd /mnt/f/hoang/nextjs/vibedoc && git add "src/app/(app)/explorer/page.tsx" && git commit -m "feat: add /explorer page"
```

---

## Task 13: Update AppSidebar and layout keyboard shortcut

**Files:**
- Modify: `src/components/layout/AppSidebar.tsx`
- Modify: `src/app/(app)/layout.tsx`

- [ ] **Step 1: Add Explorer to AppSidebar**

In `src/components/layout/AppSidebar.tsx`, change the import line (line 3) from:
```typescript
import { LayoutDashboard, BookOpen, Zap, Brain, CircleDot, Ban, ClipboardList, CheckCircle2, Settings } from "lucide-react"
```
to:
```typescript
import { LayoutDashboard, BookOpen, Zap, Brain, CircleDot, Ban, ClipboardList, CheckCircle2, Settings, FolderTree } from "lucide-react"
```

Change the `NAV_ITEMS` array (lines 20-26) to add Explorer before Settings:
```typescript
const NAV_ITEMS = [
  { href: "/board", icon: LayoutDashboard, label: "Board" },
  { href: "/docs", icon: BookOpen, label: "Docs" },
  { href: "/activity", icon: Zap, label: "Activity" },
  { href: "/memory", icon: Brain, label: "Memory" },
  { href: "/explorer", icon: FolderTree, label: "Explorer" },
  { href: "/settings", icon: Settings, label: "Settings" },
]
```

- [ ] **Step 2: Add keyboard shortcut to layout.tsx**

In `src/app/(app)/layout.tsx`, change the `SHORTCUTS` array (lines 21-30) to add the Explorer shortcut before the `/` entry:
```typescript
const SHORTCUTS = [
  { key: "Cmd+K", description: "Open command palette" },
  { key: "b", description: "Go to Board" },
  { key: "d", description: "Go to Docs" },
  { key: "a", description: "Go to Activity" },
  { key: "m", description: "Go to Memory" },
  { key: "e", description: "Go to Explorer" },
  { key: "/", description: "Focus doc search" },
  { key: "?", description: "Toggle this help" },
  { key: "Esc", description: "Close panel / modal" },
]
```

In the `onKey` switch statement (lines 49-65), add after `case "m":`:
```typescript
        case "e": router.push("/explorer"); break
```

- [ ] **Step 3: Verify build**

```bash
cd /mnt/f/hoang/nextjs/vibedoc && pnpm run build 2>&1 | tail -5
```
Expected: `✓ Compiled successfully` with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
cd /mnt/f/hoang/nextjs/vibedoc && git add src/components/layout/AppSidebar.tsx "src/app/(app)/layout.tsx" && git commit -m "feat: add Explorer nav item and keyboard shortcut"
```

---

## Task 14: Final verification

- [ ] **Step 1: Full build**

```bash
cd /mnt/f/hoang/nextjs/vibedoc && pnpm run build 2>&1
```
Expected: build succeeds, no TypeScript errors.

- [ ] **Step 2: Lint check**

```bash
cd /mnt/f/hoang/nextjs/vibedoc && pnpm run lint 2>&1
```
Expected: no errors.

- [ ] **Step 3: Smoke test (manual)**

Start the dev server: `pnpm run dev`

Verify:
1. `/explorer` loads — file tree is visible with descriptions
2. Switch views: Tree → Cards → Heatmap all render
3. Sidebar shows "Explorer" nav item
4. Press `e` in browser → navigates to `/explorer`
5. Click a file → right panel shows path, description, badges, buttons
6. Heatmap view: recently modified files have green filenames
7. Cards view: files grouped by section with description text visible
8. MCP: `POST /api/mcp` with `{"method":"tools/list"}` includes `vibedoc_get_file_map`

- [ ] **Step 4: Commit design doc**

```bash
cd /mnt/f/hoang/nextjs/vibedoc && mkdir -p docs/superpowers/specs && cp /home/johan/.claude/plans/velvet-herding-origami.md docs/superpowers/specs/2026-03-31-file-explorer-design.md && git add docs/superpowers/specs/2026-03-31-file-explorer-design.md && git commit -m "docs: add file explorer design spec"
```
