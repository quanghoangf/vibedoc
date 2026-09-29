"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { Bot, MessagesSquare, Plus } from "lucide-react"
import {
  SidebarGroup, SidebarGroupAction, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useChats } from "@/context/ChatContext"
import { AttachLabel, StatusMarker } from "@/components/chat/StatusMarker"
import { chatStatus, groupChats } from "@/lib/chats"
import { cn } from "@/lib/utils"

/** Recent idle chats listed under the ones that need you or are running; the rest are on /chat. */
const RECENT_IN_SIDEBAR = 4

/** "Agents" section: chats waiting on you first, then running, then recent. Click opens the chat. */
export function SidebarChats() {
  return (
    <Suspense>
      <SidebarChatsInner />
    </Suspense>
  )
}

function SidebarChatsInner() {
  const { chats, loaded, modalId, show, create, waitingCount, runningCount } = useChats()
  const pathname = usePathname()
  const pageId = useSearchParams().get("id")
  const g = groupChats(chats)
  const listed = [...g.needsYou, ...g.running, ...g.recent.slice(0, RECENT_IN_SIDEBAR)]
  const hidden = chats.length - listed.length
  const isOpen = (id: string) => modalId === id || (pathname === "/chat" && pageId === id)

  return (
    <SidebarGroup role="group" aria-label="Agent chats">
      <SidebarGroupLabel className="gap-2">
        Agents
        {runningCount > 0 && <span className="font-mono text-[10px] normal-case tracking-normal text-accent">{runningCount} running</span>}
      </SidebarGroupLabel>
      <SidebarGroupAction title="New chat" onClick={() => show(create())}>
        <Plus />
        <span className="sr-only">New chat</span>
      </SidebarGroupAction>
      <SidebarGroupContent>
        <SidebarMenu>
          {/* Collapsed sidebar: one entry with the waiting count */}
          <SidebarMenuItem className="hidden group-data-[collapsible=icon]:block">
            <SidebarMenuButton asChild tooltip={waitingCount ? `Agents · ${waitingCount} waiting for you` : "Agents"} isActive={pathname === "/chat"}>
              <Link href="/chat" className="relative">
                <Bot />
                <span>Agents</span>
                {waitingCount > 0 && <span className="absolute right-1 top-1 size-1.5 rounded-full bg-amber animate-pulse-dot" />}
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
            const status = chatStatus(c)
            return (
              <SidebarMenuItem key={c.id} className="group-data-[collapsible=icon]:hidden animate-slide-in">
                <SidebarMenuButton
                  onClick={() => show(c.id)}
                  isActive={isOpen(c.id)}
                  className={cn("h-8", status === "idle" && "text-muted")}
                  title={c.title}
                >
                  <StatusMarker status={status} showIdle />
                  <span className="min-w-0 flex-1 truncate">{c.title}</span>
                  {c.attach && <AttachLabel attach={c.attach} className="shrink-0 text-muted" />}
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}

          {chats.length > 0 && (
            <SidebarMenuItem className="group-data-[collapsible=icon]:hidden">
              <SidebarMenuButton asChild isActive={pathname === "/chat" && !pageId} className="h-7 text-xs text-muted">
                <Link href="/chat">
                  <MessagesSquare />
                  <span>{hidden > 0 ? `All chats · ${chats.length}` : "All chats"}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
