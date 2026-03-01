"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import type { TaskBoard } from "@/types"
import { STATUS_ICONS } from "@/components/board/TaskCard"

const NAV_ITEMS = [
  { href: "/board", icon: "⬡", label: "Board" },
  { href: "/docs", icon: "📚", label: "Docs" },
  { href: "/activity", icon: "⚡", label: "Activity" },
  { href: "/memory", icon: "🧠", label: "Memory" },
]

const BOARD_STATS = [
  { status: "in-progress", label: "Active" },
  { status: "blocked", label: "Blocked" },
  { status: "todo", label: "Todo" },
  { status: "done", label: "Done" },
]

interface AppSidebarProps {
  board: TaskBoard | null
}

export function AppSidebar({ board }: AppSidebarProps) {
  const pathname = usePathname()

  return (
    <nav className="w-48 border-r border-border flex-shrink-0 flex flex-col py-3 gap-0.5 px-2">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all",
              isActive
                ? "bg-accent/10 text-accent border border-accent/20"
                : "text-muted hover:text-txt hover:bg-surface2",
            )}
          >
            <span className="text-base leading-none">{item.icon}</span>
            <span className="font-medium">{item.label}</span>
          </Link>
        )
      })}

      {board && (
        <div className="mt-auto pt-3 border-t border-border px-1">
          {BOARD_STATS.map(({ status, label }) => {
            const count = board[status as keyof TaskBoard]?.length || 0
            return (
              <div key={status} className="flex justify-between items-center py-1 px-1 text-xs">
                <span className="text-muted">
                  {STATUS_ICONS[status]} {label}
                </span>
                <span className="font-mono text-txt">{count}</span>
              </div>
            )
          })}
        </div>
      )}
    </nav>
  )
}
