"use client"

import { useState } from "react"
import { Bot, ChevronRight, FileText, MessageSquare, Pencil, Plus } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { MarkdownRenderer } from "@/components/docs/MarkdownRenderer"
import { cn } from "@/lib/utils"
import { askAgent } from "@/lib/ask-agent"
import { chatFor } from "@/lib/chats"
import { AgentDot, AgentMark } from "@/components/chat/AgentMark"
import { useChats } from "@/context/ChatContext"
import { dueState, localToday, type RoadmapProgress } from "@/lib/roadmap-health"
import { pickNextTask } from "@/lib/work-queue"
import { ItemActionsMenu, type ItemActions } from "./ItemActionsMenu"
import { useItemCommands } from "@/components/shared/item-commands"
import { OwnerChip } from "@/components/shared/OwnerChip"
import { DueChip, SegmentedProgress, StatusDot, StatusPill, TASK_STATUS_BG } from "./RoadmapNodes"
import type { RoadmapItem, RoadmapStatus, Task, TaskStatus, UpdateRoadmapItemPatch } from "@/types"

const STATUSES: RoadmapStatus[] = ["planned", "in-progress", "paused", "done"]

const FIELD = "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-txt focus:outline-hidden focus:ring-1 focus:ring-accent disabled:opacity-50"
const LABEL = "text-xs font-medium text-muted"
const SECTION = "font-mono text-[10px] uppercase tracking-widest text-muted"

interface RoadmapItemSheetProps {
  item: RoadmapItem | null
  items: RoadmapItem[]
  onClose: () => void
  /** Each returns an error message, or null on success. */
  onSave: (id: string, patch: UpdateRoadmapItemPatch) => Promise<string | null>
  onDelete: (id: string) => Promise<string | null>
  onAddFeature: (parentId: string) => void
  onEditRaw: (file: string) => void
  onSelect: (id: string) => void
  /** Every task on the board, by id — the epic's linked tasks are looked up here. */
  tasksById: Record<string, Task>
  progressById: Record<string, RoadmapProgress>
  editing: boolean
  onEditingChange: (editing: boolean) => void
  actions: ItemActions
}

export function RoadmapItemSheet({ item, onClose, ...rest }: RoadmapItemSheetProps) {
  return (
    <Sheet open={!!item} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent className="w-[480px] sm:max-w-[480px] gap-0 bg-surface border-border text-txt flex flex-col overflow-y-auto p-0">
        {/* keyed so view/edit and form state re-initialise when a different item opens */}
        {item && <ItemPanel key={item.id} item={item} onClose={onClose} {...rest} />}
      </SheetContent>
    </Sheet>
  )
}

function ItemPanel(props: RoadmapItemSheetProps & { item: RoadmapItem }) {
  return props.editing
    ? <ItemForm {...props} onCancel={() => props.onEditingChange(false)} />
    : <ItemView {...props} onEdit={() => props.onEditingChange(true)} />
}

