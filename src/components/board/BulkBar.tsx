"use client"

import { useEffect, useState } from "react"
import { ChevronUp, FolderInput, Trash2, X } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { StatusIcon } from "@/components/shared/StatusIcon"
import { useStatusDefs } from "@/components/shared/status-defs"
import { toast, undoToast } from "@/components/ui/toast"
import { useApp } from "@/context/AppContext"
import type { RoadmapItem, Task } from "@/types"
import { useItemCommands } from "@/components/shared/item-commands"
import { useStatusLabel } from "@/components/shared/StatusIcon"
import { tNow, useT } from "@/context/LanguageContext"


async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(json?.error ?? tNow("board.requestFailed", { status: res.status }))
  return json as T
}

const pill = "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs text-txt hover:bg-surface transition-colors"

/** Floating bar for the selected tasks: status, epic, delete (one request, one refresh). */
export function BulkBar({ ids, onClear }: { ids: string[]; onClear: () => void }) {
  const { rootParam } = useApp()
  const [epics, setEpics] = useState<RoadmapItem[]>([])
  const [busy, setBusy] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const defs = useStatusDefs()
  const label = useStatusLabel()
  const { t, tn } = useT()

  useEffect(() => {
    fetch(`/api/roadmap${rootParam}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { items?: RoadmapItem[] } | null) => setEpics((d?.items ?? []).filter((i) => i.parent !== null && i.status !== "done")))
      .catch(() => setEpics([]))
  }, [rootParam])

  async function run(action: unknown, after?: (r: { deleted: { task: Task; links: unknown[] }[] }) => void) {
    setBusy(true)
    try {
      const r = await post<{ deleted: { task: Task; links: unknown[] }[] }>(`/api/tasks/bulk${rootParam}`, { ids, action })
      onClear()
      after?.(r)
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const remove = () => run({ delete: true }, ({ deleted }) => {
    undoToast(tn("board.deletedTasks", deleted.length), async () => {
      // Reverse order: each delete recorded its index after the earlier ones were already gone
      for (const { task, links } of [...deleted].reverse()) {
        await post(`/api/tasks/restore${rootParam}`, { file: task.file, raw: task.raw, links })
      }
    })
  })

  useItemCommands(tn("board.selectedTasks", ids.length), [
    { action: "status", label: t("board.changeStatus"), run: () => setStatusOpen(true) },
    { action: "remove", label: tn("board.deleteTasks", ids.length), run: remove },
  ])

  return (
    <div
      role="toolbar"
      aria-label={t("board.bulkActions")}
      className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 animate-slide-in items-center gap-1 rounded-lg border border-border bg-surface2 p-1 pl-3 shadow-xl"
    >
      <span className="mr-1 font-mono text-xs tabular-nums text-txt">{t("board.selectedCount", { n: ids.length })}</span>
      <DropdownMenu open={statusOpen} onOpenChange={setStatusOpen}>
        <DropdownMenuTrigger asChild>
          <button type="button" disabled={busy} className={pill}>{t("board.status")} <ChevronUp className="size-3.5 text-muted" /></button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" className="w-44">
          {defs.map((d) => (
            <DropdownMenuItem key={d.id} onSelect={() => run({ status: d.id })}>
              <StatusIcon status={d.id} /> {label(d.id)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" disabled={busy} className={pill}><FolderInput className="size-3.5 text-muted" /> {t("board.epic")} <ChevronUp className="size-3.5 text-muted" /></button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" className="max-h-72 w-64 overflow-y-auto">
          {epics.map((e) => (
            <DropdownMenuItem key={e.id} onSelect={() => run({ epic: e.id })}>
              <span className="font-mono text-[11px] text-muted">{e.id}</span> <span className="truncate">{e.title}</span>
            </DropdownMenuItem>
          ))}
          {epics.length > 0 && <DropdownMenuSeparator />}
          <DropdownMenuItem onSelect={() => run({ epic: null })}>{t("board.noEpic")}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <button type="button" disabled={busy} onClick={remove} className={`${pill} text-danger hover:text-danger`}>
        <Trash2 className="size-3.5" /> {t("board.delete")}
      </button>
      <button type="button" aria-label={t("board.clearSelection")} onClick={onClear} className="grid size-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-txt">
        <X className="size-4" />
      </button>
    </div>
  )
}
