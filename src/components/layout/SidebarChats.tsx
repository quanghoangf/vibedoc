"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { Loader2, MessagesSquare, Plus, X } from "lucide-react"
import {
  SidebarGroup, SidebarGroupAction, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuAction, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useChats } from "@/context/ChatContext"
import { AttachLabel, StatusMarker } from "@/components/chat/StatusMarker"
import { groupChats, isActionableError, shellStatus } from "@/lib/chats"
import { cn } from "@/lib/utils"
import { shortcutFor } from "@/lib/shortcuts"

/** Recent idle chats listed under the ones that need you, errored or running; the rest are on /chat. */
const RECENT_IN_SIDEBAR = 4
const PAGE_KEY = shortcutFor("/chat")
const kbdClass = "rounded-sm border border-border bg-surface2 px-1 font-mono text-[10px] leading-4 text-muted"

/** "Chats" section: chats waiting on you first, then actionable errors, running, then recent. Click opens the chat. */
export function SidebarChats() {
  return (
    <Suspense>
      <SidebarChatsInner />
    </Suspense>
  )
}

function SidebarChatsInner() {
  const { chats, loaded, modalId, show, create, dismiss, waitingCount, runningCount, errorCount, now } = useChats()
  const pathname = usePathname()
  const pageId = useSearchParams().get("id")
  const g = groupChats(chats, now)
  const listed = [...g.needsYou, ...g.errors, ...g.running, ...g.recent.slice(0, RECENT_IN_SIDEBAR)]
  const hidden = chats.length - listed.length
  const railTip = [runningCount && `${runningCount} running`, waitingCount && `${waitingCount} waiting for you`, errorCount && `${errorCount} with an error`]
    .filter(Boolean).join(" · ")
  const railLabel = railTip ? `Chats · ${railTip}` : "Chats"
  const isOpen = (id: string) => modalId === id || (pathname === "/chat" && pageId === id)

  return (
    <SidebarGroup role="group" aria-label="Chats">
      <SidebarGroupLabel>Chats</SidebarGroupLabel>
      <SidebarGroupAction title="New chat" onClick={() => show(create())}>
        <Plus />
        <span className="sr-only">New chat</span>
      </SidebarGroupAction>
      <SidebarGroupContent>
        <SidebarMenu>
          {/* Collapsed sidebar: one entry; spins while chats run, flags chats that wait on you (amber) or recently failed (red) */}
          <SidebarMenuItem className="hidden group-data-[collapsible=icon]:block">
            <SidebarMenuButton asChild tooltip={{ children: <span className="flex items-center gap-2">{railLabel}{PAGE_KEY && <kbd className={kbdClass}>{PAGE_KEY}</kbd>}</span> }} isActive={pathname === "/chat"}>
              <Link href="/chat" aria-keyshortcuts={PAGE_KEY} className="relative">
                {runningCount > 0 ? <Loader2 className="animate-spin text-accent" /> : <MessagesSquare />}
                <span>{railLabel}</span>
                {waitingCount > 0 && <span aria-hidden className="absolute right-1 top-1 size-1.5 rounded-full bg-amber animate-pulse-dot" />}
                {errorCount > 0 && <span aria-hidden className="absolute bottom-1 right-1 size-1.5 rounded-full bg-danger" />}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {loaded && chats.length === 0 && (
            <SidebarMenuItem className="group-data-[collapsible=icon]:hidden">
              <SidebarMenuButton onClick={() => show(create())} className="text-muted">
                <MessagesSquare />
                <span>Start a chat</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}

          {listed.map((c) => {
            const status = shellStatus(c, now)
            const alarm = isActionableError(c, now)
            return (
              <SidebarMenuItem key={c.id} className="group-data-[collapsible=icon]:hidden animate-slide-in">
                <SidebarMenuButton
                  onClick={() => show(c.id)}
                  isActive={isOpen(c.id)}
                  className={cn("h-8", status === "idle" && "text-muted", alarm && "pr-8")}
                  title={c.title}
                >
                  <StatusMarker status={status} showIdle />
                  <span className="min-w-0 flex-1 truncate">{c.title}</span>
                  {alarm && <span aria-hidden className="shrink-0 font-mono text-[10px] text-danger">error</span>}
                  {/* "Break down R043" already names its epic */}
                  {c.attach && !c.title.includes(c.attach.id) && <AttachLabel attach={c.attach} className="shrink-0 text-muted" />}
                </SidebarMenuButton>
                {alarm && (
                  <SidebarMenuAction title="Dismiss error" onClick={() => dismiss(c.id)} className="text-muted hover:text-txt">
                    <X />
                    <span className="sr-only">Dismiss error in {c.title}</span>
                  </SidebarMenuAction>
                )}
              </SidebarMenuItem>
            )
          })}

          {chats.length > 0 && (
            <SidebarMenuItem className="group-data-[collapsible=icon]:hidden">
              <SidebarMenuButton asChild isActive={pathname === "/chat" && !pageId} className="h-7 text-xs text-muted">
                <Link href="/chat" aria-keyshortcuts={PAGE_KEY}>
                  <MessagesSquare />
                  <span>{hidden > 0 ? `All chats · ${chats.length}` : "All chats"}</span>
                  {PAGE_KEY && <kbd aria-hidden className={cn(kbdClass, "ml-auto hidden group-hover/menu-item:inline group-focus-within/menu-item:inline")}>{PAGE_KEY}</kbd>}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