/** Read-first view: where it sits, how far along, what's next, and the brief. */
function ItemView({ item, items, onClose, onAddFeature, onEditRaw, onSelect, tasksById, progressById, onEdit, actions }: RoadmapItemSheetProps & { item: RoadmapItem; onEdit: () => void }) {
  const isHorizon = item.parent === null
  const parent = items.find((i) => i.id === item.parent)
  const epics = items.filter((i) => i.parent === item.id).sort((a, b) => a.order - b.order)
  const progress = progressById[item.id]
  const today = localToday()
  const { chats, showAbout } = useChats()
  const chat = isHorizon ? undefined : chatFor(chats, { kind: "epic", id: item.id })
  const offerBreakdown = !isHorizon && item.tasks.length === 0 && !chat
  const [menuOpen, setMenuOpen] = useState(false)
  useItemCommands(`${item.id} · ${item.title}`, [
    { action: "edit", label: "Edit", run: onEdit },
    { action: "status", label: "Change status…", run: () => setMenuOpen(true) },
    { action: "duplicate", label: "Duplicate", run: () => actions.duplicate(item.id) },
    ...(isHorizon ? [] : [{ action: "chat" as const, label: "Chat about it", run: () => actions.chat(item.id) }]),
    ...(epics.length ? [] : [{ action: "remove" as const, label: "Delete", run: () => actions.remove(item.id) }]),
  ])

  return (
    <div className="flex min-h-full flex-col">
      <header className={cn("border-b border-border px-6 pb-5 pt-6", item.status === "in-progress" && "bg-[linear-gradient(180deg,rgb(var(--rgb-accent)/0.08),transparent)]")}>
        <SheetDescription asChild>
          <div className="flex items-center gap-1 pr-8 font-mono text-[11px] text-muted">
            {parent && (
              <>
                <button type="button" onClick={() => onSelect(parent.id)} className="truncate hover:text-txt">{parent.title}</button>
                <ChevronRight className="h-3 w-3 shrink-0" />
              </>
            )}
            <span className="shrink-0">{item.id} · {isHorizon ? "horizon" : "epic"}</span>
          </div>
        </SheetDescription>
        <SheetTitle className="mt-2 text-xl font-semibold leading-tight text-txt">{item.title}</SheetTitle>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <StatusPill status={item.status} />
          <OwnerChip owner={item.owner} />
          <AgentMark attach={{ kind: "epic", id: item.id }} />
          <DueChip due={item.due} state={dueState(item.due, item.status, today)} />
          <ItemActionsMenu item={item} items={items} actions={actions} className="ml-auto" open={menuOpen} onOpenChange={setMenuOpen} />
        </div>
        {progress && (
          <div className="mt-5 flex items-end gap-4">
            <p className="font-mono text-3xl font-semibold leading-none tabular-nums text-txt">
              {Math.round((progress.done / progress.total) * 100)}<span className="text-base text-muted">%</span>
            </p>
            <div className="flex-1 pb-1">
              <p className="mb-1.5 font-mono text-[10px] text-muted">{progress.done} of {progress.total}{isHorizon ? "" : " tasks"} done</p>
              {isHorizon ? (
                <div className="h-1.5 overflow-hidden rounded-full bg-border">
                  <div className="h-full rounded-full bg-teal" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
                </div>
              ) : (
                <SegmentedProgress statuses={item.tasks.map((id) => tasksById[id]?.status).filter((s): s is TaskStatus => !!s && s !== "cancelled")} />
              )}
            </div>
          </div>
        )}
      </header>

      <div className="flex flex-1 flex-col gap-6 px-6 py-5">
        {!isHorizon && item.tasks.length > 0 && <LinkedTasks item={item} tasksById={tasksById} onOpen={onEditRaw} />}

        {isHorizon && (
          <section className="flex flex-col gap-2">
            <p className={SECTION}>Epics · {epics.length}</p>
            {epics.length === 0 && <p className="text-sm text-muted">No epics yet.</p>}
            <ul className="-mx-2 flex flex-col">
              {epics.map((e) => {
                const p = progressById[e.id]
                return (
                  <li key={e.id}>
                    <button type="button" onClick={() => onSelect(e.id)} className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-surface2">
                      <StatusDot status={e.status} />
                      <span className="shrink-0 font-mono text-[11px] text-muted">{e.id}</span>
                      <span className={cn("min-w-0 flex-1 truncate text-sm", e.status === "done" ? "text-muted" : "text-txt")}>{e.title}</span>
                      {p && <span className="shrink-0 font-mono text-[10px] text-muted">{p.done}/{p.total}</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        <section className="flex flex-col gap-2">
          <p className={SECTION}>Brief</p>
          {item.body.trim()
            ? <MarkdownRenderer content={item.body} className="text-sm" />
            : <p className="text-sm text-muted">No description. Edit to add the outcome, scope and &ldquo;done when&rdquo;.</p>}
        </section>
      </div>

      <footer className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t border-border bg-surface px-6 py-3">
        {offerBreakdown && (
          <Button size="sm" onClick={() => { onClose(); askAgent(`Break down epic ${item.id} into tasks.`) }} className="bg-accent text-accent-fg hover:bg-accent/90">
            <Bot /> Break down with agent
          </Button>
        )}
        {!isHorizon && (
          <Button
            size="sm"
            variant={offerBreakdown ? "outline" : "default"}
            onClick={() => { onClose(); showAbout({ kind: "epic", id: item.id }) }}
            className={cn(!offerBreakdown && "bg-accent text-accent-fg hover:bg-accent/90")}
          >
            <MessageSquare /> {chat ? "Open chat" : "Chat"}
          </Button>
        )}
        {isHorizon && (
          <Button size="sm" onClick={() => onAddFeature(item.id)} className="bg-accent text-accent-fg hover:bg-accent/90">
            <Plus /> Add epic
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={onEdit}>
          <Pencil /> Edit
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onEditRaw(item.file)} className="ml-auto text-muted hover:text-txt">
          <FileText /> Open file
        </Button>
      </footer>
    </div>
  )
}

function ItemForm({ item, items, onClose, onSave, onDelete, onCancel }: RoadmapItemSheetProps & { item: RoadmapItem; onCancel: () => void }) {
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
      onCancel()
      return
    }
    if (await run(() => onSave(item.id, patch))) onClose()
  }

  async function remove() {
    if (await run(() => onDelete(item.id))) onClose()
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="border-b border-border px-6 pb-4 pt-6 pr-12">
        <SheetDescription className="font-mono text-[11px] text-muted">Editing {item.id} · {isHorizon ? "horizon" : "epic"}</SheetDescription>
        <SheetTitle className="mt-1 text-base text-txt">{item.title}</SheetTitle>
      </div>

      <div className="flex flex-1 flex-col gap-4 px-6 py-5">
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
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} className={`${FIELD} font-mono resize-y`} />
        </label>

        {error && <p className="text-xs text-danger">{error}</p>}
      </div>

      <footer className="sticky bottom-0 flex items-center gap-2 border-t border-border bg-surface px-6 py-3">
        <Button size="sm" onClick={save} disabled={busy} className="bg-accent text-accent-fg hover:bg-accent/90">
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy} className="text-txt">
          Cancel
        </Button>
        <Button size="sm" variant="ghost" onClick={remove} disabled={busy} className="ml-auto text-danger hover:text-danger">
          Delete
        </Button>
      </footer>
    </div>
  )
}

function LinkedTasks({ item, tasksById, onOpen }: {
  item: RoadmapItem
  tasksById: Record<string, Task>
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
    <section className="flex flex-col gap-2">
      <p className={SECTION}>Tasks · {item.tasks.length}</p>
      <ul className="-mx-2 flex flex-col">
        {item.tasks.map((id) => {
          const t = tasksById[id]
          if (!t) {
            return (
              <li key={id} className="px-2 py-2 font-mono text-xs text-danger">{id} · missing task file</li>
            )
          }
          const isNext = t.id === nextId
          return (
            <li key={id} className={cn("group flex items-center rounded-md hover:bg-surface2", isNext && "bg-accent/10 hover:bg-accent/15")}>
              <button
                type="button"
                onClick={() => onOpen(t.file)}
                className="flex min-w-0 flex-1 items-center gap-3 px-2 py-2 text-left"
              >
                <span title={t.status} className={cn("h-2 w-2 shrink-0 rounded-full", TASK_STATUS_BG[t.status])} />
                <span className="shrink-0 font-mono text-[11px] text-muted">{t.id}</span>
                <span className={cn("min-w-0 flex-1 truncate text-sm", t.status === "cancelled" ? "text-muted line-through" : t.status === "done" ? "text-muted" : "text-txt")}>
                  {t.title}
                </span>
                <DueChip due={t.due} state={dueState(t.due, t.status === "done" ? "done" : "planned", today)} />
                {isNext
                  ? <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-accent">Next up</span>
                  : t.size && t.size !== "—" && <span className="shrink-0 font-mono text-[10px] text-muted">{t.size.split(" ")[0]}</span>}
                <AgentDot attach={{ kind: "task", id: t.id }} />
              </button>
              <TaskChatButton taskId={t.id} />
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

/** Per-task chat entry in the epic sheet: always visible when a chat exists, on hover otherwise. */
function TaskChatButton({ taskId }: { taskId: string }) {
  const { chats, showAbout } = useChats()
  const has = !!chatFor(chats, { kind: "task", id: taskId })
  return (
    <button
      type="button"
      onClick={() => showAbout({ kind: "task", id: taskId })}
      aria-label={`${has ? "Open chat" : "Chat"} about ${taskId}`}
      title={has ? `Open the chat about ${taskId}` : `Chat about ${taskId}`}
      className={cn(
        "mr-1 grid size-7 shrink-0 place-items-center rounded-md text-muted transition-[opacity,color] duration-(--duration-fast) hover:bg-surface hover:text-accent focus-visible:opacity-100",
        has ? "text-accent opacity-100" : "opacity-0 group-hover:opacity-100",
      )}
    >
      <MessageSquare className="size-3.5" />
    </button>
  )
}
