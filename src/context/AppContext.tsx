"use client"

import { resolveStatus, statusDefs } from "@/lib/statuses"
import { getStatusDefs, setStatusDefs } from "@/components/shared/status-defs"
import { toast } from "@/components/ui/toast"
import { tNow } from "@/context/LanguageContext"
import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react"
import { flushSync } from "react-dom"
import { useRouter } from "next/navigation"
import type { Task, TaskBoard, ActivityEvent, Project } from "@/lib/core"
import type { Summary, SelectedDoc } from "@/types"
import type { Priority } from "@/lib/doc-priority"
import { DEFAULT_SETTINGS, type AppSettings } from "@/lib/settings"

/** The SSE link to /api/events. EventSource retries on its own, so "disconnected" means "retrying". */
export type Connection = "connecting" | "live" | "disconnected"

interface AppContextValue {
  projects: Project[]
  activeProject: string
  summary: Summary | null
  /** Read-only demo (VIBEDOC_DEMO=1, from /api/summary): hide every write control (R042) */
  demo: boolean
  /** `vibedoc --demo` (VIBEDOC_PLAYGROUND=1, R085): a writable throwaway copy of the sample project */
  playground: boolean
  board: TaskBoard | null
  activity: ActivityEvent[]
  liveIndicator: boolean
  connection: Connection
  loading: boolean
  selectedDoc: SelectedDoc | null
  setSelectedDoc: (doc: SelectedDoc | null) => void
  rootParam: string
  onProjectChange: (root: string) => void
  refresh: (root?: string) => Promise<void>
  moveTask: (taskId: string, status: string) => Promise<void>
  /** Optimistic owner / due / size edit (R055); rolls back with a toast when the write fails */
  updateTaskFields: (taskId: string, patch: { owner?: string | null; due?: string | null; size?: string; priority?: Priority | null }) => Promise<void>
  /** `link`: a raw link target in the doc to scroll to and flash once it renders (`?link=`). */
  openDoc: (path: string, link?: string) => Promise<void>
  editorSettings: AppSettings["editor"]
  setEditorSettings: (s: AppSettings["editor"]) => void
  autoRefreshSeconds: number
  setAutoRefreshSeconds: (n: number) => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error("useApp must be used inside AppProvider")
  return ctx
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [activeProject, setActiveProject] = useState<string>("")
  const [summary, setSummary] = useState<Summary | null>(null)
  const [board, setBoard] = useState<TaskBoard | null>(null)
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [liveIndicator, setLiveIndicator] = useState(false)
  const [connection, setConnection] = useState<Connection>("connecting")
  const [selectedDoc, setSelectedDoc] = useState<SelectedDoc | null>(null)
  const [editorSettings, setEditorSettings] = useState<AppSettings["editor"]>(DEFAULT_SETTINGS.editor)
  const [autoRefreshSeconds, setAutoRefreshSeconds] = useState(0)
  const sseRef = useRef<EventSource | null>(null)

  // Always a query string, so callers can append `&key=…` even before a project loads ("?&read=x" is valid)
  const rootParam = activeProject ? `?root=${encodeURIComponent(activeProject)}` : "?"

