"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  Search, FilePlus, LayoutDashboard, Activity, Brain, Map, BookOpen, Bot, FlaskConical, FolderTree, Settings,
  FileText, MessageSquarePlus, SunMoon, FolderOpen, Keyboard, type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { fuzzyFilter } from "@/lib/fuzzy"
import { shortcutFor } from "@/lib/shortcuts"
import { applyTheme } from "@/lib/applySettings"
import { DEFAULT_SETTINGS, type AppSettings } from "@/lib/settings"
import { groupChats, shellStatus } from "@/lib/chats"
import { useApp } from "@/context/AppContext"
import { useChats } from "@/context/ChatContext"
import { StatusIcon } from "@/components/shared/StatusIcon"
import { StatusMarker, attachHref } from "@/components/chat/StatusMarker"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import type { RoadmapItem } from "@/types"

const PAGES: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/chat", label: "Chats", icon: Bot },
  { href: "/board", label: "Board", icon: LayoutDashboard },
  { href: "/roadmap", label: "Roadmap", icon: Map },
  { href: "/docs", label: "Docs", icon: BookOpen },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/memory", label: "Memory", icon: Brain },
  { href: "/manual-tests", label: "Manual tests", icon: FlaskConical },
  { href: "/explorer", label: "Explorer", icon: FolderTree },
  { href: "/settings", label: "Settings", icon: Settings },
]
const PER_GROUP = 6

interface Row {
  id: string
  group: string
  label: string
  /** Mono prefix: task/epic id */
  code?: string
  detail?: string
  lead: React.ReactNode
  kbd?: string
  run: () => void
}

type DocSearch = { query: string; status: "done" | "error"; files: string[] }

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  onOpenDoc: (path: string) => void
  onNewDoc?: () => void
  onQuickOpen: () => void
  onShowHelp: () => void
  rootParam: string
}

const icon = (Icon: LucideIcon) => <Icon className="size-3.5 shrink-0 text-muted" aria-hidden />

