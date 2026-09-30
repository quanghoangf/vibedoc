"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { Bot, Check, Copy, Plug, Search } from "lucide-react"
import type { Project, Summary } from "@/types"
import { useChats } from "@/context/ChatContext"
import { ProjectSwitcher } from "./ProjectSwitcher"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useOrigin } from "@/hooks/use-origin"
import { cn } from "@/lib/utils"

const PAGE_TITLES: Record<string, string> = {
  "/board": "Board",
  "/roadmap": "Roadmap",
  "/docs": "Docs",
  "/activity": "Activity",
  "/memory": "Memory",
  "/manual-tests": "Manual tests",
  "/explorer": "Explorer",
  "/settings": "Settings",
  "/chat": "Agents",
}

interface AppHeaderProps {
  summary: Summary | null
  projects: Project[]
  activeProject: string
  liveIndicator: boolean
  onProjectChange: (root: string) => void
  onToggleChat: () => void
  onOpenSearch: () => void
}

/** Where you are (project / page) on the left; search, connection and the agent on the right. */
export function AppHeader({ summary, projects, activeProject, liveIndicator, onProjectChange, onToggleChat, onOpenSearch }: AppHeaderProps) {
  const pathname = usePathname()
  const title = Object.entries(PAGE_TITLES).find(([p]) => pathname.startsWith(p))?.[1]
  const waiting = useChats().waitingCount

  return (
    <header className="sticky top-0 z-50 flex h-12 shrink-0 items-center gap-2 border-b border-border bg-surface/80 px-3 backdrop-blur-xs sm:px-4">
      <SidebarTrigger className="-ml-1 text-muted hover:text-txt" />
      <span className="mx-1 h-4 w-px bg-border" aria-hidden />

      <nav aria-label="Location" className="flex min-w-0 items-center gap-1.5 text-sm">
        <ProjectSwitcher projects={projects} activeProject={activeProject} currentName={summary?.name || ""} onSelect={onProjectChange} />
        {title && (
          <>
            <span className="hidden text-muted/60 sm:inline" aria-hidden>/</span>
            <span className="hidden truncate font-medium text-txt sm:inline">{title}</span>
          </>
        )}
      </nav>

      <div className="flex-1" />

      <span
        title={liveIndicator ? "Receiving live updates" : "Connected, waiting for changes"}
        className={cn(
          "hidden size-1.5 rounded-full transition-[background-color,box-shadow] duration-500 sm:block",
          liveIndicator ? "bg-teal shadow-[0_0_6px_var(--color-teal)]" : "bg-border2",
        )}
      />

      <button
        type="button"
        onClick={onOpenSearch}
        className="flex h-8 items-center gap-2 rounded-md border border-border bg-bg/60 px-2 text-xs text-muted transition-colors hover:border-border2 hover:text-txt sm:w-48 sm:px-2.5"
      >
        <Search className="size-3.5" />
        <span className="hidden flex-1 text-left sm:inline">Search…</span>
        <kbd className="hidden rounded-sm border border-border px-1 font-mono text-[10px] sm:inline">⌘K</kbd>
        <span className="sr-only sm:hidden">Search</span>
      </button>

      <ConnectMenu />

      <button
        type="button"
        onClick={onToggleChat}
        title={waiting ? `Agent chat (c) · ${waiting} waiting for you` : "Agent chat (c)"}
        className="relative flex h-8 items-center gap-1.5 rounded-md bg-accent px-2.5 text-xs font-medium text-white transition-[filter] hover:brightness-110"
      >
        <Bot className="size-3.5" />
        <span className="hidden sm:inline">Agent</span>
        {waiting > 0 && (
          <span
            aria-label={`${waiting} waiting for you`}
            className="absolute -right-1.5 -top-1.5 h-4 min-w-4 rounded-full bg-amber px-1 text-center text-[10px] font-semibold leading-4 text-bg"
          >
            {waiting}
          </span>
        )}
      </button>
    </header>
  )
}

/** The MCP endpoint an agent connects to, with a copy button. It used to sit in the header as raw text. */
function ConnectMenu() {
  const endpoint = `${useOrigin()}/api/mcp`
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(endpoint)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (e) {
      console.warn("[vibedoc] could not copy the MCP endpoint:", e)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title="Connect an AI agent (MCP)"
          className="hidden h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs text-muted transition-colors hover:border-border2 hover:text-txt md:flex"
        >
          <Plug className="size-3.5" /> Connect
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 border-border2 bg-surface p-3 text-txt">
        <p className="text-sm font-medium">Connect your AI agent</p>
        <p className="mt-1 text-xs text-muted">Add this MCP endpoint to Claude Code, Cursor or Windsurf. The board updates live as the agent works.</p>
        <div className="mt-3 flex items-center gap-1 rounded-md border border-border bg-bg px-2 py-1.5">
          <code className="min-w-0 flex-1 truncate font-mono text-xs text-accent">{endpoint}</code>
          <button type="button" onClick={copy} aria-label="Copy endpoint" className="grid size-6 place-items-center rounded-sm text-muted hover:bg-surface2 hover:text-txt">
            {copied ? <Check className="size-3.5 text-teal" /> : <Copy className="size-3.5" />}
          </button>
        </div>
        <Link href="/settings" className="mt-3 inline-block text-xs text-accent hover:underline">Agent configs and connection test in Settings → MCP</Link>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
