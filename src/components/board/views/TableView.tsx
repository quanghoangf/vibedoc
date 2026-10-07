"use client"

import { useState, type MouseEvent } from "react"
import { ArrowDown, ArrowUp, Bot, Check, ChevronRight, FlaskConical, Minus } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTaskGroups } from "./useTaskGroups"
import { useT } from "@/context/LanguageContext"
import type { MessageKey } from "@/i18n"
import { localToday } from "@/lib/roadmap-health"
import { QuickReviewButton } from "../QuickReview"
import { TaskDueField, TaskOwnerField, TaskSizeField, TaskStatusField } from "../TaskFields"
import { epicOf, type PropertyKey, type SortProp, type SortRule, type TaskGroup, type ViewState } from "@/lib/board-views"
import type { Task, TaskStatus } from "@/types"

interface ViewProps {
  tasks: Task[]
  allTasks: Task[]
  state: ViewState
  agentTasks: Set<string>
  onOpenTask: (task: Task) => void
  selected?: Set<string>
  onToggleSelect?: (ids: string[], on?: boolean) => void
}

type TableViewProps = ViewProps & { onSort: (sorts: SortRule[]) => void }

const ORDER: PropertyKey[] = ["status", "epic", "owner", "size", "due", "deps", "tests", "agent"]
const LABEL: Record<PropertyKey, MessageKey> = {
  status: "board.status", epic: "board.epic", size: "board.size", due: "board.due", deps: "board.dependsOn", tests: "board.tests", agent: "board.agent", owner: "board.owner",
}
const WIDTH: Record<PropertyKey, string> = {
  status: "w-[120px]", epic: "w-[170px]", size: "w-[56px]", due: "w-[92px]", deps: "w-[140px]", tests: "w-[128px]", agent: "w-[88px]", owner: "w-[104px]",
}
/** Hidden below md: the phone table keeps ID · Title · Status · Due · Agent. */
const WIDE_ONLY = new Set<PropertyKey>(["epic", "size", "deps", "tests", "owner"])
const SORTABLE = new Set<string>(["id", "title", "status", "epic", "size", "due"])
const MARK_BG: Record<TaskStatus, string> = {
  todo: "bg-border2", "in-progress": "bg-amber", review: "bg-accent", blocked: "bg-danger", paused: "bg-muted/60", done: "bg-teal", cancelled: "bg-border",
}

const cellMono = "font-mono text-[11px] text-muted"
const ring = "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"

/** Click = the only sort (asc, then desc); shift-click = add / flip a secondary sort. */
export function nextSorts(sorts: SortRule[], prop: SortProp, additive: boolean): SortRule[] {
  const i = sorts.findIndex((s) => s.prop === prop)
  const flip = (s: SortRule): SortRule => ({ prop: s.prop, dir: s.dir === "asc" ? "desc" : "asc" })
  if (additive) {
    return i < 0 ? [...sorts, { prop, dir: "asc" }] : sorts.map((s, j) => (j === i ? flip(s) : s))
  }
  return sorts.length === 1 && i === 0 ? [flip(sorts[0])] : [{ prop, dir: "asc" }]
}

