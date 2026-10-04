"use client"

import { useState, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { Bot, Check, Copy, Loader2, MessagesSquare, Plug, Search } from "lucide-react"
import type { ActivityEvent, Project, Summary } from "@/types"
import { useApp } from "@/context/AppContext"
import { useChats } from "@/context/ChatContext"
import { ProjectSwitcher } from "./ProjectSwitcher"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useOrigin } from "@/hooks/use-origin"
import { cn } from "@/lib/utils"
import { ago } from "@/lib/chats"
import { groupSessions, isLive } from "@/lib/sessions"

const PAGE_TITLES: Record<string, string> = {
  "/board": "Board",
  "/roadmap": "Roadmap",
  "/docs": "Docs",
  "/activity": "Activity",
  "/memory": "Memory",
  "/manual-tests": "Manual tests",
  "/explorer": "Explorer",
  "/settings": "Settings",
  "/chat": "Chats",
}

/** The system focus ring (ui/button.tsx) for the hand-rolled header buttons. */
const focusRing = "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"

interface AppHeaderProps {
  summary: Summary | null
  projects: Project[]
  activeProject: string
  liveIndicator: boolean
  onProjectChange: (root: string) => void
  onToggleChat: () => void
  onOpenSearch: () => void
}

/** Where you are (project / page) on the left; agent status, search and Chats on the right. */
export function AppHeader({ summary, projects, activeProject, liveIndicator, onProjectChange, onToggleChat, onOpenSearch }: AppHeaderProps) {
  const pathname = usePathname()
  const title = Object.entries(PAGE_TITLES).find(([p]) => pathname.startsWith(p))?.[1]
  const { activity, demo } = useApp()
  // ChatContext's minute clock, so "N agents working" and "last agent call" age without new events
  const { now } = useChats()

  return (
    <header className="sticky top-0 z-50 flex h-12 shrink-0 items-center gap-2 border-b border-border bg-surface/80 px-3 backdrop-blur-xs sm:px-4">
      <SidebarTrigger className="-ml-1 text-muted hover:text-txt" />
      <span className="mx-1 h-4 w-px bg-border" aria-hidden />

      {/* Below sm the project name truncates so the page name stays */}
      <nav aria-label="Location" className="flex min-w-0 items-center gap-1.5 text-sm [&_button]:min-w-0 max-sm:[&_button>span]:max-w-20">
        <ProjectSwitcher projects={projects} activeProject={activeProject} currentName={summary?.name || ""} onSelect={onProjectChange} />
        {title && (
          <>
            <span className="text-muted" aria-hidden>/</span>
            <span className="shrink-0 font-medium text-txt">{title}</span>
          </>
        )}
      </nav>

      <div className="flex-1" />

      {demo && (
        <p className="flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-bg/60 px-2.5 py-1 text-xs text-muted">
          <span className="hidden lg:inline">Live demo, read-only. Install:</span>
          <span className="lg:hidden">Read-only demo</span>
          <code className="hidden font-mono text-txt lg:inline">npx vibedoc</code>
        </p>
      )}

      <AgentStatus liveIndicator={liveIndicator} activity={activity} now={now} />

      <button
        type="button"
        onClick={onOpenSearch}
        className={cn("flex h-8 items-center gap-2 rounded-md border border-border bg-bg/60 px-2 text-xs text-muted transition-colors hover:border-border2 hover:text-txt sm:w-48 sm:px-2.5", focusRing)}
      >
        <Search className="size-3.5" />
        <span className="hidden flex-1 text-left sm:inline">Search…</span>
        <kbd className="hidden rounded-sm border border-border px-1 font-mono text-[10px] sm:inline">⌘K</kbd>
        <span className="sr-only sm:hidden">Search</span>
      </button>

      <ConnectMenu activity={activity} now={now} />

      {!demo && <button
        type="button"
        onClick={onToggleChat}
        title="Chats (c)"
        aria-label="Chats (c)"
        className={cn("flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs text-muted transition-colors hover:border-border2 hover:text-txt", focusRing)}
      >
        <MessagesSquare className="size-3.5" aria-hidden />
        <span className="hidden sm:inline">Chats</span>
      </button>}
    </header>
  )
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

/**
 * "● 2 agents working · 1 running · 1 need you · 1 error": terminal agents (MCP sessions in the activity log) lead,
 * then in-app chats. Only recent, undismissed chat errors count. Zero counts are left out; the SSE link is a small
 * neutral dot while connected (amber, "Reconnecting…" when it drops). Click opens the attention queue's head, else /chat.
 * Below sm: dot · bot glyph + "2" · need-you and error counts; the strip clips before it covers the page title. Agents and actionable counts in text ink; running stays muted.
 */
function AgentStatus({ liveIndicator, activity, now }: { liveIndicator: boolean; activity: ActivityEvent[]; now: number }) {
  const { connection } = useApp()
  const { runningCount: running, waitingCount: waiting, errorCount: errors, queue, show } = useChats()
  const router = useRouter()
  const agents = groupSessions(activity).filter((s) => s.actor === "ai" && isLive(s, now)).length
  const down = connection === "disconnected"
  const state = down ? "Reconnecting…" : connection === "live" ? "Connected" : "Connecting"
  const summary = [
    state,
    agents && `${plural(agents, "agent")} working`,
    running && `${running} ${running === 1 ? "chat" : "chats"} running`,
    waiting && `${waiting} need you`,
    errors && `${plural(errors, "chat error")}`,
  ].filter(Boolean).join(" · ")
  const label = `${summary} — ${queue[0] ? "open next in queue" : "open Chats"}`
  const announce = [waiting && `${waiting} ${waiting === 1 ? "chat needs" : "chats need"} you`, errors && plural(errors, "chat error")]
    .filter(Boolean).join(", ")
  // A separator goes inside each count after the first (or after "Reconnecting…"), so a count hidden below sm takes its separator with it
  const counts: [string, ReactNode][] = [
    ["agents", agents > 0 && (
      <>
        <Bot aria-hidden className="size-3 text-txt motion-safe:animate-pulse-dot" />
        <span className="text-txt">{agents}<span className="max-sm:sr-only"> {agents === 1 ? "agent" : "agents"} working</span></span>
      </>
    )],
    ["running", running > 0 && (
      <>
        <Loader2 aria-hidden className="size-3 animate-spin text-accent" />
        {running} running
      </>
    )],
    ["waiting", waiting > 0 && (
      <>
        <span aria-hidden className="size-1.5 rounded-full bg-amber animate-pulse-dot" />
        <span className="text-txt">{waiting}<span className="max-sm:sr-only"> need you</span></span>
      </>
    )],
    ["errors", errors > 0 && (
      <>
        <span aria-hidden className="size-1.5 rounded-full bg-danger" />
        <span className="text-txt">{errors}<span className="max-sm:sr-only"> {errors === 1 ? "error" : "errors"}</span></span>
      </>
    )],
  ].filter(([, node]) => node) as [string, ReactNode][]

  return (
    <>
      <button
        id="agent-status"
        type="button"
        onClick={() => (queue[0] ? show(queue[0].id) : router.push("/chat"))}
        title={label}
        aria-label={label}
        className={cn("flex h-8 min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-md px-1.5 font-mono text-[11px] text-muted transition-colors duration-(--duration-fast) hover:bg-surface2 hover:text-txt", focusRing)}
      >
        <span
          aria-hidden
          className={cn(
            "size-1.5 shrink-0 rounded-full transition-colors duration-(--duration-slow)",
            down ? "bg-amber" : connection === "live" ? (liveIndicator ? "bg-txt" : "bg-muted") : "border border-muted",
          )}
        />
        {down && <span className="text-txt max-sm:sr-only">{state}</span>}
        {counts.map(([key, node], i) => (
          <span key={key} className={cn("flex items-center gap-1", key === "running" && "max-sm:hidden")}>
            {(i > 0 || down) && <span aria-hidden className={cn("text-muted", counts.slice(0, i).every(([k]) => k === "running") && "max-sm:hidden")}>·</span>}
            {node}
          </span>
        ))}
      </button>
      {/* Outside the button: a live region inside a control is re-read as its name */}
      <span aria-live="polite" className="sr-only">{announce}</span>
    </>
  )
}

/** The MCP endpoint an agent connects to, the `claude mcp add` line, and when an agent last called in. */
function ConnectMenu({ activity, now }: { activity: ActivityEvent[]; now: number }) {
  const endpoint = `${useOrigin()}/api/mcp`
  const command = `claude mcp add --transport http vibedoc ${endpoint}`
  const [copied, setCopied] = useState<string | null>(null)
  const lastCall = activity.filter((e) => e.actor === "ai").reduce<string | null>((t, e) => (!t || e.timestamp > t ? e.timestamp : t), null)
  const lastAgo = lastCall && ago(lastCall, now)

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(text)
      setTimeout(() => setCopied(null), 1500)
    } catch (e) {
      console.warn("[vibedoc] could not copy:", e)
    }
  }

  // Menu items, not plain buttons, so arrows reach them; preventDefault keeps the menu open to show the tick
  const row = (text: string, label: string) => (
    <DropdownMenuItem
      onSelect={(e) => { e.preventDefault(); void copy(text) }}
      className="mt-2 items-start gap-1 rounded-md border border-border bg-bg px-2 py-1.5 focus:border-border2 [&_svg]:size-3.5"
    >
      <span className="sr-only">{label}: </span>
      <code className="min-w-0 flex-1 break-all font-mono text-xs text-accent">{text}</code>
      <span aria-hidden className="grid size-5 place-items-center text-muted">
        {copied === text ? <Check className="text-teal" /> : <Copy />}
      </span>
    </DropdownMenuItem>
  )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title="Connect an AI agent (MCP)"
          className={cn("flex h-8 items-center gap-1.5 rounded-md border border-border px-2 text-xs text-muted transition-colors hover:border-border2 hover:text-txt md:px-2.5", focusRing)}
        >
          <Plug aria-hidden className="size-3.5" /><span className="max-md:sr-only">Connect</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-1.5rem)] border-border2 bg-surface p-3 text-txt">
        <p className="text-sm font-medium">Connect your AI agent</p>
        <p className="mt-1 text-xs text-muted">Add this MCP endpoint to Claude Code, Cursor or Windsurf. The board updates live as the agent works.</p>
        {row(endpoint, "Copy endpoint")}
        {row(command, "Copy claude mcp add command")}
        <p className="mt-3 font-mono text-[11px] text-muted">
          Last agent call: {lastAgo ? (lastAgo === "now" ? "just now" : `${lastAgo} ago`) : "none yet"}
        </p>
        <DropdownMenuItem asChild className="mt-1 -mx-2 text-xs text-muted focus:text-txt">
          <Link href="/settings">Agent configs and connection test in <span className="text-accent">Settings → MCP</span></Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
