import { Bot, User, FilePen, FilePlus, FileSearch, FileText, FileX, ListChecks, Map as MapIcon, Plug, RefreshCw, Scale, Brain, type LucideIcon } from "lucide-react"
import type { ActivityEvent } from "@/types"
import { StatusIcon, useStatusMeta } from "@/components/shared/StatusIcon"
import { eventAction, eventTarget, type EventAction, type EventTarget } from "@/lib/activity"
import { cn } from "@/lib/utils"

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

const ACTION_TONE: Partial<Record<EventAction, string>> = {
  created: "border-teal/30 bg-teal/5 text-teal",
  restored: "border-teal/30 bg-teal/5 text-teal",
  deleted: "border-danger/30 bg-danger/5 text-danger",
}
const badge = "inline-flex shrink-0 items-center rounded-sm border px-1.5 py-0.5 text-[10px] leading-none font-medium"

/** The verb of an event; a task move shows the status it landed in. */
function ActionBadge({ event }: { event: ActivityEvent }) {
  const action = eventAction(event)
  if (action === "moved" && event.taskStatus) return <MovedBadge status={event.taskStatus} />
  return <span className={cn(badge, ACTION_TONE[action] ?? "border-border2 text-muted")}>{action}</span>
}

function MovedBadge({ status }: { status: string }) {
  const meta = useStatusMeta(status)
  return <span className={cn(badge, meta.chip)}>→ {meta.label}</span>
}

/** One line per event: clock · kind icon · verb badge · what happened (clickable when it points at something that still exists). */
export function ActivityEventRow({ event, showActor = false, onOpen }: {
  event: ActivityEvent
  showActor?: boolean
  onOpen?: (target: EventTarget) => void
}) {
  const Icon = TYPE_ICON[event.type] ?? FileText
  const target = onOpen ? eventTarget(event) : null
  const titleClass = "min-w-0 text-left text-sm leading-5 text-txt sm:shrink-0 sm:max-w-[60%] sm:truncate"
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
        <span className="flex min-w-0 items-baseline gap-2 sm:contents">
          <ActionBadge event={event} />
          {target && onOpen ? (
            <button
              type="button"
              onClick={() => onOpen(target)}
              className={cn(titleClass, "rounded-sm underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60")}
            >
              {event.title}
            </button>
          ) : (
            <span className={titleClass}>{event.title}</span>
          )}
        </span>
        {event.detail && <span className="min-w-0 truncate text-xs leading-5 text-muted">{event.detail}</span>}
        {showActor && (
          <span className="flex shrink-0 items-center gap-1 font-mono text-[10px] text-muted sm:ml-auto">
            {event.actor === "human"
              ? <><User className="size-3" aria-hidden />you</>
              : <><Bot className="size-3" aria-hidden />AI</>}
          </span>
        )}
      </div>
    </div>
  )
}
