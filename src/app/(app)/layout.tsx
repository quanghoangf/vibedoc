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
import { Toaster } from "@/components/ui/toast"
import { ItemCommandKeys } from "@/components/shared/item-commands"
import { ChatProvider, useChats } from "@/context/ChatContext"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { HelpLauncher } from "@/components/layout/HelpLauncher"
import { DemoBanner } from "@/components/layout/DemoBanner"
import { CHAT_KEY, pageForKey, pageTitle, shouldHandleShortcut } from "@/lib/shortcuts"
import { useT } from "@/context/LanguageContext"

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

/** Pages that only write or spawn agents: the read-only demo (R042) shows a note instead */
const DEMO_BLOCKED = ["/chat", "/settings", "/setup"]

const skipLink = "sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-1.5 focus:text-xs focus:text-txt focus:ring-2 focus:ring-ring"

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const { loading, summary, projects, activeProject, liveIndicator, onProjectChange, board, openDoc, rootParam, demo, playground } = useApp()
  const router = useRouter()
  const pathname = usePathname()
  const [showHelp, setShowHelp] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)
  const [newDocOpen, setNewDocOpen] = useState(false)
  const { showDefault } = useChats()
  const { t } = useT()
  const keyboardRef = useRef(false)
  const prevPathRef = useRef(pathname)

  // Route announcements: the tab title names the page, and after a keyboard navigation focus moves to
  // #main so screen readers land on the new page. Keeps ChatContext's "(n) " waiting prefix.
  const projectName = summary?.name
  useEffect(() => {
    const key = pageTitle(pathname)
    const page = key && t(key)
    const base = [page, projectName].filter(Boolean).join(" · ")
    const prefix = document.title.match(/^\(\d+\) /)?.[0] ?? ""
    document.title = `${prefix}${base ? `${base} — ` : ""}VibeDoc`
    if (prevPathRef.current === pathname) return // initial load or project name change: don't steal focus
    prevPathRef.current = pathname
    if (keyboardRef.current) document.getElementById("main")?.focus({ preventScroll: true })
  }, [pathname, projectName, t])

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
        case CHAT_KEY: if (demo) break; e.preventDefault(); showDefault(); break
        case "?": setShowHelp((v) => !v); break
        case "Escape": setShowHelp(false); break
        case "/":
          e.preventDefault()
          if (pathname === "/docs") {
            document.getElementById("doc-search")?.focus()
          } else if (pathname === "/board") {
            document.getElementById("board-search")?.focus()
          } else if (pathname === "/graph") {
            document.getElementById("graph-search")?.focus()
          } else {
            router.push("/docs")
          }
          break
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [router, pathname, showDefault, demo])

  if (loading) return <LoadingScreen />

  return (
    <SidebarProvider>
      {/* The sidebar precedes the header in the DOM (shadcn's peer selectors need it), so the agent strip gets its own skip link */}
      <a href="#agent-status" className={skipLink}>{t("shell.skipToAgents")}</a>
      <a href="#main" className={skipLink}>{t("shell.skipToContent")}</a>
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
        {playground && <DemoBanner />}
        <main id="main" tabIndex={-1} className="flex-1 min-h-0 overflow-y-auto outline-none">
          {demo && DEMO_BLOCKED.some((p) => pathname.startsWith(p)) ? (
            <p className="p-8 text-sm text-muted">{t("shell.demoBlockedLead")} <code className="font-mono text-txt">npx vibedoc</code> {t("shell.demoBlockedEnd")}</p>
          ) : children}
        </main>
        {!demo && <ChatModal />}
        <Toaster />
        <ItemCommandKeys />

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
          onNewDoc={demo ? undefined : () => { setCmdOpen(false); setNewDocOpen(true) }}
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

        {/* Help, bottom-right: hover peeks at this page's keys and tips; ?, the sidebar and ⌘K pin it */}
        <HelpLauncher pinned={showHelp} onPinnedChange={setShowHelp} />
      </SidebarInset>
    </SidebarProvider>
  )
}
