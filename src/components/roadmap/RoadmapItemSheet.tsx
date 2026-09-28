"use client"

import { useState } from "react"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { askAgent } from "@/lib/ask-agent"
import { dueState, localToday, type RoadmapProgress } from "@/lib/roadmap-health"
import { pickNextTask } from "@/lib/work-queue"
import { STATUS_BADGE_COLORS } from "@/components/board/TaskCard"
import { DueChip, Progress } from "./RoadmapNodes"
import type { RoadmapItem, RoadmapStatus, Task, UpdateRoadmapItemPatch } from "@/types"

const STATUSES: RoadmapStatus[] = ["planned", "in-progress", "done"]

const FIELD = "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-txt focus:outline-hidden focus:ring-1 focus:ring-accent disabled:opacity-50"
const LABEL = "text-xs font-medium text-muted"

interface RoadmapItemSheetProps {
  item: RoadmapItem | null
  items: RoadmapItem[]
  onClose: () => void
  /** Each returns an error message, or null on success. */
  onSave: (id: string, patch: UpdateRoadmapItemPatch) => Promise<string | null>
  onDelete: (id: string) => Promise<string | null>
  onAddFeature: (parentId: string) => void
  onEditRaw: (file: string) => void
  /** Every task on the board, by id — the epic's linked tasks are looked up here. */
  tasksById: Record<string, Task>
  progress?: RoadmapProgress
}

export function RoadmapItemSheet({ item, onClose, ...rest }: RoadmapItemSheetProps) {
  return (
    <Sheet open={!!item} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent className="w-[440px] sm:max-w-[440px] bg-surface border-border text-txt flex flex-col overflow-y-auto">
        {/* keyed so form state re-initialises from props when a different item opens */}
        {item && <ItemForm key={item.id} item={item} onClose={onClose} {...rest} />}
      </SheetContent>
    </Sheet>
  )
}

function ItemForm({ item, items, onClose, onSave, onDelete, onAddFeature, onEditRaw, tasksById, progress }: RoadmapItemSheetProps & { item: RoadmapItem }) {
  // snapshot at open: the dirty check diffs against this, not the live (SSE-refreshed) item
  const [base] = useState(item)
  const [title, setTitle] = useState(item.title)
  const [status, setStatus] = useState<RoadmapStatus>(item.status)
  const [parent, setParent] = useState(item.parent ?? "")
  const [order, setOrder] = useState(String(item.order))
  const [tasks, setTasks] = useState(item.tasks.join(", "))
  const [due, setDue] = useState(item.due ?? "")
  const [body, setBody] = useState(item.body)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const hasChildren = items.some((i) => i.parent === item.id)
  const horizons = items.filter((i) => i.parent === null && i.id !== item.id)
  const isHorizon = item.parent === null
  const orphanParent = item.parent !== null && !horizons.some((h) => h.id === item.parent)

  async function run(fn: () => Promise<string | null>) {
    setBusy(true)
    setError(null)
    const err = await fn()
    setBusy(false)
    if (err) setError(err)
    return !err
  }

  async function save() {
    // Send only fields the user changed, so concurrent edits (AI / other tab) to other fields survive.
    const patch: UpdateRoadmapItemPatch = {}
    const nextTitle = title.trim() || base.title
    if (nextTitle !== base.title) patch.title = nextTitle
    if (status !== base.status) patch.status = status
    if ((parent || null) !== base.parent) patch.parent = parent || null
    if (order.trim() !== String(base.order)) {
      const n = Number(order)
      if (order.trim() === "" || !Number.isFinite(n)) {
        setError("Order must be a number")
        return
      }
      patch.order = n
    }
    const nextTasks = tasks.split(",").map((t) => t.trim()).filter(Boolean)
    if (nextTasks.join(",") !== base.tasks.join(",")) patch.tasks = nextTasks
    if ((due || null) !== base.due) patch.due = due || null
    if (body !== base.body) patch.body = body
    if (Object.keys(patch).length === 0) {
      onClose()
      return
    }
    if (await run(() => onSave(item.id, patch))) onClose()
  }

  async function remove() {
    if (!window.confirm(`Delete ${item.id}: ${item.title}?`)) return
    if (await run(() => onDelete(item.id))) onClose()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="pr-6">
        <SheetTitle className="text-base text-txt">{item.title}</SheetTitle>
        <SheetDescription className="font-mono text-xs text-muted">
          {item.id} · {isHorizon ? "horizon" : "feature"}
        </SheetDescription>
      </div>

      {!isHorizon && item.tasks.length > 0 && (
        <LinkedTasks item={item} tasksById={tasksById} progress={progress} onOpen={onEditRaw} />
      )}

      <label className="flex flex-col gap-1">
        <span className={LABEL}>Title</span>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="bg-bg border-border text-txt" />
      </label>

      <div className="grid grid-cols-3 gap-3">
        <label className="flex flex-col gap-1">
          <span className={LABEL}>Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as RoadmapStatus)} className={FIELD}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={LABEL}>Parent</span>
          <select
            value={parent}
            onChange={(e) => setParent(e.target.value)}
            disabled={hasChildren}
            title={hasChildren ? "Items with children must stay on the spine" : undefined}
            className={FIELD}
          >
            <option value="">— (horizon)</option>
            {orphanParent && <option value={item.parent ?? ""}>{item.parent} · missing</option>}
            {horizons.map((h) => <option key={h.id} value={h.id}>{h.id} · {h.title}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={LABEL}>Order</span>
          <Input
            type="number"
            step={10}
            value={order}
            onChange={(e) => setOrder(e.target.value)}
            title={isHorizon ? "Position on the spine" : "Position within the branch"}
            className="bg-bg border-border text-txt"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className={LABEL}>Due</span>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="bg-bg border-border text-txt scheme-light dark:scheme-dark"
          />
          {due && (
            <button type="button" onClick={() => setDue("")} className="text-xs text-muted hover:text-txt">
              Clear
            </button>
          )}
        </div>
      </label>

      <label className="flex flex-col gap-1">
        <span className={LABEL}>Tasks</span>
        <Input
          value={tasks}
          onChange={(e) => setTasks(e.target.value)}
          placeholder="T001, T012"
          className="bg-bg border-border text-txt font-mono"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className={LABEL}>Body (markdown)</span>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} className={`${FIELD} font-mono resize-y`} />
      </label>

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={save} disabled={busy} className="bg-accent text-white hover:bg-accent/90">
          Save
        </Button>
        {isHorizon && (
          <Button size="sm" variant="ghost" onClick={() => onAddFeature(item.id)} disabled={busy} className="text-txt">
            Add feature
          </Button>
        )}
        {!isHorizon && item.tasks.length === 0 && (
          <Button size="sm" variant="ghost" onClick={() => { onClose(); askAgent(`Break down epic ${item.id} into tasks.`) }} disabled={busy} className="text-txt">
            Break down with agent
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => onEditRaw(item.file)} disabled={busy} className="text-txt">
          Edit raw
        </Button>
        <Button size="sm" variant="ghost" onClick={remove} disabled={busy} className="ml-auto text-danger hover:text-danger">
          Delete
        </Button>
      </div>
    </div>
  )
}

