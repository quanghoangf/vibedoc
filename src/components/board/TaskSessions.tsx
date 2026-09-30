"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Bot, User } from "lucide-react"
import { useApp } from "@/context/AppContext"
import { timeAgo } from "@/components/activity/ActivityEventRow"
import type { Session } from "@/types"

// Sessions that moved this task; mount with key={taskId} so state resets per task.
export function TaskSessions({ taskId, onNavigate }: { taskId: string; onNavigate: () => void }) {
  const { rootParam } = useApp()
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[] | null>(null)

  useEffect(() => {
    const qs = rootParam ? `${rootParam}&` : "?"
    fetch(`/api/sessions${qs}taskId=${encodeURIComponent(taskId)}`)
      .then(r => r.json())
      .then(data => setSessions(Array.isArray(data) ? data : []))
      .catch(() => setSessions([]))
  }, [rootParam, taskId])

  return (
    <div className="px-5 py-3 border-b border-border shrink-0">
      <p className="mb-2 text-xs font-mono uppercase tracking-wide text-muted">Sessions</p>
      {sessions === null ? null : sessions.length === 0 ? (
        <p className="text-xs text-muted">No recorded sessions</p>
      ) : (
        <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
          {sessions.map(s => (
            <button
              key={s.id}
              onClick={() => { onNavigate(); router.push(`/activity?session=${encodeURIComponent(s.id)}`) }}
              className="flex items-center gap-2 rounded-sm px-2 py-1 text-left text-xs hover:bg-surface2"
            >
              {s.actor === "ai" ? <Bot aria-hidden className="size-3.5 shrink-0 text-muted" /> : <User aria-hidden className="size-3.5 shrink-0 text-muted" />}
              <span className="sr-only">{s.actor === "ai" ? "Agent session" : "Human session"}</span>
              <span className="shrink-0 font-mono text-muted">{timeAgo(s.start)}</span>
              <span className="truncate text-txt">{s.headline}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
