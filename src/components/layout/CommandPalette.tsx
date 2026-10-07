"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  Search, FilePlus, LayoutDashboard, Activity, Brain, Map, BookOpen, Bot, FlaskConical, FolderTree, Settings,
  FileText, MessageSquarePlus, SunMoon, FolderOpen, Keyboard, Zap, PanelLeft, type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { fuzzyFilter } from "@/lib/fuzzy"
import { DOCS_LIST_KEY, TOGGLE_DOCS_LIST_EVENT, shortcutFor } from "@/lib/shortcuts"
import { applyTheme } from "@/lib/applySettings"
import { DEFAULT_SETTINGS, type AppSettings } from "@/lib/settings"
import { groupChats, shellStatus } from "@/lib/chats"
import { useApp } from "@/context/AppContext"
import { useChats } from "@/context/ChatContext"
import { StatusIcon } from "@/components/shared/StatusIcon"
import { StatusMarker, attachHref } from "@/components/chat/StatusMarker"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import type { RoadmapItem } from "@/types"
import { itemKeyLabel, useCurrentItemCommands } from "@/components/shared/item-commands"
import { displayStatus } from "@/lib/statuses"
import { useT } from "@/context/LanguageContext"
import { useChatText } from "@/components/chat/chat-text"
import type { MessageKey } from "@/i18n"
import { en as shellEn } from "@/i18n/shell"
import { en as helpEn } from "@/i18n/help"

const PAGES: { href: string; label: MessageKey; icon: LucideIcon }[] = [
  { href: "/chat", label: "shell.chats", icon: Bot },
  { href: "/board", label: "shell.board", icon: LayoutDashboard },
  { href: "/roadmap", label: "shell.roadmap", icon: Map },
  { href: "/docs", label: "shell.docs", icon: BookOpen },
  { href: "/activity", label: "shell.activity", icon: Activity },
  { href: "/memory", label: "shell.memory", icon: Brain },
  { href: "/manual-tests", label: "shell.manualTests", icon: FlaskConical },
  { href: "/explorer", label: "shell.explorer", icon: FolderTree },
  { href: "/settings", label: "shell.settings", icon: Settings },
]
// Vietnamese typed without tone marks ("bang" → Bảng) still matches
const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d")
const EN: Record<string, string> = { ...Object.fromEntries(Object.entries(shellEn).map(([k, v]) => [`shell.${k}`, v])), ...Object.fromEntries(Object.entries(helpEn).map(([k, v]) => [`help.${k}`, v])) }
const PER_GROUP = 6

interface Row {
  id: string
  group: string
  label: string
  /** Extra text the query also matches: a command's English label, so English muscle memory works in any language */
  match?: string
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
  const pathname = usePathname()
  const { board, projects, activeProject, onProjectChange, demo } = useApp()
  const { chats, queue, now, show, create } = useChats()
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const [docs, setDocs] = useState<DocSearch | null>(null)
  const [epics, setEpics] = useState<RoadmapItem[]>([])
  const listRef = useRef<HTMLDivElement>(null)
  const current = useCurrentItemCommands()
  const { t } = useT()
  const chatText = useChatText()

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

    // Actions on the open / selected item come first, under its name
    if (current) {
      for (const c of top(current.commands, (c) => c.label)) {
        out.push({
          id: `item-cmd-${c.action ?? c.id}`, group: current.title, label: c.label, lead: icon(Zap), kbd: c.action && itemKeyLabel(c.action),
          run: () => { onClose(); c.run() },
        })
      }
    }