/** ⌘K — chats first (task/epic ids first when the query is one), then pages, tasks & epics by id or title, docs by content, and actions. */
export function CommandPalette({ open, onClose, onOpenDoc, onNewDoc, onQuickOpen, onShowHelp, rootParam }: CommandPaletteProps) {
  const router = useRouter()
  const { board, projects, activeProject, onProjectChange } = useApp()
  const { chats, queue, now, show, create } = useChats()
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const [docs, setDocs] = useState<DocSearch | null>(null)
  const [epics, setEpics] = useState<RoadmapItem[]>([])
  const listRef = useRef<HTMLDivElement>(null)

  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) { setQuery(""); setActiveIndex(0); setDocs(null) }
  }

  // Epics: same endpoint the chat rail uses; refetched per open so it stays current
  useEffect(() => {
    if (!open) return
    let cancelled = false
    fetch(`/api/roadmap${rootParam}`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items?: RoadmapItem[] }) => { if (!cancelled) setEpics((d.items ?? []).filter((i) => i.parent)) })
      .catch((e) => console.warn("[vibedoc] palette could not load the roadmap:", e))
    return () => { cancelled = true }
  }, [open, rootParam])

  // Debounced doc content search
  const q = query.trim()
  useEffect(() => {
    if (q.length < 2) return
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/docs${rootParam}&q=${encodeURIComponent(q)}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        setDocs({ query: q, status: "done", files: data.results?.map((r: { file: string }) => r.file) ?? [] })
      } catch (e) {
        console.warn("[vibedoc] doc search failed:", e)
        setDocs({ query: q, status: "error", files: [] })
      }
    }, 300)
    return () => clearTimeout(t)
  }, [q, rootParam])

  const rows = useMemo(() => {
    const go = (href: string) => () => { router.push(href); onClose() }
    const top = <T,>(items: T[], key: (item: T) => string) => (q ? fuzzyFilter(q, items, key).slice(0, PER_GROUP) : items)
    const out: Row[] = []
    const itemRows: Row[] = []

    if (q) {
      const tasks = board ? Object.values(board).flat() : []
      const items = [
        ...tasks.map((t) => ({ id: t.id, title: t.title, lead: <StatusIcon status={t.status} />, href: attachHref({ kind: "task", id: t.id }) })),
        ...epics.map((e) => ({ id: e.id, title: e.title, lead: icon(Map), href: attachHref({ kind: "epic", id: e.id }) })),
      ]
      // An id prefix ("T06", "r043") beats a fuzzy title hit; shortest (exact) id first
      const lower = q.toLowerCase()
      const byId = items.filter((i) => i.id.toLowerCase().startsWith(lower)).sort((a, b) => a.id.length - b.id.length)
      const hits = byId.length ? byId : fuzzyFilter(q, items, (i) => i.title)
      for (const i of hits.slice(0, PER_GROUP)) {
        itemRows.push({ id: `item-${i.id}`, group: "Tasks & epics", label: i.title, code: i.id, lead: i.lead, run: go(i.href) })
      }
    }
    // An id query ("T06", "r043") puts its task/epic first, as the active row, so Enter opens it
    const idQuery = /^[TR]\d/i.test(q)
    if (idQuery) out.push(...itemRows)

    // Chats: with no query, the attention queue then running (else the 3 newest)
    const g = groupChats(chats, now)
    const urgent = [...queue, ...g.running]
    const chatPool = q ? chats : urgent.length ? urgent : g.recent.slice(0, 3)
    for (const c of top(chatPool, (c) => `${c.attach?.id ?? ""} ${c.title}`)) {
      out.push({
        id: `chat-${c.id}`, group: "Chats", label: c.title, code: c.attach?.id,
        lead: <StatusMarker status={shellStatus(c, now)} showIdle />,
        run: () => { show(c.id); onClose() },
      })
    }
    if (!idQuery) out.push(...itemRows)

    for (const p of top(PAGES, (p) => p.label)) {
      out.push({ id: `page-${p.href}`, group: "Navigate", label: p.label, lead: icon(p.icon), kbd: shortcutFor(p.href), run: go(p.href) })
    }

    const actions: Row[] = [
      { id: "new-chat", group: "Actions", label: "New chat", lead: icon(MessageSquarePlus), run: () => { show(create()); onClose() } },
      { id: "new-doc", group: "Actions", label: "New doc", lead: icon(FilePlus), run: () => { onNewDoc?.(); onClose() } },
      { id: "go-file", group: "Actions", label: "Go to file", lead: icon(FileText), kbd: "⌘P", run: onQuickOpen },
      { id: "theme", group: "Actions", label: "Toggle light / dark theme", lead: icon(SunMoon), run: () => { toggleTheme(rootParam); onClose() } },
      { id: "help", group: "Actions", label: "Keyboard shortcuts", lead: icon(Keyboard), kbd: "?", run: onShowHelp },
      // Project switching only when searched for: there can be many sibling projects
      ...(q ? projects.filter((p) => p.root !== activeProject) : []).map((p) => ({
        id: `project-${p.root}`, group: "Actions", label: `Switch project: ${p.name}`, detail: p.root,
        lead: icon(FolderOpen), run: () => { onProjectChange(p.root); onClose() },
      })),
    ]
    out.push(...top(actions, (a) => a.label))

    if (q.length >= 2 && docs?.query === q) {
      // Task and roadmap files already show under Tasks & epics
      const files = docs.files.filter((f) => !/^plans\/(tasks|roadmap)\//.test(f))
      for (const path of files.slice(0, PER_GROUP)) {
        const slash = path.lastIndexOf("/")
        out.push({
          id: `doc-${path}`, group: "Docs", label: path.slice(slash + 1).replace(/\.md$/, ""),
          detail: slash > 0 ? path.slice(0, slash) : undefined, lead: icon(FileText),
          run: () => { onOpenDoc(path); onClose() },
        })
      }
    }
    return out
  }, [q, chats, queue, now, board, epics, projects, activeProject, docs, router, onClose, show, create, onNewDoc, onQuickOpen, onShowHelp, onOpenDoc, onProjectChange, rootParam])

  const active = Math.max(0, Math.min(activeIndex, rows.length - 1))
  // Runs of one group, each rendered as an ARIA group named by its heading
  const groups = rows.reduce<{ group: string; start: number; items: Row[] }[]>((acc, row, i) => {
    const last = acc[acc.length - 1]
    if (last?.group === row.group) last.items.push(row)
    else acc.push({ group: row.group, start: i, items: [row] })
    return acc
  }, [])
  const docsPending = q.length >= 2 && docs?.query !== q
  const docsFailed = q.length >= 2 && docs?.query === q && docs.status === "error"

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" })
  }, [active])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex(Math.min(active + 1, rows.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex(Math.max(active - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      rows[active]?.run()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-lg p-0 overflow-hidden bg-surface border-border gap-0 top-[20%] translate-y-0">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <div className="flex items-center gap-3 px-4 h-11 border-b border-border">
          <Search className="size-4 text-muted shrink-0" aria-hidden />
          <input
            autoFocus
            role="combobox"
            aria-expanded={rows.length > 0}
            aria-controls="cmd-list"
            aria-autocomplete="list"
            aria-activedescendant={rows[active] ? `cmd-${active}` : undefined}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIndex(0) }}
            onKeyDown={handleKeyDown}
            placeholder="Search tasks, epics, chats, docs…"
            className="h-full flex-1 bg-transparent text-sm text-txt outline-none placeholder:text-muted"
          />
        </div>
        <div ref={listRef} id="cmd-list" role="listbox" aria-label="Results" className="max-h-80 overflow-y-auto py-1">
          {groups.map(({ group, start, items }) => (
            <div key={`${group}-${start}`} role="group" aria-labelledby={`cmd-g-${start}`}>
              <div id={`cmd-g-${start}`} role="presentation" className="px-4 pt-2 pb-1 font-mono text-[10px] uppercase tracking-[0.06em] text-muted">
                {group}
              </div>
              {items.map((row, k) => { const i = start + k; return (
              <div
                key={row.id}
                id={`cmd-${i}`}
                data-index={i}
                role="option"
                aria-selected={i === active}
                onClick={row.run}
                onMouseMove={() => setActiveIndex(i)}
                className={cn(
                  "flex items-center gap-2.5 w-full px-4 py-1.5 text-[13px] cursor-pointer transition-colors duration-[var(--duration-fast)]",
                  i === active ? "bg-accent/10 text-txt" : "text-muted",
                )}
              >
                {row.lead}
                {row.code && <span className="font-mono text-[11px] text-muted shrink-0">{row.code}</span>}
                <span className="truncate text-txt">{row.label}</span>
                {row.detail && <span className="truncate text-[11px] text-muted">{row.detail}</span>}
                {row.kbd && (
                  <kbd className="ml-auto shrink-0 rounded-sm border border-border px-1 font-mono text-[10px] text-muted">{row.kbd}</kbd>
                )}
              </div>
              ) })}
            </div>
          ))}
          {docsPending && <div className="px-4 py-1.5 text-[11px] text-muted">Searching docs…</div>}
          {docsFailed && <div role="alert" className="px-4 py-1.5 text-[11px] text-danger">Search failed. Check the server and try again.</div>}
          {rows.length === 0 && !docsPending && !docsFailed && (
            <div className="px-4 py-6 text-center text-[13px] text-muted">Nothing matches “{q}”</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Flip the saved theme between light and dark (from "system" too), same write as the Settings page. */
async function toggleTheme(rootParam: string) {
  try {
    const res = await fetch(`/api/settings${rootParam}&type=settings`)
    // Never PUT defaults over settings we couldn't read
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const settings: AppSettings = { ...DEFAULT_SETTINGS, ...(await res.json()) }
    settings.theme = document.documentElement.classList.contains("dark") ? "light" : "dark"
    applyTheme(settings.theme)
    await fetch(`/api/settings${rootParam}&type=settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    })
  } catch (e) {
    console.warn("[vibedoc] could not save the theme:", e)
  }
}
