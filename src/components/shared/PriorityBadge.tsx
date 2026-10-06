"use client"

import { cn } from "@/lib/utils"
import { PRIORITIES, type Priority } from "@/lib/doc-priority"
import { InlineSelect } from "./InlineProperty"
import { useT } from "@/context/LanguageContext"

// Colour only where it asks for attention: P0 red, P1 amber, P2/P3 stay neutral.
const TONE: Record<Priority, string> = {
  P0: "bg-danger/12 text-danger",
  P1: "bg-amber/12 text-amber",
  P2: "bg-surface2 text-txt",
  P3: "bg-surface2 text-muted",
}

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  return (
    <span className={cn("inline-flex h-4 shrink-0 items-center rounded-sm px-1 font-mono text-[10px] font-medium leading-none", TONE[priority], className)}>
      {priority}
    </span>
  )
}


/** P0–P3 picker for any item (task, epic, doc); "" in the menu clears it. */
export function PriorityField({ label, value, onChange, empty }: {
  label: string
  value: Priority | null
  onChange: (value: Priority | null) => void
  /** Shown when unset */
  empty?: React.ReactNode
}) {
  const { t } = useT()
  const options = [
    ...PRIORITIES.map((p) => ({ value: p, label: p, node: <PriorityBadge priority={p} /> })),
    { value: "", label: t("board.noPriority"), node: <span className="text-muted">{t("board.noPriority")}</span> },
  ]
  return (
    <InlineSelect label={label} value={value ?? ""} options={options} onChange={(v) => onChange((v || null) as Priority | null)}>
      {value ? <PriorityBadge priority={value} /> : (empty ?? <span className="text-muted">—</span>)}
    </InlineSelect>
  )
}
