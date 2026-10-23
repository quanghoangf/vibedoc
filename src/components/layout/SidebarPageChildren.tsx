"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ChevronRight } from "lucide-react"
import { SidebarMenuAction, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem } from "@/components/ui/sidebar"
import { useApp } from "@/context/AppContext"
import { useT } from "@/context/LanguageContext"
import { countNeedsYou } from "@/lib/test-review"
import { localToday, roadmapHealth } from "@/lib/roadmap-health"
import { CHILD_PAGES, isExpanded, sidebarChildren, type SidebarChild, type SidebarPage } from "@/lib/sidebar-items"
import type { RoadmapItem } from "@/lib/core"
import { cn } from "@/lib/utils"
import { setPageOpen, useDisclosure } from "./sidebar-store"

type SidebarData = {
  roadmap: RoadmapItem[]
  lint: { path: string; errors: number; outdated: number }[]
  cleanupFlags: number
  docs: { path: string; name: string }[]
}

// Streams and bookkeeping that never change what the sidebar lists
const QUIET_EVENTS = new Set(["chat_saved", "test_run", "suite_run", "agent_connected", "doc_usage_updated", "views_updated"])

/** Children per page (T511): the board is live from AppContext, the rest from /api/sidebar, refetched on SSE. */
export function usePageChildren(): Record<SidebarPage, SidebarChild[]> {
  const { board, rootParam, activeProject } = useApp()
  const [data, setData] = useState<SidebarData | null>(null)

  useEffect(() => {
    if (!activeProject) return
    let live = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const load = () => {
      fetch(`/api/sidebar${rootParam}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: SidebarData | null) => { if (live && d) setData(d) })
        .catch(() => {}) // the last good list stays; the next event retries
    }
    load()
    // One fetch per burst of changes (an agent finishing a task sends several)
    const onSse = (e: Event) => {
      const msg = (e as CustomEvent).detail
      // a map drag only moves positions
      if (QUIET_EVENTS.has(msg?.type) || (msg?.type === "roadmap_updated" && msg.payload?.kind === "layout")) return
      clearTimeout(timer)
      timer = setTimeout(load, 600)
    }
    window.addEventListener("vibedoc:sse", onSse)
    return () => { live = false; clearTimeout(timer); window.removeEventListener("vibedoc:sse", onSse) }
  }, [activeProject, rootParam])

  return useMemo(() => {
    const tasks = board ? Object.values(board).flat() : []
    const byId = Object.fromEntries(tasks.map((t) => [t.id, t]))
    // drift against the live board, so approving a task clears its epic without waiting for a refetch
    const drift = data ? roadmapHealth(data.roadmap, byId, localToday()).drift : []
    return sidebarChildren({
      tasks,
      needsYou: (t) => countNeedsYou([t]) > 0,
      epics: data?.roadmap ?? null,
      drift,
      docs: data?.docs ?? null,
      lint: data?.lint ?? [],
      cleanupFlags: data?.cleanupFlags ?? 0,
    })
  }, [board, data])
}

export function isChildPage(href: string): href is SidebarPage {
  return (CHILD_PAGES as string[]).includes(href)
}

/** Open state + the ←/→ keys for a page row; collapsed until you open it (the row then shows a needs-you dot). */
export function usePageDisclosure(page: SidebarPage, kids: SidebarChild[]) {
  const disclosure = useDisclosure()
  const needsAction = kids.length > 0
  const open = needsAction && isExpanded(page, disclosure)
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!kids.length || e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return
    if (e.key === "ArrowRight" && !open) { e.preventDefault(); setPageOpen(page, true) }
    if (e.key === "ArrowLeft" && open) { e.preventDefault(); setPageOpen(page, false) }
  }
  return { open, needsAction, onKeyDown, toggle: () => setPageOpen(page, !open) }
}

export function PageDisclosureButton({ page, label, open }: { page: SidebarPage; label: string; open: boolean }) {
  const { t } = useT()
  const name = t(open ? "shell.hidePageItems" : "shell.showPageItems", { page: label })
  return (
    <SidebarMenuAction
      onClick={() => setPageOpen(page, !open)}
      aria-expanded={open}
      aria-controls={`sidebar-items-${page.slice(1)}`}
      title={name}
      className="text-muted hover:text-txt"
    >
      <ChevronRight className={cn("transition-transform duration-150 ease-out", open && "rotate-90")} />
      <span className="sr-only">{name}</span>
    </SidebarMenuAction>
  )
}

const MARK: Record<SidebarChild["tone"], string> = {
  danger: "bg-danger",
  warn: "bg-amber",
  review: "bg-review",
  muted: "border border-border2",
}
const HINT_TONE: Record<SidebarChild["tone"], string> = {
  danger: "text-danger",
  warn: "text-amber",
  review: "text-review",
  muted: "text-muted",
}

export function PageChildren({ page, label, kids }: { page: SidebarPage; label: string; kids: SidebarChild[] }) {
  const { t, tn } = useT()
  const { openDoc } = useApp()
  const hint = (c: SidebarChild) => {
    switch (c.hint) {
      case "checks": return tn("shell.hintChecks", c.n ?? 0)
      case "lint": return tn("shell.hintLint", c.n ?? 0)
      case "cleanup": return tn("shell.hintCleanup", c.n ?? 0)
      case "review": return t("shell.hintReview")
      case "blocked": return t("shell.hintBlocked")
      case "failed": return t("shell.hintFailed")
      case "unverified": return t("shell.hintUnverified")
      case "overdue": return t("shell.hintOverdue")
      case "at-risk": return t("shell.hintAtRisk")
      case "drift": return t("shell.hintDrift")
      case "outdated": return t("shell.hintOutdated")
    }
  }
  return (
    <SidebarMenuSub id={`sidebar-items-${page.slice(1)}`} aria-label={t("shell.pageItems", { page: label })} className="animate-slide-in gap-0.5">
      {kids.map((c) => {
        const text = c.kind === "cleanup" ? t("shell.cleanupItem") : c.label
        const h = hint(c)
        return (
          <SidebarMenuSubItem key={c.key} data-sidebar-child={c.reason} data-ref={c.id || c.kind}>
            <SidebarMenuSubButton
              asChild
              size="sm"
              className="h-6 gap-1.5 pr-1.5 text-txt"
              title={[c.id, c.label, h].filter(Boolean).join(" · ")}
            >
              <Link
                href={c.href}
                onClick={c.kind === "doc" ? (e) => {
                  // openDoc also loads it when /docs is already open (its ?doc= is read only on arrival)
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
                  e.preventDefault()
                  openDoc(c.id)
                } : undefined}
              >
                <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", MARK[c.tone])} />
                {(c.kind === "task" || c.kind === "epic") && (
                  <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted">{c.id}</span>
                )}
                <span data-user-content={c.label ? "" : undefined} className="min-w-0 flex-1 truncate">{text}</span>
                {h && <span className={cn("shrink-0 text-[10px]", HINT_TONE[c.tone])}>{h}</span>}
              </Link>
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>
        )
      })}
    </SidebarMenuSub>
  )
}
