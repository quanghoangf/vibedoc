"use client"

import type { ReactNode } from "react"
import { Minus } from "lucide-react"
import { useApp } from "@/context/AppContext"
import { InlineDate, InlineSelect, type InlineOption } from "@/components/shared/InlineProperty"
import { OwnerChip } from "@/components/shared/OwnerChip"
import { StatusChip, StatusIcon, useStatusLabel } from "@/components/shared/StatusIcon"
import { PriorityField } from "@/components/shared/PriorityBadge"
import { useStatusDefs } from "@/components/shared/status-defs"
import { displayStatus } from "@/lib/statuses"
import { sizeOf } from "@/lib/board-views"
import { ownerLabel } from "@/lib/owner"
import type { Task } from "@/types"
import { useT } from "@/context/LanguageContext"

// Task properties edited in place (R055): the table, the card and the panel header all use these.

const SIZES = ["XS", "S", "M", "L", "XL"]
const empty = <span className="font-mono text-[11px] text-muted">—</span>
const none = (label: string) => <span className="inline-flex items-center gap-1 text-xs text-muted"><Minus className="size-3.5" aria-hidden />{label}</span>

export function TaskStatusField({ task, chip = false }: { task: Task; chip?: boolean }) {
  const { moveTask } = useApp()
  const { t } = useT()
  const defs = useStatusDefs()
  const label = useStatusLabel()
  const key = displayStatus(task)
  const options: InlineOption[] = defs.map((d) => ({ value: d.id, label: label(d.id), node: <><StatusIcon status={d.id} />{label(d.id)}</> }))
  return (
    <InlineSelect label={t("board.statusOf", { id: task.id })} value={key} options={options} onChange={(v) => moveTask(task.id, v)}>
      {chip ? <StatusChip status={key} /> : <><StatusIcon status={key} /><span className="truncate text-xs">{label(key)}</span></>}
    </InlineSelect>
  )
}

export function TaskOwnerField({ task, children }: { task: Task; children?: ReactNode }) {
  const { updateTaskFields, board } = useApp()
  const { t } = useT()
  // Human, every agent that owns something here (claude always offered), and no owner
  const agents = [...new Set(["ai:claude", ...Object.values(board ?? {}).flat().map((t) => t.owner).filter((o): o is string => !!o?.startsWith("ai:"))])].sort()
  const options: InlineOption[] = [
    { value: "human", label: t("board.human"), node: <OwnerChip owner="human" className="text-xs" /> },
    ...agents.map((a) => ({ value: a, label: ownerLabel(a), node: <OwnerChip owner={a} className="text-xs" /> })),
    { value: "", label: t("board.noOwner"), node: none(t("board.noOwner")) },
  ]
  return (
    <InlineSelect label={t("board.ownerOf", { id: task.id })} value={task.owner ?? ""} options={options} onChange={(v) => updateTaskFields(task.id, { owner: v || null })}>
      {children ?? (task.owner ? <OwnerChip owner={task.owner} className="text-xs" /> : empty)}
    </InlineSelect>
  )
}

export function TaskSizeField({ task, children }: { task: Task; children?: ReactNode }) {
  const { updateTaskFields } = useApp()
  const { t } = useT()
  const size = sizeOf(task)
  const options: InlineOption[] = [...SIZES.map((s) => ({ value: s, label: s, node: <span className="font-mono">{s}</span> })), { value: "", label: t("board.noSize"), node: none(t("board.noSize")) }]
  return (
    <InlineSelect label={t("board.sizeOf", { id: task.id })} value={size ?? ""} options={options} onChange={(v) => updateTaskFields(task.id, { size: v || "—" })}>
      {children ?? (size ? <span className="font-mono text-xs">{size}</span> : empty)}
    </InlineSelect>
  )
}

export function TaskPriorityField({ task }: { task: Task }) {
  const { updateTaskFields } = useApp()
  const { t } = useT()
  return <PriorityField label={t("board.priorityOf", { id: task.id })} value={task.priority ?? null} onChange={(priority) => updateTaskFields(task.id, { priority })} empty={empty} />
}

export function TaskDueField({ task, children }: { task: Task; children?: ReactNode }) {
  const { updateTaskFields } = useApp()
  const { t } = useT()
  return (
    <InlineDate label={t("board.dueOf", { id: task.id })} value={task.due} onChange={(v) => updateTaskFields(task.id, { due: v })}>
      {children ?? (task.due ? <span className="font-mono text-xs">{task.due}</span> : empty)}
    </InlineDate>
  )
}