function LinkedTasks({ item, tasksById, progress, onOpen }: {
  item: RoadmapItem
  tasksById: Record<string, Task>
  progress?: RoadmapProgress
  onOpen: (file: string) => void
}) {
  const today = localToday()
  const next = pickNextTask(item, Object.values(tasksById))
  const nextId = next.kind === "ready" ? next.taskId : null
  // Todo tasks' "waits on …" first: in-progress/blocked rows already say so in their badge.
  const reasons = next.kind === "waiting"
    ? [...next.waiting].sort((a, b) => Number(tasksById[b.taskId]?.status === "todo") - Number(tasksById[a.taskId]?.status === "todo")).map((w) => w.reason)
    : []
  return (
    <section className="flex flex-col gap-2 rounded-md border border-border p-3">
      <div className="flex items-center justify-between">
        <span className={LABEL}>Tasks</span>
        <DueChip due={item.due} state={dueState(item.due, item.status, today)} />
      </div>
      <Progress progress={progress} />
      <ul className="flex flex-col">
        {item.tasks.map((id) => {
          const t = tasksById[id]
          if (!t) {
            return (
              <li key={id} className="py-1.5 font-mono text-xs text-danger">{id} · missing task file</li>
            )
          }
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onOpen(t.file)}
                className="flex w-full items-center gap-2 rounded-sm px-1 py-1.5 text-left hover:bg-bg"
              >
                <span className="shrink-0 font-mono text-xs text-muted">{t.id}</span>
                <span className={cn("min-w-0 flex-1 truncate text-sm", t.status === "cancelled" ? "text-muted line-through" : "text-txt")}>
                  {t.title}
                </span>
                {t.size && t.size !== "—" && <span className="shrink-0 font-mono text-[10px] text-muted">{t.size.split(" ")[0]}</span>}
                <DueChip due={t.due} state={dueState(t.due, t.status === "done" ? "done" : "planned", today)} />
                {t.id === nextId && (
                  <span className="shrink-0 rounded-sm border border-accent/40 px-1.5 text-[10px] text-accent">Next up</span>
                )}
                <span className={cn("shrink-0 rounded-sm border px-1.5 text-[10px]", STATUS_BADGE_COLORS[t.status])}>
                  {t.status}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {reasons.length > 0 && (
        <p className="truncate text-xs text-muted" title={reasons.join("\n")}>
          {reasons[0]}{reasons.length > 1 && ` (+${reasons.length - 1} more)`}
        </p>
      )}
    </section>
  )
}
