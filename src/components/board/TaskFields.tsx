"use client"

import type { ReactNode } from "react"
import { useApp } from "@/context/AppContext"
import { InlineDate, InlineSelect, type InlineOption } from "@/components/shared/InlineProperty"
import { OwnerChip } from "@/components/shared/OwnerChip"
import { StatusChip, StatusIcon } from "@/components/shared/StatusIcon"
import { useStatusDefs } from "@/components/shared/status-defs"
import { displayStatus } from "@/lib/statuses"
import { sizeOf } from "@/lib/board-views"
import { ownerLabel } from "@/lib/owner"
import type { Task } from "@/types"

// Task properties edited in place (R055): the table, the card and the panel header all use these.

const SIZES = ["XS", "S", "M", "L", "XL"]
const empty = <span className="text-muted">—</span>

export function TaskStatusField({ task, chip = false }: { task: Task; chip?: boolean }) {
  const { moveTask } = useApp()
  const defs = useStatusDefs()
  const key = displayStatus(task)
  const options: InlineOption[] = defs.map((d) => ({ value: d.id, label: d.label, node: <><StatusIcon status={d.id} />{d.label}</> }))
  return (
    <InlineSelect label={`Status of ${task.id}`} value={key} options={options} onChange={(v) => moveTask(task.id, v)}>
      {chip ? <StatusChip status={key} /> : <><StatusIcon status={key} /><span className="truncate text-xs">{defs.find((d) => d.id === key)?.label ?? key}</span></>}
    </InlineSelect>
  )
}

export function TaskOwnerField({ task, children }: { task: Task; children?: ReactNode }) {
  const { updateTaskFields, board } = useApp()
  // Human, every agent that owns something here (claude always offered), and no owner
  const agents = [...new Set(["ai:claude", ...Object.values(board ?? {}).flat().map((t) => t.owner).filter((o): o is string => !!o?.startsWith("ai:"))])].sort()
  const options: InlineOption[] = [
    { value: "human", label: "Human", node: <OwnerChip owner="human" className="text-xs" /> },
    ...agents.map((a) => ({ value: a, label: ownerLabel(a), node: <OwnerChip owner={a} className="text-xs" /> })),
    { value: "", label: "No owner", node: <span className="text-muted">No owner</span> },
  ]
  return (
    <InlineSelect label={`Owner of ${task.id}`} value={task.owner ?? ""} options={options} onChange={(v) => updateTaskFields(task.id, { owner: v || null })}>
      {children ?? (task.owner ? <OwnerChip owner={task.owner} className="text-xs" /> : empty)}
    </InlineSelect>
  )
}

export function TaskSizeField({ task, children }: { task: Task; children?: ReactNode }) {
  const { updateTaskFields } = useApp()
  const size = sizeOf(task)
  const options: InlineOption[] = [...SIZES.map((s) => ({ value: s, label: s, node: <span className="font-mono">{s}</span> })), { value: "", label: "No size", node: <span className="text-muted">No size</span> }]
  return (
    <InlineSelect label={`Size of ${task.id}`} value={size ?? ""} options={options} onChange={(v) => updateTaskFields(task.id, { size: v || "—" })}>
      {children ?? (size ? <span className="font-mono text-xs">{size}</span> : empty)}
    </InlineSelect>
  )
}

export function TaskDueField({ task, children }: { task: Task; children?: ReactNode }) {
  const { updateTaskFields } = useApp()
  return (
    <InlineDate label={`Due date of ${task.id}`} value={task.due} onChange={(v) => updateTaskFields(task.id, { due: v })}>
      {children ?? (task.due ? <span className="font-mono text-xs">{task.due}</span> : empty)}
    </InlineDate>
  )
}
