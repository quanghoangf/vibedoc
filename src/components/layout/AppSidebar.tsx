"use client"

import { LayoutDashboard, BookOpen, Zap, Brain, CircleDot, Ban, ClipboardList, CheckCircle2, Settings, FolderTree, Map, FlaskConical, Eye } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import type { TaskBoard } from "@/types"
import { cn } from "@/lib/utils"
import { SidebarChats } from "./SidebarChats"

const NAV_ITEMS = [
  { href: "/board", icon: LayoutDashboard, label: "Board" },
  { href: "/roadmap", icon: Map, label: "Roadmap" },
  { href: "/docs", icon: BookOpen, label: "Docs" },
  { href: "/activity", icon: Zap, label: "Activity" },
  { href: "/memory", icon: Brain, label: "Memory" },
  { href: "/manual-tests", icon: FlaskConical, label: "Manual tests" },
  { href: "/explorer", icon: FolderTree, label: "Explorer" },
  { href: "/settings", icon: Settings, label: "Settings" },
]


interface AppSidebarProps {
  board: TaskBoard | null
}

export function AppSidebar({ board }: AppSidebarProps) {
  const pathname = usePathname()
  // Unticked manual test items across all tasks (R043)
  const untested = board ? Object.values(board).flat().reduce((n, t) => n + (t.manualTests ? t.manualTests.total - t.manualTests.done : 0), 0) : 0
  // Work in flight on the board (the counts that used to sit in a separate "Board" section and the header)
  const active = board ? board["in-progress"].length + board.review.length : 0
  const badge: Record<string, { n: number; label: string; tone: string }> = {
    "/board": { n: active, label: `${active} in progress or in review`, tone: "text-muted" },
    "/manual-tests": { n: untested, label: `${untested} unticked`, tone: "text-amber" },
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="grid size-6 shrink-0 place-items-center rounded-md bg-linear-to-br from-accent to-teal text-xs text-white">
            ⬡
          </div>
          <span className="text-sm font-semibold tracking-tight text-txt group-data-[collapsible=icon]:hidden">VibeDoc</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map(({ href, icon: Icon, label }) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton asChild isActive={pathname.startsWith(href)} tooltip={label}>
                    <Link href={href}>
                      <Icon />
                      <span>{label}</span>
                      {badge[href]?.n > 0 && (
                        <span className={cn("ml-auto font-mono text-[10px] tabular-nums", badge[href].tone)} aria-label={badge[href].label}>{badge[href].n}</span>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator />
        <SidebarChats />
      </SidebarContent>
    </Sidebar>
  )
}