  const refresh = useCallback(async (root?: string) => {
    const r = root || activeProject
    if (!r) return
    const rp = `?root=${encodeURIComponent(r)}`
    try {
      const [sumRes, boardRes, actRes, settingsRes] = await Promise.all([
        fetch(`/api/summary${rp}`).then((r) => r.json()),
        fetch(`/api/tasks${rp}`).then((r) => r.json()),
        fetch(`/api/activity${rp}&limit=30`).then((r) => r.json()),
        fetch(`/api/settings${rp}&type=settings`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ])
      setStatusDefs(statusDefs(settingsRes?.statuses))
      setSummary(sumRes)
      const rawBoard = boardRes?.board
      setBoard(rawBoard && typeof rawBoard === 'object' ? {
        todo: rawBoard.todo ?? [],
        'in-progress': rawBoard['in-progress'] ?? [],
        review: rawBoard.review ?? [],
        blocked: rawBoard.blocked ?? [],
        paused: rawBoard.paused ?? [],
        done: rawBoard.done ?? [],
        cancelled: rawBoard.cancelled ?? [],
      } : null)
      setActivity(Array.isArray(actRes) ? actRes : [])
    } catch (e) {
      // Keep the last good state on screen; the next SSE event or refresh retries
      console.error("[vibedoc] refresh failed:", e)
    }
    setLoading(false)
  }, [activeProject])

  // Load projects on mount
  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((p: Project[]) => {
        setProjects(p)
        if (p.length > 0) {
          setActiveProject(p[0].root)
          refresh(p[0].root)
        } else {
          setLoading(false)
        }
      })
      .catch((e) => {
        console.error("[vibedoc] could not load projects:", e)
        setLoading(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // SSE for real-time updates
  useEffect(() => {
    if (!activeProject) return
    const es = new EventSource("/api/events")
    sseRef.current = es
    es.onopen = () => setConnection("live")
    es.onerror = () => setConnection("disconnected")

    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === "connected") return
        window.dispatchEvent(new CustomEvent("vibedoc:sse", { detail: msg }))
        // Saving a chat is this tab's own bookkeeping, not a project change: don't flash "live update"
        if (msg.type === "chat_saved") return
        // R061: a Run's steps stream in (no flash); its end leaves a new run on disk, so reload the board's lastRun
        // R064: the same for the suite; each task's result arrives as task_updated, the final state refreshes too
        if (msg.type === "suite_run") {
          const phase = msg.payload?.suite?.state
          if (phase && phase !== "starting" && phase !== "running") refresh()
          return
        }
        if (msg.type === "test_run") {
          const phase = msg.payload?.state?.state
          if (phase && phase !== "starting" && phase !== "running") refresh()
          return
        }
        setLiveIndicator(true)
        setTimeout(() => setLiveIndicator(false), 2000)
        // R084: roadmap changes can tick the first-week checklist (a layout drag can't)
        const roadmapChange = msg.type === "roadmap_updated" && msg.payload?.kind !== "layout"
        if (roadmapChange || ["task_updated", "task_created", "decision_logged", "memory_updated", "session_start", "first_week_updated"].includes(msg.type)) {
          refresh()
        }
      } catch {}
    }

    // The next EventSource (project switch) starts unconfirmed: don't keep showing the old "live"
    return () => { es.close(); setConnection("connecting") }
  }, [activeProject, refresh])

  const demo = summary?.demo === true
  const playground = summary?.playground === true

  const moveTask = useCallback(async (taskId: string, status: string) => {
    if (demo) return // read-only demo: the card must not move and snap back
    // Optimistic update: move card in UI immediately, animated via View Transitions when supported
    const apply = () => setBoard(prev => {
      if (!prev) return prev
      let movedTask: Task | undefined
      const next = structuredClone(prev) as TaskBoard
      for (const col of Object.keys(next) as (keyof TaskBoard)[]) {
        const idx = next[col].findIndex(t => t.id === taskId)
        if (idx !== -1) {
          movedTask = { ...next[col][idx] }
          next[col] = next[col].filter(t => t.id !== taskId)
        }
      }
      // A custom status lands in its category's bucket, remembering the custom id
      const resolved = resolveStatus(status, getStatusDefs())
      const target = resolved.status as keyof TaskBoard
      if (movedTask) movedTask = { ...movedTask, status: resolved.status, customStatus: resolved.customStatus }
      // Insert in server order (core.listTasks sorts by file path) so refresh() doesn't reshuffle
      if (movedTask && next[target]) {
        next[target] = [...next[target], movedTask].sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0))
      }
      return next
    })
    if (typeof document !== "undefined" && "startViewTransition" in document) {
      document.startViewTransition(() => flushSync(apply))
    } else {
      apply()
    }

    try {
      const res = await fetch(`/api/tasks${rootParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, status, actor: "human" }),
      })
      if (!res.ok) toast(tNow("help.couldNotMove", { id: taskId, error: String((await res.json().catch(() => null))?.error ?? res.status) }))
    } catch {
      toast(tNow("help.couldNotMoveOffline", { id: taskId }))
    }
    refresh() // real state (also reverts a failed move)
  }, [demo, rootParam, refresh])

  const updateTaskFields = useCallback(async (taskId: string, patch: { owner?: string | null; due?: string | null; size?: string; priority?: Priority | null }) => {
    if (demo) return
    setBoard((prev) => {
      if (!prev) return prev
      const next = { ...prev }
      for (const col of Object.keys(next) as (keyof TaskBoard)[]) {
        next[col] = next[col].map((t) => (t.id === taskId ? { ...t, ...patch, size: patch.size ?? t.size } : t))
      }
      return next
    })
    try {
      const res = await fetch(`/api/tasks/update${rootParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, patch }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `HTTP ${res.status}`)
    } catch (e) {
      toast(tNow("help.couldNotUpdate", { id: taskId, error: (e as Error).message }))
      refresh() // roll back to the files
    }
  }, [demo, rootParam, refresh])

  const openDoc = useCallback(async (docPath: string, link?: string) => {
    const res = await fetch(`/api/docs${rootParam}&read=${encodeURIComponent(docPath)}`)
    const data = await res.json()
    setSelectedDoc(data)
    router.push(`/docs?doc=${encodeURIComponent(docPath)}${link ? `&link=${encodeURIComponent(link)}` : ""}`)
  }, [rootParam, router])

  function onProjectChange(root: string) {
    setActiveProject(root)
    refresh(root)
  }

  return (
    <AppContext.Provider value={{
      projects,
      activeProject,
      summary,
      demo,
      playground,
      board,
      activity,
      liveIndicator,
      connection,
      loading,
      selectedDoc,
      setSelectedDoc,
      rootParam,
      onProjectChange,
      refresh,
      moveTask,
      updateTaskFields,
      openDoc,
      editorSettings,
      setEditorSettings,
      autoRefreshSeconds,
      setAutoRefreshSeconds,
    }}>
      {children}
    </AppContext.Provider>
  )
}
