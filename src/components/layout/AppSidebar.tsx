"use client"

import { LayoutDashboard, BookOpen, Zap, Brain, Settings, FolderTree, Map, FlaskConical, Hexagon, Keyboard, Waypoints } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import type { TaskBoard } from "@/types"
import { cn } from "@/lib/utils"
import { shortcutFor } from "@/lib/shortcuts"
import { VIBEDOC_VERSION } from "@/lib/version"
import { SidebarChats } from "./SidebarChats"

// Chats lead the shell (SidebarChats); pages follow, grouped by what you do there. Settings sits in the footer.
const NAV_GROUPS = [
  {
    label: "Plan & supervise",
    items: [
      { href: "/board", icon: LayoutDashboard, label: "Board" },
      { href: "/roadmap", icon: Map, label: "Roadmap" },
      { href: "/manual-tests", icon: FlaskConical, label: "Manual tests" },
      { href: "/activity", icon: Zap, label: "Activity" },
    ],
  },
  {
    label: "Reference",
    items: [
      { href: "/docs", icon: BookOpen, label: "Docs" },
      { href: "/memory", icon: Brain, label: "Memory" },
      { href: "/explorer", icon: FolderTree, label: "Explorer" },
      { href: "/graph", icon: Waypoints, label: "Graph" },
    ],
  },
]

const kbdClass = "rounded-sm border border-border bg-surface2 px-1 font-mono text-[10px] leading-4 text-muted"

/** The help sheet lives in (app)/layout.tsx behind the "?" key; a synthetic keydown reaches it without new plumbing. */
function openShortcutHelp() {
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "?" }))
}


interface AppSidebarProps {
  board: TaskBoard | null
}

export function AppSidebar({ board }: AppSidebarProps) {
  const pathname = usePathname()
  const settingsKey = shortcutFor("/settings")
  // Unticked manual test items across all tasks (R043)
  const untested = board ? Object.values(board).flat().reduce((n, t) => n + (t.manualTests ? t.manualTests.total - t.manualTests.done : 0), 0) : 0
  // Work in flight on the board (the counts that used to sit in a separate "Board" section and the header)
  const active = board ? board["in-progress"].length + board.review.length : 0
  // Advisory counts, so muted: nothing here needs you right now
  const badge: Record<string, { n: number; label: string }> = {
    "/board": { n: active, label: "in progress or in review" },
    "/manual-tests": { n: untested, label: "unticked" },
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          <div aria-hidden className="grid size-6 shrink-0 place-items-center rounded-md bg-accent text-accent-fg">
            <Hexagon className="size-3.5" strokeWidth={2.5} />
          </div>
          <span className="text-sm font-semibold tracking-tight text-txt group-data-[collapsible=icon]:hidden">VibeDoc</span>
          <span title="VibeDoc version" className="truncate font-mono text-[11px] text-muted group-data-[collapsible=icon]:hidden">v{VIBEDOC_VERSION}</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarChats />
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map(({ href, icon: Icon, label }) => {
                  const key = shortcutFor(href)
                  const b = badge[href]
                  return (
                    <SidebarMenuItem key={href}>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname.startsWith(href)}
                        tooltip={{ children: <span className="flex items-center gap-2">{label}{key && <kbd className={kbdClass}>{key}</kbd>}</span> }}
                      >
                        <Link href={href} aria-keyshortcuts={key}>
                          <Icon />
                          <span>{label}</span>
                          {b?.n > 0 && (
                            <span className="ml-auto font-mono text-[10px] tabular-nums text-muted">{b.n}<span className="sr-only"> {b.label}</span></span>
                          )}
                          {key && <kbd aria-hidden className={cn(kbdClass, !(b?.n > 0) && "ml-auto", "hidden group-hover/menu-item:inline group-focus-within/menu-item:inline")}>{key}</kbd>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={openShortcutHelp} aria-keyshortcuts="?" tooltip="Keyboard shortcuts (?)" className="text-muted">
              <Keyboard />
              <span>Shortcuts</span>
              <kbd aria-hidden className={cn(kbdClass, "ml-auto")}>?</kbd>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname.startsWith("/settings")} tooltip={{ children: <span className="flex items-center gap-2">Settings<kbd className={kbdClass}>{settingsKey}</kbd></span> }}>
              <Link href="/settings" aria-keyshortcuts={settingsKey}>
                <Settings />
                <span>Settings</span>
                <kbd aria-hidden className={cn(kbdClass, "ml-auto hidden group-hover/menu-item:inline group-focus-within/menu-item:inline")}>{settingsKey}</kbd>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
