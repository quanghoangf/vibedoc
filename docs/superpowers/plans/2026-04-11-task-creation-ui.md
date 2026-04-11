# Task Creation UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "New Task" button to the board that opens a modal form, writes a new `T00N-slug.md` file to `plans/tasks/`, and shows the card in the Todo column immediately.

**Architecture:** New `createTask()` in `core.ts` handles file writing and ID auto-numbering. A new `POST /api/tasks/create` route calls it and emits an SSE event. `NewTaskModal` component (mirrors `NewDocModal` pattern) is managed in `board/page.tsx` and triggered from `BoardTab`.

**Tech Stack:** Next.js App Router route handler, existing `core.ts` fs pattern, shadcn Dialog (already installed via `@radix-ui/react-dialog`), Tailwind CSS.

---

## File Map

| Action | File |
|--------|------|
| Modify | `src/lib/core.ts` — add `createTask()` |
| Create | `src/app/api/tasks/create/route.ts` |
| Create | `src/components/board/NewTaskModal.tsx` |
| Modify | `src/components/board/BoardTab.tsx` — add `onNewTask` prop + button |
| Modify | `src/app/(app)/board/page.tsx` — manage modal state |

---

## Task 1: Add `createTask()` to core.ts

**Files:**
- Modify: `src/lib/core.ts`

### Context

`listTasks(root)` already exists and returns `{ tasks: Task[], board: TaskBoard }`. Tasks are stored as `plans/tasks/T{NNN}-{slug}.md`. The file format is:

```markdown
# T001: Title
**Status:** 📋 Ready
**Phase:** 1 — Core
**Size:** M (3-4 hrs)
**Depends on:** —

## What to build
Description here.

## Scope
- [ ] 

## Acceptance criteria
- [ ] 

## Definition of done
—
```

- [ ] **Step 1: Add `CreateTaskParams` type and `createTask` function to `src/lib/core.ts`**

Add after the existing task functions (search for `updateTaskStatus` — add after it):

```typescript
export interface CreateTaskParams {
  title: string
  phase?: string
  size?: string
  description?: string
  dependsOn?: string
}

export async function createTask(params: CreateTaskParams, root: string): Promise<Task> {
  const { tasks } = await listTasks(root)

  // Auto-number: find highest existing T-number, increment
  const ids = tasks
    .map(t => parseInt(t.id.replace(/^T/i, ''), 10))
    .filter(n => !isNaN(n))
  const nextNum = ids.length > 0 ? Math.max(...ids) + 1 : 1
  const id = `T${String(nextNum).padStart(3, '0')}`

  // Slug: lowercase title, hyphens only, max 40 chars
  const slug = params.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)

  const filename = `${id}-${slug}.md`
  const tasksDir = path.join(root, 'plans', 'tasks')
  await fs.mkdir(tasksDir, { recursive: true })
  const filePath = path.join(tasksDir, filename)

  const content = `# ${id}: ${params.title}
**Status:** 📋 Ready
**Phase:** ${params.phase || '—'}
**Size:** ${params.size || '—'}
**Depends on:** ${params.dependsOn || '—'}

## What to build
${params.description || '—'}

## Scope
- [ ] 

## Acceptance criteria
- [ ] 

## Definition of done
—
`

  await fs.writeFile(filePath, content, 'utf8')

  // Return the task by re-reading it (reuses existing parse logic)
  return getTask(id, root)
}
```

Note: `fs`, `path`, and `getTask` are already imported/defined in `core.ts`. Verify `fs` is `import fs from 'fs/promises'` at the top of the file.

- [ ] **Step 2: Verify build still compiles**

```bash
pnpm run build 2>&1 | tail -20
```

Expected: no TypeScript errors for core.ts.

---

## Task 2: Create `POST /api/tasks/create` route

