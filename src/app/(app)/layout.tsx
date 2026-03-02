"use client"

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { AppProvider, useApp } from "@/context/AppContext"
import { LoadingScreen } from "@/components/shared/LoadingScreen"
import { AppShell } from "@/components/layout/AppShell"
import { AppHeader } from "@/components/layout/AppHeader"
import { AppSidebar } from "@/components/layout/AppSidebar"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <AppLayoutInner>{children}</AppLayoutInner>
    </AppProvider>
  )
}

const SHORTCUTS = [
  { key: "b", description: "Go to Board" },
  { key: "d", description: "Go to Docs" },
  { key: "a", description: "Go to Activity" },
  { key: "m", description: "Go to Memory" },
  { key: "/", description: "Focus doc search" },
  { key: "?", description: "Toggle this help" },
  { key: "Esc", description: "Close panel / modal" },
]

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const { loading, summary, projects, activeProject, liveIndicator, onProjectChange, board } = useApp()
  const router = useRouter()
  const pathname = usePathname()
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as Element)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA") return
      switch (e.key) {
        case "b": router.push("/board"); break
        case "d": router.push("/docs"); break
        case "a": router.push("/activity"); break
        case "m": router.push("/memory"); break
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

  if (loading) return <LoadingScreen />

  return (
    <AppShell>
      <AppHeader
        summary={summary}
        projects={projects}
        activeProject={activeProject}
        liveIndicator={liveIndicator}
        onProjectChange={onProjectChange}
      />
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar board={board} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>

      {/* Keyboard shortcuts help modal */}
      {showHelp && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setShowHelp(false)} />
          <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 bg-surface border border-border rounded-xl shadow-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="font-display text-sm font-semibold text-txt">Keyboard shortcuts</span>
              <button
                onClick={() => setShowHelp(false)}
                className="text-muted hover:text-txt transition-colors text-lg leading-none"
              >
                ×
              </button>
            </div>
            <table className="w-full text-xs">
              <tbody>
                {SHORTCUTS.map(({ key, description }) => (
                  <tr key={key} className="border-t border-border first:border-0">
                    <td className="py-1.5 pr-4">
                      <kbd className="font-mono bg-surface2 border border-border rounded px-1.5 py-0.5 text-accent">
                        {key}
                      </kbd>
                    </td>
                    <td className="py-1.5 text-muted">{description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AppShell>
  )
}
