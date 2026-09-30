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
import { ChatModal } from "@/components/chat/ChatModal"
import { ChatProvider, useChats } from "@/context/ChatContext"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <SettingsApplier />
      <ChatProvider>
        <AppLayoutInner>{children}</AppLayoutInner>
      </ChatProvider>
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
  { key: "c", description: "Open agent chat" },
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
  const { modalId, closeModal, showDefault } = useChats()

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
        // preventDefault: the modal autofocuses its composer, which would otherwise receive this "c"
        case "c": e.preventDefault(); if (modalId) closeModal(); else showDefault(); break
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
  }, [router, pathname, modalId, closeModal, showDefault])

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
          onToggleChat={() => (modalId ? closeModal() : showDefault())}
          onOpenSearch={() => setCmdOpen(true)}
        />
        <main className="flex-1 min-h-0 overflow-y-auto">{children}</main>
        <ChatModal />

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
