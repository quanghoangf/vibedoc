"use client"

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

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const { loading, summary, projects, activeProject, liveIndicator, onProjectChange, board } = useApp()

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
    </AppShell>
  )
}