**Files:**
- Create: `src/app/api/tasks/create/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createTask, getConfiguredRoot, type CreateTaskParams } from '@/lib/core'
import { emitUpdate } from '@/lib/events'

export async function POST(req: NextRequest) {
  const root = req.nextUrl.searchParams.get('root') || getConfiguredRoot()
  const body = await req.json() as CreateTaskParams & { title: string }

  if (!body.title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  try {
    const task = await createTask(body, root)
    emitUpdate('task_created', { task })
    return NextResponse.json({ task }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify build**

```bash
pnpm run build 2>&1 | tail -20
```

Expected: route compiles, `ƒ /api/tasks/create` appears in output.

---

## Task 3: Build `NewTaskModal` component

**Files:**
- Create: `src/components/board/NewTaskModal.tsx`

The `@radix-ui/react-dialog` package is already installed (used by TaskDetailPanel). Use it directly.

- [ ] **Step 1: Create the modal component**

```typescript
"use client"

import { useState, useEffect } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { X, Plus, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface NewTaskModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rootParam: string
  onTaskCreated: () => void
}

const SIZE_OPTIONS = [
  { value: "XS (< 1 hr)", label: "XS — under 1 hr" },
  { value: "S (1-2 hrs)", label: "S — 1–2 hrs" },
  { value: "M (3-4 hrs)", label: "M — 3–4 hrs" },
  { value: "L (5-8 hrs)", label: "L — 5–8 hrs" },
  { value: "XL (> 1 day)", label: "XL — over a day" },
]

