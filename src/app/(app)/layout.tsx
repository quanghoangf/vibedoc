"use client"

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { AppProvider, useApp } from "@/context/AppContext"
import { SettingsApplier } from "@/components/shared/SettingsApplier"
import { LoadingScreen } from "@/components/shared/LoadingScreen"
import { AppHeader } from "@/components/layout/AppHeader"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { CommandPalette } from "@/components/layout/CommandPalette"
import { QuickOpen } from "@/components/layout/QuickOpen"
import { NewDocModal } from "@/components/docs/NewDocModal"
import { ChatPanel } from "@/components/chat/ChatPanel"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { ASK_AGENT_EVENT, OPEN_CHAT_EVENT } from "@/lib/ask-agent"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <SettingsApplier />
      <AppLayoutInner>{children}</AppLayoutInner>
    </AppProvider>
  )
}

const SHORTCUTS = [
  { key: "Cmd+K", description: "Open command palette" },
  { key: "Cmd+P", description: "Go to file" },
  { key: "b", description: "Go to Board" },
  { key: "d", description: "Go to Docs" },
  { key: "a", description: "Go to Activity" },
  { key: "m", description: "Go to Memory" },
  { key: "e", description: "Go to Explorer" },
  { key: "c", description: "Toggle agent chat" },
  { key: "/", description: "Focus doc search" },
  { key: "?", description: "Toggle this help" },
  { key: "Esc", description: "Close panel / modal" },
]

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const { loading, summary, projects, activeProject, liveIndicator, onProjectChange, board, openDoc, rootParam } = useApp()
  const router = useRouter()
  const pathname = usePathname()
  const [showHelp, setShowHelp] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)
  const [newDocOpen, setNewDocOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setCmdOpen(v => !v)
        return
      }
      // Overrides the browser's print shortcut
      if ((e.metaKey || e.ctrlKey) && e.key === "p") {
        e.preventDefault()
        setCmdOpen(false)
        setQuickOpen(v => !v)
        return
      }
      const tag = (e.target as Element)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA") return
      switch (e.key) {
        case "b": router.push("/board"); break
        case "d": router.push("/docs"); break
        case "a": router.push("/activity"); break
        case "m": router.push("/memory"); break
        case "e": router.push("/explorer"); break
        case "c": setChatOpen((v) => !v); break
        case "?": setShowHelp((v) => !v); break
        case "Escape": setShowHelp(false); break
        case "/":
          e.preventDefault()
          if (pathname === "/docs") {
            document.getElementById("doc-search")?.focus()
          } else {
            router.push("/docs")
          }
          break
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [router, pathname])

  // askAgent() / openAgentChat() from anywhere open the chat; ChatPanel sends the message or switches tab
  useEffect(() => {
    const open = () => setChatOpen(true)
    window.addEventListener(ASK_AGENT_EVENT, open)
    window.addEventListener(OPEN_CHAT_EVENT, open)
    return () => {
      window.removeEventListener(ASK_AGENT_EVENT, open)
      window.removeEventListener(OPEN_CHAT_EVENT, open)
    }
  }, [])

  if (loading) return <LoadingScreen />

  return (
    <SidebarProvider>
      <AppSidebar board={board} />
      <SidebarInset className="min-w-0">
        <AppHeader
          summary={summary}
          projects={projects}
          activeProject={activeProject}
          liveIndicator={liveIndicator}
          onProjectChange={onProjectChange}
          onToggleChat={() => setChatOpen((v) => !v)}
        />
        <div className="flex flex-1 min-h-0">
          <main className="flex-1 overflow-y-auto">{children}</main>
          {/* Stays mounted so it can slide both ways; inert keeps it out of tab order while closed */}
          <div
            inert={!chatOpen}
            className={cn(
              "shrink-0 overflow-hidden sticky top-12 h-[calc(100svh-3rem)] transition-[width] duration-[var(--duration-slow)] ease-out-soft",
              chatOpen ? "w-[380px]" : "w-0"
            )}
          >
            <ChatPanel onClose={() => setChatOpen(false)} />
          </div>
        </div>

        <QuickOpen
          open={quickOpen}
          onClose={() => setQuickOpen(false)}
          onOpenDoc={openDoc}
          rootParam={rootParam}
        />
        <CommandPalette
          open={cmdOpen}
          onClose={() => setCmdOpen(false)}
          onOpenDoc={openDoc}
          onNewDoc={() => { setCmdOpen(false); setNewDocOpen(true) }}
          rootParam={rootParam}
        />
        <NewDocModal
          open={newDocOpen}
          onOpenChange={setNewDocOpen}
          rootParam={rootParam}
          onDocCreated={async (path) => { await openDoc(path) }}
        />

        {/* Keyboard shortcuts help modal */}
        <Dialog open={showHelp} onOpenChange={setShowHelp}>
          <DialogContent aria-describedby={undefined} className="block w-80 p-5 rounded-xl sm:rounded-xl shadow-2xl">
            <DialogTitle className="font-display text-sm font-semibold text-txt mb-4">Keyboard shortcuts</DialogTitle>
            <table className="w-full text-xs">
              <tbody>
                {SHORTCUTS.map(({ key, description }) => (
                  <tr key={key} className="border-t border-border first:border-0">
                    <td className="py-1.5 pr-4">
                      <kbd className="font-mono bg-surface2 border border-border rounded-sm px-1.5 py-0.5 text-accent">
                        {key}
                      </kbd>
                    </td>
                    <td className="py-1.5 text-muted">{description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DialogContent>
        </Dialog>
      </SidebarInset>
    </SidebarProvider>
  )
}
