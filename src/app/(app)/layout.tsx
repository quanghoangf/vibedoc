"use client"

import { useState, useEffect, useRef } from "react"
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
import { CHAT_KEY, OTHER_SHORTCUTS, PAGE_SHORTCUTS, pageForKey, pageTitle, shouldHandleShortcut } from "@/lib/shortcuts"

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

const SHORTCUT_SECTIONS = [
  { title: "Go to", rows: PAGE_SHORTCUTS.map(({ key, label, help }) => ({ key, description: help ?? label })) },
  ...(["Open", "Board", "Editing & other"] as const).map((title) => ({
    title, rows: OTHER_SHORTCUTS.filter((s) => s.section === title).map(({ key, label }) => ({ key, description: label })),
  })),
]

const skipLink = "sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-1.5 focus:text-xs focus:text-txt focus:ring-2 focus:ring-ring"

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const { loading, summary, projects, activeProject, liveIndicator, onProjectChange, board, openDoc, rootParam } = useApp()
  const router = useRouter()
  const pathname = usePathname()
  const [showHelp, setShowHelp] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)
  const [newDocOpen, setNewDocOpen] = useState(false)
  const { showDefault } = useChats()
  const keyboardRef = useRef(false)
  const prevPathRef = useRef(pathname)

  // Route announcements: the tab title names the page, and after a keyboard navigation focus moves to
  // #main so screen readers land on the new page. Keeps ChatContext's "(n) " waiting prefix.
  const projectName = summary?.name
  useEffect(() => {
    const page = pageTitle(pathname)
    const base = [page, projectName].filter(Boolean).join(" · ")
    const prefix = document.title.match(/^\(\d+\) /)?.[0] ?? ""
    document.title = `${prefix}${base ? `${base} — ` : ""}VibeDoc`
    if (prevPathRef.current === pathname) return // initial load or project name change: don't steal focus
    prevPathRef.current = pathname
    if (keyboardRef.current) document.getElementById("main")?.focus({ preventScroll: true })
  }, [pathname, projectName])

  // Last input was a key (not a pointer)? Decides whether a route change moves focus.
  useEffect(() => {
    const onKey = () => { keyboardRef.current = true }
    const onPointer = () => { keyboardRef.current = false }
    window.addEventListener("keydown", onKey, true)
    window.addEventListener("pointerdown", onPointer, true)
    return () => {
      window.removeEventListener("keydown", onKey, true)
      window.removeEventListener("pointerdown", onPointer, true)
    }
  }, [])

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
      // ⌘B (sidebar, owned by shadcn), ⌘C etc. keep their normal meaning
      if (!shouldHandleShortcut(e)) return
      const href = pageForKey(e.key)
      if (href) { router.push(href); return }
      switch (e.key) {
        // preventDefault: the modal autofocuses its composer, which would otherwise receive this "c"
        case CHAT_KEY: e.preventDefault(); showDefault(); break
        case "?": setShowHelp((v) => !v); break
        case "Escape": setShowHelp(false); break
        case "/":
          e.preventDefault()
          if (pathname === "/docs") {
            document.getElementById("doc-search")?.focus()
          } else if (pathname === "/board") {
            document.getElementById("board-search")?.focus()
          } else {
            router.push("/docs")
          }
          break
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [router, pathname, showDefault])

  if (loading) return <LoadingScreen />

  return (
    <SidebarProvider>
      {/* The sidebar precedes the header in the DOM (shadcn's peer selectors need it), so the agent strip gets its own skip link */}
      <a href="#agent-status" className={skipLink}>Skip to agent status</a>
      <a href="#main" className={skipLink}>Skip to content</a>
      <AppSidebar board={board} />
      <SidebarInset className="min-w-0">
        <AppHeader
          summary={summary}
          projects={projects}
          activeProject={activeProject}
          liveIndicator={liveIndicator}
          onProjectChange={onProjectChange}
          onToggleChat={showDefault}
          onOpenSearch={() => setCmdOpen(true)}
        />
        <main id="main" tabIndex={-1} className="flex-1 min-h-0 overflow-y-auto outline-none">{children}</main>
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
          onQuickOpen={() => { setCmdOpen(false); setQuickOpen(true) }}
          onShowHelp={() => { setCmdOpen(false); setShowHelp(true) }}
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
            {SHORTCUT_SECTIONS.map(({ title, rows }) => (
              <table key={title} className="w-full text-xs mt-3 first-of-type:mt-0">
                <caption className="pb-1 text-left font-mono text-[10px] uppercase tracking-[0.06em] text-muted">{title}</caption>
                <tbody>
                  {rows.map(({ key, description }) => (
                    <tr key={key} className="border-t border-border first:border-0">
                      <td className="py-1.5 pr-4 w-16 whitespace-nowrap">
                        <kbd className="font-mono bg-surface2 border border-border rounded-sm px-1.5 py-0.5 text-txt">
                          {key}
                        </kbd>
                      </td>
                      <td className="py-1.5 text-muted">{description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
          </DialogContent>
        </Dialog>
      </SidebarInset>
    </SidebarProvider>
  )
}