export function TableView({ tasks, state, agentTasks, onOpenTask, onSort, selected = new Set(), onToggleSelect }: TableViewProps) {
  const groupTasks = useTaskGroups()
  const { t } = useT()
  const props = ORDER.filter((p) => state.properties.includes(p))
  const groups: TaskGroup[] =
    state.group === "none" ? [{ key: "all", label: t("board.allTasks"), epicId: null, tasks }] : groupTasks(tasks, state.group)
  // Groups whose tasks are all done start collapsed; the user's toggles override.
  const [toggled, setToggled] = useState<Record<string, boolean>>({})
  const today = localToday()

  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border border-border px-4 py-12 text-center">
        <p className="text-sm text-txt">{t("board.noMatch")}</p>
        <p className="mt-1 text-xs text-muted">{t("board.noMatchHint")}</p>
      </div>
    )
  }

  const colCount = 3 + props.length
  const allPicked = tasks.every((t) => selected.has(t.id))
  const somePicked = !allPicked && tasks.some((t) => selected.has(t.id))
  const hideSm = (p: PropertyKey) => (WIDE_ONLY.has(p) ? "hidden md:table-cell" : "")

  const header = (key: string, label: string, extra = "") => {
    const idx = state.sorts.findIndex((s) => s.prop === key)
    const rule = idx >= 0 ? state.sorts[idx] : null
    if (!SORTABLE.has(key)) {
      return <th key={key} scope="col" className={cn("px-2.5 text-left font-medium", extra)}>{label}</th>
    }
    const Arrow = rule?.dir === "desc" ? ArrowDown : ArrowUp
    return (
      <th
        key={key}
        scope="col"
        aria-sort={idx === 0 ? (rule?.dir === "desc" ? "descending" : "ascending") : "none"}
        className={cn("px-1 text-left font-medium", extra)}
      >
        <button
          type="button"
          title={t("board.sortHint")}
          onClick={(e) => onSort(nextSorts(state.sorts, key as SortProp, e.shiftKey))}
          className={cn(
            "inline-flex h-7 items-center gap-1 rounded-sm px-1.5 transition-colors duration-(--duration-fast) ease-out-soft hover:bg-surface2 hover:text-txt",
            rule && "text-txt",
            ring,
          )}
        >
          {label}
          {rule && (
            <>
              <Arrow className="size-3" aria-hidden />
              <span className="font-mono text-[10px] text-muted">{idx + 1}</span>
            </>
          )}
        </button>
      </th>
    )
  }

  const cell = (task: Task, p: PropertyKey) => {
    const cls = cn("px-2.5", hideSm(p))
    switch (p) {
      case "status": {
        return (
          <td key={p} className={cls}>
            <TaskStatusField task={task} />
          </td>
        )
      }
      case "epic": {
        const epic = epicOf(task.phase)
        return (
          <td key={p} className={cls}>
            {epic.id || epic.title ? (
              <span className="flex min-w-0 items-center gap-1.5 text-xs">
                {epic.id && <span className={cellMono}>{epic.id}</span>}
                <span className="truncate text-muted">{epic.title}</span>
              </span>
            ) : <span className={cellMono}>—</span>}
          </td>
        )
      }
      case "size":
        return <td key={p} className={cn(cls, cellMono)}><TaskSizeField task={task} /></td>
      case "owner":
        return <td key={p} className={cls}><TaskOwnerField task={task} /></td>
      case "due": {
        const overdue = !!task.due && task.status !== "done" && task.status !== "cancelled" && task.due < today
        return (
          <td key={p} className={cn(cls, cellMono)}>
            <TaskDueField task={task}><span className={cn("font-mono text-[11px]", overdue ? "text-amber" : task.due ? "text-muted" : "text-muted/70")}>{task.due ?? "—"}</span></TaskDueField>
          </td>
        )
      }
      case "deps": {
        const ids = task.dependsOn.match(/T\d+/g)
        return <td key={p} className={cn(cls, cellMono, "truncate")}>{ids ? ids.join(", ") : "—"}</td>
      }
      case "tests":
        return (
          <td key={p} className={cn(cls, cellMono)}>
            <span className="inline-flex items-center gap-1.5">
              {task.manualTests ? (
                <span data-tests-count className="inline-flex items-center gap-1">
                  <FlaskConical className="size-3" aria-hidden />
                  {task.manualTests.done}/{task.manualTests.total}
                </span>
              ) : "—"}
              <QuickReviewButton task={task} />
            </span>
          </td>
        )
      case "agent":
        return (
          <td key={p} className={cls}>
            {agentTasks.has(task.id) ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-txt">
                <Bot className="size-3.5 text-accent" aria-hidden />{t("board.working")}
              </span>
            ) : <span className={cellMono}>—</span>}
          </td>
        )
    }
  }

  const row = (task: Task) => {
    const done = task.status === "done" || task.status === "cancelled"
    return (
      <tr
        key={task.id}
        onClick={(e: MouseEvent) => {
          // The title button handles its own click (and Enter); this covers the rest of the row.
          if ((e.target as HTMLElement).closest("button")) return
          onOpenTask(task)
        }}
        className={cn(
          "h-9 cursor-pointer border-b border-border text-[13px] transition-colors duration-(--duration-fast) ease-out-soft last:border-b-0 hover:bg-surface2",
          selected.has(task.id) && "bg-accent/5",
        )}
      >
        <td className="pl-3" onClick={(e) => e.stopPropagation()}>
          {onToggleSelect && <SelectBox label={t("board.selectId", { id: task.id })} checked={selected.has(task.id)} onChange={() => onToggleSelect([task.id])} />}
        </td>
        <td className={cn("px-2.5", cellMono)}>{task.id}</td>
        <td className="min-w-0 px-1">
          <button
            type="button"
            onClick={() => onOpenTask(task)}
            title={task.title}
            className={cn("block w-full truncate rounded-sm px-1.5 py-1 text-left font-medium", done ? "text-muted" : "text-txt", ring)}
          >
            {task.title}
          </button>
        </td>
        {props.map((p) => cell(task, p))}
      </tr>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[580px] table-fixed border-collapse md:min-w-[760px]">
        <colgroup>
          <col className="w-[34px]" />
          <col className="w-[72px]" />
          <col className="w-[200px] md:w-auto" />
          {props.map((p) => <col key={p} className={cn(WIDTH[p], WIDE_ONLY.has(p) && "hidden md:table-column")} />)}
        </colgroup>
        <thead>
          <tr className="h-[34px] border-b border-border2 bg-bg text-[11px] text-muted">
            <th scope="col" className="pl-3 text-left">
              {onToggleSelect && <SelectBox
                label={t("board.selectAllShown")}
                checked={allPicked}
                mixed={somePicked}
                onChange={() => onToggleSelect(tasks.map((t) => t.id), !allPicked)}
              />}
            </th>
            {header("id", t("board.id"))}
            {header("title", t("board.title"))}
            {props.map((p) => header(p, t(LABEL[p]), hideSm(p)))}
          </tr>
        </thead>
        {groups.map((g) => {
          const doneCount = g.tasks.filter((t) => t.status === "done").length
          const allDone = g.tasks.length > 0 && g.tasks.every((t) => t.status === "done" || t.status === "cancelled")
          const open = state.group === "none" || (toggled[g.key] ?? !allDone)
          return (
            <tbody key={g.key}>
              {state.group !== "none" && (
                <tr className="h-[38px] border-b border-border bg-surface">
                  <th scope="rowgroup" colSpan={colCount} className="p-0 text-left font-normal">
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setToggled((s) => ({ ...s, [g.key]: !open }))}
                      className={cn("flex h-[38px] w-full items-center gap-2.5 px-2 text-left transition-colors duration-(--duration-fast) ease-out-soft hover:bg-surface2", ring)}
                    >
                      <ChevronRight
                        className={cn("size-3.5 shrink-0 text-muted transition-transform duration-(--duration-fast) ease-out-soft", open && "rotate-90")}
                        aria-hidden
                      />
                      {g.epicId && <span className={cellMono}>{g.epicId}</span>}
                      <span className="min-w-0 truncate text-[13px] font-semibold text-txt">{g.label}</span>
                      <span className="flex w-[110px] shrink-0 gap-0.5" aria-hidden>
                        {g.tasks.map((t) => <span key={t.id} className={cn("h-1 flex-1 rounded-full", MARK_BG[t.status])} />)}
                      </span>
                      <span className={cellMono}>
                        <span className="text-txt">{doneCount}</span>/{g.tasks.length}
                      </span>
                    </button>
                  </th>
                </tr>
              )}
              {open && g.tasks.map(row)}
            </tbody>
          )
        })}
      </table>
    </div>
  )
}

/** Selection checkbox drawn like the Manual tests boxes, in the accent (selected, not done). */
function SelectBox({ label, checked, mixed = false, onChange }: { label: string; checked: boolean; mixed?: boolean; onChange: () => void }) {
  return (
    <span className="relative inline-flex size-4 align-middle">
      <input
        type="checkbox"
        aria-label={label}
        checked={checked}
        ref={(el) => { if (el) el.indeterminate = mixed }}
        onChange={onChange}
        className={cn(
          "peer size-4 cursor-pointer appearance-none rounded-sm border border-muted bg-bg transition-colors duration-(--duration-fast)",
          "checked:border-accent checked:bg-accent hover:border-txt focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          mixed && "border-accent",
        )}
      />
      {mixed
        ? <Minus strokeWidth={3} className="pointer-events-none absolute inset-0.5 size-3 text-accent" aria-hidden />
        : <Check strokeWidth={3} className="pointer-events-none absolute inset-0.5 size-3 text-accent-fg opacity-0 peer-checked:opacity-100" aria-hidden />}
    </span>
  )
}
