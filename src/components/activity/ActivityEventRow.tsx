import { User, FilePen, FilePlus, FileSearch, FileText, FileX, ListChecks, Map as MapIcon, Plug, RefreshCw, Scale, Brain, type LucideIcon } from "lucide-react"
import type { ActivityEvent } from "@/types"
import { StatusIcon } from "@/components/shared/StatusIcon"

const TYPE_ICON: Record<ActivityEvent["type"], LucideIcon> = {
  task_updated: ListChecks,
  decision_logged: Scale,
  memory_updated: Brain,
  doc_read: FileSearch,
  doc_created: FilePlus,
  doc_updated: FileText,
  doc_deleted: FileX,
  doc_renamed: FilePen,
  session_start: Plug,
  registry_rebuilt: RefreshCw,
  roadmap_updated: MapIcon,
}

export function timeAgo(ts: string): string {
  const d = (Date.now() - new Date(ts).getTime()) / 1000
  if (d < 60) return "just now"
  if (d < 3600) return `${Math.floor(d / 60)}m ago`
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`
  return `${Math.floor(d / 86400)}d ago`
}

export const clock = (ts: string) => new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })

/** One line per event: clock · what kind · what happened. A task move shows its new status icon. */
export function ActivityEventRow({ event, showActor = false }: { event: ActivityEvent; showActor?: boolean }) {
  const Icon = TYPE_ICON[event.type] ?? FileText
  return (
    <div className="grid grid-cols-[2.75rem_1.5rem_minmax(0,1fr)] items-start py-1.5">
      <time dateTime={event.timestamp} title={new Date(event.timestamp).toLocaleString()} className="pt-px text-right font-mono text-[11px] leading-5 text-muted tabular-nums">
        {clock(event.timestamp)}
      </time>
      <span className="flex justify-center pt-[3px]">
        {event.type === "task_updated" && event.taskStatus
          ? <StatusIcon status={event.taskStatus} />
          : <Icon className="size-3.5 text-muted" aria-hidden />}
      </span>
      <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
        <span className="min-w-0 text-sm leading-5 text-txt sm:shrink-0 sm:max-w-[60%] sm:truncate">{event.title}</span>
        {event.detail && <span className="min-w-0 truncate text-xs leading-5 text-muted">{event.detail}</span>}
        {/* Agents write almost everything, so only your own changes get a tag */}
        {showActor && event.actor === "human" && (
          <span className="flex shrink-0 items-center gap-1 font-mono text-[10px] text-muted sm:ml-auto">
            <User className="size-3" aria-hidden />you
          </span>
        )}
      </div>
    </div>
  )
}
