import type { ActivityEvent } from "@/types"

const ACTIVITY_ICONS: Record<string, string> = {
  task_updated: "🔨",
  decision_logged: "📝",
  memory_updated: "🧠",
  doc_read: "📄",
  session_start: "🤖",
}

function timeAgo(ts: string): string {
  const d = (Date.now() - new Date(ts).getTime()) / 1000
  if (d < 60) return "just now"
  if (d < 3600) return `${Math.floor(d / 60)}m ago`
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`
  return `${Math.floor(d / 86400)}d ago`
}

interface ActivityEventRowProps {
  event: ActivityEvent
}

export function ActivityEventRow({ event }: ActivityEventRowProps) {
  return (
    <div className="flex gap-4 pb-4 animate-fade-in">
      <div className="relative flex-shrink-0 w-8 h-8 rounded-full bg-surface2 border border-border flex items-center justify-center text-sm z-10">
        {ACTIVITY_ICONS[event.type] || "•"}
      </div>
      <div className="flex-1 pt-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium text-txt">{event.title}</span>
          {event.actor === "ai" && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-accent/10 text-accent border border-accent/20 font-mono">
              AI
            </span>
          )}
        </div>
        {event.detail && (
          <p className="text-xs text-muted truncate">{event.detail}</p>
        )}
        <p className="text-xs text-muted/60 mt-0.5 font-mono">{timeAgo(event.timestamp)}</p>
      </div>
    </div>
  )
}
