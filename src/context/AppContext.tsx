"use client"

import { resolveStatus, statusDefs } from "@/lib/statuses"
import { getStatusDefs, setStatusDefs } from "@/components/shared/status-defs"
import { toast } from "@/components/ui/toast"
import { tNow } from "@/context/LanguageContext"
import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react"
import { flushSync } from "react-dom"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import type { Task, TaskBoard, ActivityEvent, Project } from "@/lib/core"
import type { Summary, SelectedDoc } from "@/types"
import type { Priority } from "@/lib/doc-priority"
import { DEFAULT_SETTINGS, type AppSettings } from "@/lib/settings"
import { parseManualTests, toggleManualTest, untestedItems } from "@/lib/manual-tests"
import { LAST_PAGE_COOKIE, lastPageTarget } from "@/lib/first-screen"
import { taskKey } from "@/lib/board-views"
import type { ProjectGroup } from "@/lib/groups"

/** The URL key naming a tab's project (R099): `?project=<hub id>`. */
export const PROJECT_PARAM = "project"

/** The URL key naming an open project group (R102): `?group=<slug>`; the board shows every member's tasks. */
export const GROUP_PARAM = "group"

/** `href` with `?group=<slug>` (and no `?project=`). */
export function groupHref(href: string, slug: string): string {
  const [path, hash = ""] = href.split("#")
  const [base, query = ""] = path.split("?")
  const q = new URLSearchParams(query)
  q.delete(PROJECT_PARAM)
  q.set(GROUP_PARAM, slug)
  return `${base}?${q}${hash ? `#${hash}` : ""}`
}

/** `href` with `?project=<id>` added, unless `id` is the default project (the configured root, first in /api/projects). */
export function projectHref(href: string, id: string | undefined, defaultId: string | undefined): string {
  if (!id || id === defaultId) return href
  const [path, hash = ""] = href.split("#")
  const [base, query = ""] = path.split("?")
  const q = new URLSearchParams(query)
  q.set(PROJECT_PARAM, id)
  return `${base}?${q}${hash ? `#${hash}` : ""}`
}

