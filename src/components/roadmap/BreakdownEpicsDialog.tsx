"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { askAgent } from "@/lib/ask-agent"
import { MAX_RUNNING_CHATS } from "@/lib/chats"
import { useChats } from "@/context/ChatContext"
import type { RoadmapItem } from "@/types"

interface BreakdownEpicsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: RoadmapItem[]
}

/** Not-done epics grouped by horizon (spine order); within a horizon, epics with no tasks first. */
function epicGroups(items: RoadmapItem[]) {
  const byOrder = (a: RoadmapItem, b: RoadmapItem) => a.order - b.order
  return items
    .filter((i) => i.parent === null)
    .sort(byOrder)
    .map((h) => ({
      horizon: h,
      epics: items
        .filter((i) => i.parent === h.id && i.status !== "done")
        .sort((a, b) => Number(a.tasks.length > 0) - Number(b.tasks.length > 0) || byOrder(a, b)),
    }))
    .filter((g) => g.epics.length > 0)
}

/** Tick several epics → one breakdown chat per epic, all running at once (capped by free agent slots). */
export function BreakdownEpicsDialog({ open, onOpenChange, items }: BreakdownEpicsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-surface border-border text-txt">
        <DialogTitle className="text-sm font-semibold text-txt">Break down epics</DialogTitle>
        {/* Mounted only while open, so the default selection is recomputed on every open */}
        <BreakdownForm items={items} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function BreakdownForm({ items, onDone }: { items: RoadmapItem[]; onDone: () => void }) {
  const groups = epicGroups(items)
  const [checked, setChecked] = useState(
    () => new Set(groups.flatMap((g) => g.epics.filter((e) => e.tasks.length === 0).map((e) => e.id))),
  )
  const running = useChats().runningCount
  const free = Math.max(0, MAX_RUNNING_CHATS - running)
  const over = checked.size > free

  function toggle(id: string) {
    setChecked((s) => {
      const next = new Set(s)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!checked.size || over) return
    onDone()
    // Spine order, same message as the single-epic "Break down with agent"
    for (const g of groups) for (const epic of g.epics) {
      if (checked.has(epic.id)) askAgent(`Break down epic ${epic.id} into tasks.`, { newChat: true })
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="max-h-[50vh] overflow-y-auto rounded-md border border-border">
        {groups.map((g) => (
          <div key={g.horizon.id}>
            <div className="sticky top-0 bg-surface2 px-3 py-1 text-[10px] font-mono uppercase tracking-widest text-muted">
              {g.horizon.id} · {g.horizon.title}
            </div>
            <ul>
              {g.epics.map((epic) => {
                const on = checked.has(epic.id)
                return (
                  <li key={epic.id} className="border-b border-border last:border-b-0">
                    <label className="flex items-start gap-2 px-3 py-1.5 text-xs cursor-pointer has-[:disabled]:cursor-not-allowed">
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={!on && checked.size >= free}
                        onChange={() => toggle(epic.id)}
                        className="mt-0.5 accent-accent"
                      />
                      <span className="flex-1 min-w-0 text-txt">
                        <span className="font-mono text-muted mr-1">{epic.id}</span>{epic.title}
                      </span>
                      {epic.tasks.length > 0 && (
                        <span className="shrink-0 text-[10px] font-mono text-muted">has {epic.tasks.length} task{epic.tasks.length === 1 ? "" : "s"}</span>
                      )}
                    </label>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
      <p className={over || free === 0 ? "text-xs text-amber" : "text-xs text-muted"}>
        {free === 0
          ? `All ${MAX_RUNNING_CHATS} agent slots are busy. Stop a chat or wait for one to finish.`
          : over
            ? `${checked.size} selected, but only ${free} of ${MAX_RUNNING_CHATS} agent slots ${free === 1 ? "is" : "are"} free (${running} running). Uncheck some or stop a chat.`
            : `One chat per epic, running at once (${free} of ${MAX_RUNNING_CHATS} agent slots free). Each shows a plan before writing anything.`}
      </p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={!checked.size || over} className="bg-accent text-white hover:bg-accent/90">
          Break down {checked.size || ""} epic{checked.size === 1 ? "" : "s"}
        </Button>
      </div>
    </form>
  )
}
