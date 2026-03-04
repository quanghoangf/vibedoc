"use client"

import { LayoutDashboard, BookOpen, Zap, Brain, CircleDot, Ban, ClipboardList, CheckCircle2, Settings } from "lucide-react"
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

const NAV_ITEMS = [
  { href: "/board", icon: LayoutDashboard, label: "Board" },
  { href: "/docs", icon: BookOpen, label: "Docs" },
  { href: "/activity", icon: Zap, label: "Activity" },
  { href: "/memory", icon: Brain, label: "Memory" },
  { href: "/settings", icon: Settings, label: "Settings" },
]

const BOARD_STATS = [
  { status: "in-progress", icon: CircleDot, label: "Active" },
  { status: "blocked", icon: Ban, label: "Blocked" },
  { status: "todo", icon: ClipboardList, label: "Todo" },
  { status: "done", icon: CheckCircle2, label: "Done" },
]

interface AppSidebarProps {
  board: TaskBoard | null
}

export function AppSidebar({ board }: AppSidebarProps) {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-accent to-teal flex items-center justify-center text-xs flex-shrink-0">
            ⬡
          </div>
          <span className="font-mono text-xs text-muted tracking-widest uppercase group-data-[collapsible=icon]:hidden">
            VibeDoc
          </span>
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
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {board && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Board</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {BOARD_STATS.map(({ status, icon: Icon, label }) => {
                    const count = board[status as keyof TaskBoard]?.length || 0
                    return (
                      <SidebarMenuItem key={status}>
                        <SidebarMenuButton tooltip={`${label}: ${count}`}>
                          <Icon />
                          <span>{label}</span>
                          <span className="ml-auto font-mono text-xs">{count}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>
    </Sidebar>
  )
}
