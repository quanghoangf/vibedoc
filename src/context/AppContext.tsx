"use client"

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import type { Task, TaskBoard, ActivityEvent, Project } from "@/lib/core"
import type { Summary, SelectedDoc } from "@/types"
import { DEFAULT_SETTINGS, type AppSettings } from "@/lib/settings"

interface AppContextValue {
  projects: Project[]
  activeProject: string
  summary: Summary | null
  board: TaskBoard | null
  activity: ActivityEvent[]
  liveIndicator: boolean
  loading: boolean
  selectedDoc: SelectedDoc | null
  setSelectedDoc: (doc: SelectedDoc | null) => void
  rootParam: string
  onProjectChange: (root: string) => void
  refresh: (root?: string) => Promise<void>
  moveTask: (taskId: string, status: string) => Promise<void>
  openDoc: (path: string) => Promise<void>
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
  const [selectedDoc, setSelectedDoc] = useState<SelectedDoc | null>(null)
  const [editorSettings, setEditorSettings] = useState<AppSettings["editor"]>(DEFAULT_SETTINGS.editor)
  const [autoRefreshSeconds, setAutoRefreshSeconds] = useState(0)
  const sseRef = useRef<EventSource | null>(null)

  const rootParam = activeProject ? `?root=${encodeURIComponent(activeProject)}` : ""

  const refresh = useCallback(async (root?: string) => {
    const r = root || activeProject
    if (!r) return
    const rp = `?root=${encodeURIComponent(r)}`
    try {
      const [sumRes, boardRes, actRes] = await Promise.all([
        fetch(`/api/summary${rp}`).then((r) => r.json()),
        fetch(`/api/tasks${rp}`).then((r) => r.json()),
        fetch(`/api/activity${rp}&limit=30`).then((r) => r.json()),
      ])
      setSummary(sumRes)
      const rawBoard = boardRes?.board
      setBoard(rawBoard && typeof rawBoard === 'object' ? {
        todo: rawBoard.todo ?? [],
        'in-progress': rawBoard['in-progress'] ?? [],
        blocked: rawBoard.blocked ?? [],
        done: rawBoard.done ?? [],
        cancelled: rawBoard.cancelled ?? [],
      } : null)
      setActivity(Array.isArray(actRes) ? actRes : [])
    } catch {}
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
      .catch(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // SSE for real-time updates
  useEffect(() => {
    if (!activeProject) return
    const es = new EventSource("/api/events")
    sseRef.current = es

    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === "connected") return
        setLiveIndicator(true)
        setTimeout(() => setLiveIndicator(false), 2000)
        if (["task_updated", "decision_logged", "memory_updated", "session_start"].includes(msg.type)) {
          refresh()
        }
      } catch {}
    }

    return () => { es.close() }
  }, [activeProject, refresh])

  const moveTask = useCallback(async (taskId: string, status: string) => {
    // Optimistic update: move card in UI immediately
    setBoard(prev => {
      if (!prev) return prev
      let movedTask: Task | undefined
      const next = structuredClone(prev) as TaskBoard
      for (const col of Object.keys(next) as (keyof TaskBoard)[]) {
        const idx = next[col].findIndex(t => t.id === taskId)
        if (idx !== -1) {
          movedTask = { ...next[col][idx], status: status as Task["status"] }
          next[col] = next[col].filter(t => t.id !== taskId)
        }
      }
      const target = status as keyof TaskBoard
      if (movedTask && next[target]) next[target] = [movedTask, ...next[target]]
      return next
    })

    try {
      await fetch(`/api/tasks${rootParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, status, actor: "human" }),
      })
      refresh()
    } catch {
      refresh() // revert by fetching real state on error
    }
  }, [rootParam, refresh])

  const openDoc = useCallback(async (docPath: string) => {
    const res = await fetch(`/api/docs${rootParam}&read=${encodeURIComponent(docPath)}`)
    const data = await res.json()
    setSelectedDoc(data)
    router.push("/docs")
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
      board,
      activity,
      liveIndicator,
      loading,
      selectedDoc,
      setSelectedDoc,
      rootParam,
      onProjectChange,
      refresh,
      moveTask,
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