function readCookie(name: string): string | null {
  const hit = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`))
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null
}

/** The SSE link to /api/events. EventSource retries on its own, so "disconnected" means "retrying". */
export type Connection = "connecting" | "live" | "disconnected"

interface AppContextValue {
  projects: Project[]
  /** The open project's root (what `?root=` sends to the API) */
  activeProject: string
  /** The open project's hub id (R099), "" until projects load */
  activeProjectId: string
  /** `href` keeping the open project in the URL (`?project=`) when it isn't the default one */
  withProject: (href: string) => string
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
  /** Opens a hub project by id: `href` there, else its last page (else /board), with `?project=` in the URL; leaves a group */
  onProjectChange: (id: string, href?: string) => void
  /** Every project group the hub's projects form (R102) */
  groups: ProjectGroup[]
  /** The open group (`?group=`): the board shows every member's tasks; null = one project */
  activeGroup: ProjectGroup | null
  /** Opens a group's board */
  onGroupChange: (slug: string) => void
  refresh: (root?: string) => Promise<void>
  moveTask: (taskId: string, status: string) => Promise<void>
  /** Optimistic owner / due / size edit (R055); rolls back with a toast when the write fails */
  updateTaskFields: (taskId: string, patch: { owner?: string | null; due?: string | null; size?: string; priority?: Priority | null }) => Promise<void>
  /** Optimistic tick of one `## Manual tests` item (T510): the card's 🧪 count moves at once; rolls back with a toast */
  tickManualTest: (taskId: string, index: number, checked: boolean) => Promise<void>
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
  const pathname = usePathname()
  const search = useSearchParams()
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
  const toldUnknownRef = useRef(false) // dev Strict Mode runs the mount effect twice: one toast
  // R102: the open group's slug; a ref too, so refresh() right after a switch already reads the new one
  const [groups, setGroups] = useState<ProjectGroup[]>([])
  const [groupSlug, setGroupSlugState] = useState<string | null>(null)
  const groupRef = useRef<string | null>(null)
  const setGroupSlug = useCallback((slug: string | null) => { groupRef.current = slug; setGroupSlugState(slug) }, [])
  const activeGroup = (groupSlug && groups.find((g) => g.slug === groupSlug)) || null

  // Always a query string, so callers can append `&key=…` even before a project loads ("?&read=x" is valid)
  const rootParam = activeProject ? `?root=${encodeURIComponent(activeProject)}` : "?"

  const refresh = useCallback(async (root?: string) => {
    const r = root || activeProject
    if (!r) return
    const rp = `?root=${encodeURIComponent(r)}`
    try {
      const [sumRes, boardRes, actRes, settingsRes] = await Promise.all([
        fetch(`/api/summary${rp}`).then((r) => r.json()),
        fetch(groupRef.current ? `/api/tasks?${GROUP_PARAM}=${encodeURIComponent(groupRef.current)}` : `/api/tasks${rp}`).then((r) => r.json()),
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

  const defaultProjectId = projects[0]?.id
  const activeProjectId = projects.find((p) => p.root === activeProject)?.id ?? ""
  const withProject = useCallback((href: string) => (groupSlug ? groupHref(href, groupSlug) : projectHref(href, activeProjectId, defaultProjectId)), [groupSlug, activeProjectId, defaultProjectId])

  const openProject = useCallback((p: Project) => {
    setActiveProject(p.root)
    refresh(p.root)
    // stamps lastOpened (R099); best effort, nothing to tell the user
    fetch("/api/projects/open", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id }) }).catch(() => {})
  }, [refresh])

  // Load projects on mount; `?project=<id>` picks one (R099), an unknown id shows the default with a toast.
  // `?group=<slug>` (R102) opens that group's board; an unknown slug shows the default project with a toast.
  useEffect(() => {
    Promise.all([fetch("/api/projects").then((r) => r.json()), fetch("/api/groups").then((r) => r.json()).catch(() => [])])
      .then(([p, g]: [Project[], ProjectGroup[]]) => {
        setProjects(p)
        const gs = Array.isArray(g) ? g : []
        setGroups(gs)
        const askedGroup = new URLSearchParams(window.location.search).get(GROUP_PARAM)
        if (askedGroup && gs.some((x) => x.slug === askedGroup)) setGroupSlug(askedGroup)
        else if (askedGroup && !toldUnknownRef.current && p.length > 0) {
          toldUnknownRef.current = true
          toast(tNow("shell.unknownGroup", { id: askedGroup, name: p[0].name }))
        }
        if (p.length > 0) {
          const asked = new URLSearchParams(window.location.search).get(PROJECT_PARAM)
          const picked = asked ? p.find((x) => x.id === asked) : undefined
          if (asked && (!picked || picked.missing) && !toldUnknownRef.current) {
            toldUnknownRef.current = true
            toast(tNow(picked ? "shell.projectMissingToast" : "shell.unknownProject", { id: asked, name: p[0].name }))
          }
          openProject(picked && !picked.missing ? picked : p[0])
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

  // Back / forward between projects: the URL decides
  useEffect(() => {
    const onPop = () => {
      const params = new URLSearchParams(window.location.search)
      const asked = params.get(PROJECT_PARAM)
      const g = params.get(GROUP_PARAM)
      const nextGroup = g && groups.some((x) => x.slug === g) ? g : null
      const groupChanged = nextGroup !== groupRef.current
      setGroupSlug(nextGroup)
      const p = projects.find((x) => x.id === asked) ?? projects[0]
      if (p && p.root !== activeProject) openProject(p)
      else if (groupChanged) refresh()
    }
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [projects, groups, activeProject, openProject, refresh, setGroupSlug])

  // In-app links drop the query: put `?project=` back after each navigation, so a reload or a copied link stays here
  useEffect(() => {
    if (groupSlug) {
      const url = new URL(window.location.href)
      if (url.searchParams.get(GROUP_PARAM) === groupSlug) return
      window.history.replaceState(window.history.state, "", groupHref(`${url.pathname}${url.search}${url.hash}`, groupSlug))
      return
    }
    if (!activeProjectId || activeProjectId === defaultProjectId) return
    const url = new URL(window.location.href)
    if (url.searchParams.get(PROJECT_PARAM) === activeProjectId) return
    url.searchParams.set(PROJECT_PARAM, activeProjectId)
    window.history.replaceState(window.history.state, "", url)
  }, [pathname, search, activeProjectId, defaultProjectId, groupSlug])

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
        // R108: a worker's own steps; the board moves on its task_updated events
        if (msg.type === "worker_updated") return
        // R099: the hub changed (opened, renamed, pinned…): reload the list, not the project
        if (msg.type === "projects_updated") {
          fetch("/api/projects").then((r) => r.json()).then((p: Project[]) => { if (Array.isArray(p) && p.length) setProjects(p) }).catch(() => {})
          // R102: a group's members or name may have changed too; an open group's board follows
          fetch("/api/groups").then((r) => r.json()).then((g: ProjectGroup[]) => { if (Array.isArray(g)) setGroups(g) }).catch(() => {})
          if (groupRef.current) refresh()
          return
        }
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
        // R081: agent_connected = the evidence file changed; the header, First week and empty states read it from the summary
        if (roadmapChange || ["task_updated", "task_created", "decision_logged", "memory_updated", "session_start", "first_week_updated", "agent_connected"].includes(msg.type)) {
          refresh()
        }
      } catch {}
    }

    // The next EventSource (project switch) starts unconfirmed: don't keep showing the old "live"
    return () => { es.close(); setConnection("connecting") }
  }, [activeProject, refresh])

  const demo = summary?.demo === true
  const playground = summary?.playground === true

  // R102: on a group board a task is named by its key (`api:T001`); a write goes to its own repo with its plain id
  const writeTarget = useCallback((key: string) => {
    const task = board ? Object.values(board).flat().find((t) => taskKey(t) === key) : undefined
    const root = task?.project ? projects.find((p) => p.id === task.project?.id)?.root : undefined
    return { id: task?.id ?? key, rp: root ? `?root=${encodeURIComponent(root)}` : rootParam }
  }, [board, projects, rootParam])

  const moveTask = useCallback(async (taskId: string, status: string) => {
    if (demo) return
    const target = writeTarget(taskId) // read-only demo: the card must not move and snap back
    // Optimistic update: move card in UI immediately, animated via View Transitions when supported
    const apply = () => setBoard(prev => {
      if (!prev) return prev
      let movedTask: Task | undefined
      const next = structuredClone(prev) as TaskBoard
      for (const col of Object.keys(next) as (keyof TaskBoard)[]) {
        const idx = next[col].findIndex(t => taskKey(t) === taskId)
        if (idx !== -1) {
          movedTask = { ...next[col][idx] }
          next[col] = next[col].filter(t => taskKey(t) !== taskId)
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
      const res = await fetch(`/api/tasks${target.rp}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: target.id, status, actor: "human" }),
      })
      if (!res.ok) toast(tNow("help.couldNotMove", { id: target.id, error: String((await res.json().catch(() => null))?.error ?? res.status) }))
    } catch {
      toast(tNow("help.couldNotMoveOffline", { id: target.id }))
    }
    refresh() // real state (also reverts a failed move)
  }, [demo, writeTarget, refresh])

  const updateTaskFields = useCallback(async (taskId: string, patch: { owner?: string | null; due?: string | null; size?: string; priority?: Priority | null }) => {
    if (demo) return
    const target = writeTarget(taskId)
    setBoard((prev) => {
      if (!prev) return prev
      const next = { ...prev }
      for (const col of Object.keys(next) as (keyof TaskBoard)[]) {
        next[col] = next[col].map((t) => (taskKey(t) === taskId ? { ...t, ...patch, size: patch.size ?? t.size } : t))
      }
      return next
    })
    try {
      const res = await fetch(`/api/tasks/update${target.rp}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: target.id, patch }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `HTTP ${res.status}`)
    } catch (e) {
      toast(tNow("help.couldNotUpdate", { id: target.id, error: (e as Error).message }))
      refresh() // roll back to the files
    }
  }, [demo, writeTarget, refresh])

  const tickManualTest = useCallback(async (taskId: string, index: number, checked: boolean) => {
    if (demo) return
    const target = writeTarget(taskId)
    setBoard((prev) => {
      if (!prev) return prev
      const next = { ...prev }
      for (const col of Object.keys(next) as (keyof TaskBoard)[]) {
        next[col] = next[col].map((t) => {
          if (taskKey(t) !== taskId || !t.raw || !t.manualTests) return t
          const raw = toggleManualTest(t.raw, index, checked)
          const tests = parseManualTests(raw)
          return tests ? { ...t, raw, manualTests: { ...t.manualTests, done: tests.done, untested: untestedItems(tests).length } } : t
        })
      }
      return next
    })
    try {
      const res = await fetch(`/api/tasks/manual-tests${target.rp}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: target.id, index, checked }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `HTTP ${res.status}`)
    } catch (e) {
      toast(tNow("tests.tickError", { id: target.id, error: (e as Error).message }))
      refresh() // roll back to the files
    }
  }, [demo, writeTarget, refresh])

  const openDoc = useCallback(async (docPath: string, link?: string) => {
    const res = await fetch(`/api/docs${rootParam}&read=${encodeURIComponent(docPath)}`)
    const data = await res.json()
    setSelectedDoc(data)
    router.push(withProject(`/docs?doc=${encodeURIComponent(docPath)}${link ? `&link=${encodeURIComponent(link)}` : ""}`))
  }, [rootParam, router, withProject])

  function onProjectChange(id: string, href?: string) {
    const p = projects.find((x) => x.id === id)
    const leavingGroup = groupRef.current !== null
    if (!p || p.missing || (p.root === activeProject && !leavingGroup && !href)) return
    setGroupSlug(null)
    setSelectedDoc(null)
    if (p.root !== activeProject) openProject(p)
    else refresh() // same project, but the board was a group's
    // `href`, else its last page there (R082 per project), else the board; the old project's query keys don't apply
    router.push(projectHref(href ?? lastPageTarget(readCookie(LAST_PAGE_COOKIE), p.id), p.id, defaultProjectId))
  }

  function onGroupChange(slug: string) {
    if (!groups.some((g) => g.slug === slug)) return
    setGroupSlug(slug)
    refresh()
    router.push(groupHref("/board", slug))
  }

  return (
    <AppContext.Provider value={{
      projects,
      activeProject,
      activeProjectId,
      withProject,
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
      groups,
      activeGroup,
      onGroupChange,
      refresh,
      moveTask,
      updateTaskFields,
      tickManualTest,
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