export function NewTaskModal({ open, onOpenChange, rootParam, onTaskCreated }: NewTaskModalProps) {
  const [title, setTitle] = useState("")
  const [phase, setPhase] = useState("")
  const [size, setSize] = useState("")
  const [description, setDescription] = useState("")
  const [dependsOn, setDependsOn] = useState("")
  const [error, setError] = useState("")
  const [creating, setCreating] = useState(false)

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setTitle("")
      setPhase("")
      setSize("")
      setDescription("")
      setDependsOn("")
      setError("")
      setCreating(false)
    }
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError("Title is required"); return }

    setCreating(true)
    setError("")

    try {
      const res = await fetch(`/api/tasks/create${rootParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          phase: phase.trim() || undefined,
          size: size || undefined,
          description: description.trim() || undefined,
          dependsOn: dependsOn.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? "Failed to create task")
        setCreating(false)
        return
      }

      onTaskCreated()
      onOpenChange(false)
    } catch {
      setError("Network error — please try again")
      setCreating(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-surface border border-border rounded-xl shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <Dialog.Title className="font-semibold text-txt">New Task</Dialog.Title>
            <Dialog.Close className="text-muted hover:text-txt transition-colors">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted uppercase tracking-wide">
                Title <span className="text-danger">*</span>
              </label>
              <input
                autoFocus
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Add drag-and-drop to kanban"
                className="w-full px-3 py-2 bg-surface2 border border-border rounded-lg text-sm text-txt placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
              />
            </div>

            {/* Phase + Size row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted uppercase tracking-wide">Phase</label>
                <input
                  type="text"
                  value={phase}
                  onChange={e => setPhase(e.target.value)}
                  placeholder="e.g. 1 — Core"
                  className="w-full px-3 py-2 bg-surface2 border border-border rounded-lg text-sm text-txt placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted uppercase tracking-wide">Size</label>
                <select
                  value={size}
                  onChange={e => setSize(e.target.value)}
                  className="w-full px-3 py-2 bg-surface2 border border-border rounded-lg text-sm text-txt focus:outline-none focus:border-accent transition-colors"
                >
                  <option value="">—</option>
                  {SIZE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Depends on */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted uppercase tracking-wide">Depends on</label>
              <input
                type="text"
                value={dependsOn}
                onChange={e => setDependsOn(e.target.value)}
                placeholder="e.g. T001, T003"
                className="w-full px-3 py-2 bg-surface2 border border-border rounded-lg text-sm text-txt placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted uppercase tracking-wide">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="What needs to be built?"
                rows={3}
                className="w-full px-3 py-2 bg-surface2 border border-border rounded-lg text-sm text-txt placeholder:text-muted focus:outline-none focus:border-accent transition-colors resize-none"
              />
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm text-danger">{error}</p>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-1">
              <Dialog.Close
                type="button"
                className="px-4 py-2 text-sm text-muted hover:text-txt transition-colors"
              >
                Cancel
              </Dialog.Close>
              <button
                type="submit"
                disabled={creating || !title.trim()}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  "bg-accent text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {creating ? "Creating…" : "Create Task"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
pnpm run build 2>&1 | tail -20
```

Expected: no errors.

---

## Task 4: Wire "New Task" button in BoardTab

**Files:**
- Modify: `src/components/board/BoardTab.tsx`

- [ ] **Step 1: Add `onNewTask` prop and button**

Replace the entire file content:

```typescript
"use client"

import { Plus } from "lucide-react"
import type { TaskBoard, Task, Summary } from "@/types"
import { BoardColumn } from "./BoardColumn"

interface BoardTabProps {
  board: TaskBoard
  summary: Summary | null
  onMoveTask: (id: string, status: string) => void
  onOpenTask: (task: Task) => void
  onNewTask: () => void
}

export function BoardTab({ board, summary, onMoveTask, onOpenTask, onNewTask }: BoardTabProps) {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-xl">Task Board</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-muted">{summary?.tasks.total || 0} tasks</span>
          <button
            onClick={onNewTask}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Task
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {(["in-progress", "todo", "blocked", "done"] as const).map((col) => (
          <BoardColumn
            key={col}
            status={col}
            tasks={board[col]}
            onMoveTask={onMoveTask}
            onOpenTask={onOpenTask}
          />
        ))}
      </div>
    </div>
  )
}
```

---

## Task 5: Wire modal state in board/page.tsx

**Files:**
- Modify: `src/app/(app)/board/page.tsx`

- [ ] **Step 1: Add modal state and wire everything together**

Replace the entire file content:

```typescript
"use client"

import { useState } from "react"
import { useApp } from "@/context/AppContext"
import { BoardTab } from "@/components/board/BoardTab"
import { TaskDetailPanel } from "@/components/board/TaskDetailPanel"
import { NewTaskModal } from "@/components/board/NewTaskModal"
import type { Task } from "@/types"

export default function BoardPage() {
  const { board, summary, moveTask, refresh, rootParam } = useApp()
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [newTaskOpen, setNewTaskOpen] = useState(false)

  if (!board) return null

  return (
    <div className="relative flex-1">
      <BoardTab
        board={board}
        summary={summary}
        onMoveTask={moveTask}
        onOpenTask={setSelectedTask}
        onNewTask={() => setNewTaskOpen(true)}
      />
      <TaskDetailPanel
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onMove={moveTask}
      />
      <NewTaskModal
        open={newTaskOpen}
        onOpenChange={setNewTaskOpen}
        rootParam={rootParam}
        onTaskCreated={refresh}
      />
    </div>
  )
}
```

- [ ] **Step 2: Final build verification**

```bash
pnpm run build 2>&1 | tail -20
```

Expected: clean build, no TypeScript errors.

---

## Self-Review

**Spec coverage:**
- ✅ "New Task" button in Board tab header → Task 4
- ✅ Modal form: title, phase, size, description, depends-on → Task 3
- ✅ Auto-number: scan existing tasks, pick next T00N → Task 1 (`createTask`)
- ✅ Writes `plans/tasks/T00N-slug.md` → Task 1
- ✅ New task appears in todo column immediately → Task 5 (`onTaskCreated={refresh}`)
- ✅ Emits SSE event → Task 2 (`emitUpdate('task_created', ...)`)
- ✅ Title validation → Task 3 (client) + Task 2 (server 400)
- ✅ Build passes → verified at each task

**No placeholders:** All code is complete.

**Type consistency:** `CreateTaskParams` defined in Task 1, used in Task 2. `onNewTask: () => void` added in Task 4, consumed in Task 5. `onTaskCreated: () => void` in `NewTaskModalProps` (Task 3) wired to `refresh` in Task 5.
