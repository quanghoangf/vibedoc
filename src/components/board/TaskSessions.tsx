"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Bot, User } from "lucide-react"
import { useApp } from "@/context/AppContext"
import { useFormat, useT } from "@/context/LanguageContext"
import { useSessionHeadline } from "@/components/activity/session-text"
import type { Session } from "@/types"

// Sessions that moved this task; mount with key={taskId} so state resets per task.
export function TaskSessions({ taskId, onNavigate }: { taskId: string; onNavigate: () => void }) {
  const { rootParam } = useApp()
  const f = useFormat()
  const { t } = useT()
  const headline = useSessionHeadline()
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
      <p className="mb-2 text-xs font-mono uppercase tracking-wide text-muted">{t("board.sessions")}</p>
      {sessions === null ? null : sessions.length === 0 ? (
        <p className="text-xs text-muted">{t("board.noSessions")}</p>
      ) : (
        <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
          {sessions.map(s => (
            <button
              key={s.id}
              onClick={() => { onNavigate(); router.push(`/activity?session=${encodeURIComponent(s.id)}`) }}
              className="flex items-center gap-2 rounded-sm px-2 py-1 text-left text-xs hover:bg-surface2"
            >
              {s.actor === "ai" ? <Bot aria-hidden className="size-3.5 shrink-0 text-muted" /> : <User aria-hidden className="size-3.5 shrink-0 text-muted" />}
              <span className="sr-only">{s.actor === "ai" ? t("board.agentSession") : t("board.humanSession")}</span>
              <span className="shrink-0 font-mono text-muted">{f.timeAgo(s.start)}</span>
              <span className="truncate text-txt">{headline(s)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