    if (q) {
      const tasks = board ? Object.values(board).flat() : []
      const items = [
        ...tasks.map((t) => ({ id: t.id, title: t.title, lead: <StatusIcon status={displayStatus(t)} />, href: attachHref({ kind: "task", id: t.id }) })),
        ...epics.map((e) => ({ id: e.id, title: e.title, lead: icon(Map), href: attachHref({ kind: "epic", id: e.id }) })),
      ]
      // An id prefix ("T06", "r043") beats a fuzzy title hit; shortest (exact) id first
      const lower = q.toLowerCase()
      const byId = items.filter((i) => i.id.toLowerCase().startsWith(lower)).sort((a, b) => a.id.length - b.id.length)
      const hits = byId.length ? byId : fuzzyFilter(q, items, (i) => i.title)
      for (const i of hits.slice(0, PER_GROUP)) {
        itemRows.push({ id: `item-${i.id}`, group: t("help.groupTasksEpics"), label: i.title, code: i.id, lead: i.lead, run: go(i.href) })
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
        id: `chat-${c.id}`, group: t("shell.chats"), label: chatText.title(c.title), code: c.attach?.id,
        lead: <StatusMarker status={shellStatus(c, now)} showIdle />,
        run: () => { show(c.id); onClose() },
      })
    }
    if (!idQuery) out.push(...itemRows)

    // Commands match the label in the UI language and the English one
    const cmd = (key: MessageKey) => ({ label: t(key), match: EN[key] })
    for (const p of top(PAGES, (p) => `${t(p.label)} ${fold(t(p.label))} ${EN[p.label]}`)) {
      out.push({ id: `page-${p.href}`, group: t("help.groupNavigate"), ...cmd(p.label), lead: icon(p.icon), kbd: shortcutFor(p.href), run: go(p.href) })
    }
    const actionsGroup = t("help.groupActions")

    const actions: Row[] = [
      // Read-only demo (R042): nothing that creates
      ...(demo ? [] : [
        { id: "new-chat", group: actionsGroup, ...cmd("help.newChat"), lead: icon(MessageSquarePlus), run: () => { show(create()); onClose() } },
        { id: "new-doc", group: actionsGroup, ...cmd("help.newDoc"), lead: icon(FilePlus), run: () => { onNewDoc?.(); onClose() } },
      ]),
      { id: "go-file", group: actionsGroup, ...cmd("help.goToFile"), lead: icon(FileText), kbd: "⌘P", run: onQuickOpen },
      ...(pathname?.startsWith("/docs") ? [{
        id: "toggle-docs-list", group: actionsGroup, ...cmd("help.hideDocsList"), lead: icon(PanelLeft), kbd: DOCS_LIST_KEY.label,
        run: () => { window.dispatchEvent(new Event(TOGGLE_DOCS_LIST_EVENT)); onClose() },
      }] : []),
      { id: "theme", group: actionsGroup, ...cmd("help.toggleTheme"), lead: icon(SunMoon), run: () => { toggleTheme(rootParam); onClose() } },
      { id: "help", group: actionsGroup, ...cmd("help.keyboardShortcuts"), lead: icon(Keyboard), kbd: "?", run: onShowHelp },
      // Project switching only when searched for: there can be many sibling projects
      ...(q ? projects.filter((p) => p.root !== activeProject) : []).map((p) => ({
        id: `project-${p.root}`, group: actionsGroup, label: t("help.switchProject", { name: p.name }), match: `Switch project: ${p.name}`, detail: p.root,
        lead: icon(FolderOpen), run: () => { onProjectChange(p.root); onClose() },
      })),
    ]
    out.push(...top(actions, (a) => `${a.label} ${fold(a.label)} ${a.match ?? ""}`))

    if (q.length >= 2 && docs?.query === q) {
      // Task and roadmap files already show under Tasks & epics
      const files = docs.files.filter((f) => !/^plans\/(tasks|roadmap)\//.test(f))
      for (const path of files.slice(0, PER_GROUP)) {
        const slash = path.lastIndexOf("/")
        out.push({
          id: `doc-${path}`, group: t("shell.docs"), label: path.slice(slash + 1).replace(/\.md$/, ""),
          detail: slash > 0 ? path.slice(0, slash) : undefined, lead: icon(FileText),
          run: () => { onOpenDoc(path); onClose() },
        })
      }
    }
    return out
  }, [q, current, chats, queue, now, board, epics, projects, activeProject, docs, router, onClose, show, create, onNewDoc, onQuickOpen, onShowHelp, onOpenDoc, onProjectChange, rootParam, pathname, demo, t, chatText])

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
        <DialogTitle className="sr-only">{t("help.commandPalette")}</DialogTitle>
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
            placeholder={t("help.searchPlaceholder")}
            className="h-full flex-1 bg-transparent text-sm text-txt outline-none placeholder:text-muted"
          />
        </div>
        <div ref={listRef} id="cmd-list" role="listbox" aria-label={t("help.results")} className="max-h-80 overflow-y-auto py-1">
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
                <span data-user-content={row.match ? undefined : true} className="truncate text-txt">{row.label}</span>
                {row.detail && <span data-user-content className="truncate text-[11px] text-muted">{row.detail}</span>}
                {row.kbd && (
                  <kbd className="ml-auto shrink-0 rounded-sm border border-border px-1 font-mono text-[10px] text-muted">{row.kbd}</kbd>
                )}
              </div>
              ) })}
            </div>
          ))}
          {docsPending && <div className="px-4 py-1.5 text-[11px] text-muted">{t("help.searchingDocs")}</div>}
          {docsFailed && <div role="alert" className="px-4 py-1.5 text-[11px] text-danger">{t("help.searchFailed")}</div>}
          {rows.length === 0 && !docsPending && !docsFailed && (
            <div className="px-4 py-6 text-center text-[13px] text-muted">{t("help.nothingMatches", { query: q })}</div>
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
