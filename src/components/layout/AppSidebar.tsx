"use client"

import { LayoutDashboard, BookOpen, Zap, Brain, Settings, FolderTree, Map, FlaskConical, Hexagon, Keyboard, Waypoints, Folders, Inbox } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import { shortcutFor } from "@/lib/shortcuts"
import { VIBEDOC_VERSION } from "@/lib/version"
import { SidebarChats } from "./SidebarChats"
import { FirstWeek } from "./FirstWeek"
import { isChildPage, PageChildren, PageDisclosureButton, usePageChildren, usePageDisclosure } from "./SidebarPageChildren"
import type { SidebarChild, SidebarPage } from "@/lib/sidebar-items"
import { useApp } from "@/context/AppContext"
import { useT } from "@/context/LanguageContext"
import type { MessageKey } from "@/i18n"

// Chats lead the shell (SidebarChats); pages follow, grouped by what you do there. Settings sits in the footer.
const NAV_GROUPS: { label: MessageKey; items: { href: string; icon: typeof Map; label: MessageKey }[] }[] = [
  {
    label: "shell.groupPlan",
    items: [
      { href: "/board", icon: LayoutDashboard, label: "shell.board" },
      { href: "/roadmap", icon: Map, label: "shell.roadmap" },
      { href: "/manual-tests", icon: FlaskConical, label: "shell.manualTests" },
      { href: "/activity", icon: Zap, label: "shell.activity" },
    ],
  },
  {
    label: "shell.groupReference",
    items: [
      { href: "/docs", icon: BookOpen, label: "shell.docs" },
      { href: "/memory", icon: Brain, label: "shell.memory" },
      { href: "/explorer", icon: FolderTree, label: "shell.explorer" },
      { href: "/graph", icon: Waypoints, label: "shell.graph" },
    ],
  },
]

const kbdClass = "rounded-sm border border-border bg-surface2 px-1 font-mono text-[10px] leading-4 text-muted"

/** The help sheet lives in (app)/layout.tsx behind the "?" key; a synthetic keydown reaches it without new plumbing. */
function openShortcutHelp() {
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "?" }))
}


type RowProps = { onKeyDown?: (e: React.KeyboardEvent) => void; className?: string; dot?: React.ReactNode; marked?: boolean }

/** A page link; pages with children (T511) get a chevron, ←/→ on the link, and a dot on the icon rail. */
function PageRow({ href, kids, label, children }: { href: string; kids: SidebarChild[]; label: string; children: (p: RowProps) => React.ReactNode }) {
  if (!isChildPage(href) || !kids.length) return <SidebarMenuItem>{children({})}</SidebarMenuItem>
  return <PageRowWithChildren page={href} kids={kids} label={label}>{children}</PageRowWithChildren>
}

/**
 * Which pages mark a closed row. Board and Test review hold exactly what the Inbox counts (review, blocked, checks,
 * failed runs), so they carry no second "needs you"; Memory's cleanup flags are low-stakes, a muted count. Roadmap
 * drift and doc lint errors are not in the Inbox: those rows keep the amber dot.
 */
const ROW_MARK: Record<SidebarPage, "dot" | "count" | "none"> = {
  "/board": "none",
  "/manual-tests": "none",
  "/memory": "count",
  "/roadmap": "dot",
  "/docs": "dot",
}

function PageRowWithChildren({ page, kids, label, children }: { page: SidebarPage; kids: SidebarChild[]; label: string; children: (p: RowProps) => React.ReactNode }) {
  const { t, tn } = useT()
  const { open, needsAction, onKeyDown } = usePageDisclosure(page, kids)
  const mark = needsAction ? ROW_MARK[page] : "none"
  const n = kids[0]?.n ?? 0
  // Children are collapsed by default: a closed row (and the icon rail, which never shows them) carries a mark instead
  const dot = mark === "count" ? (
    !open && n > 0 && (
      <span data-needs-action-count className="ml-auto font-mono text-[11px] tabular-nums text-muted group-data-[collapsible=icon]:hidden">
        <span aria-hidden>{n}</span><span className="sr-only">, {tn("shell.hintCleanup", n)}</span>
      </span>
    )
  ) : mark === "dot" && (
    <>
      <span aria-hidden className="absolute right-1 top-1 hidden size-1.5 rounded-full bg-amber group-data-[collapsible=icon]:block" data-needs-action-dot />
      {!open && <span aria-hidden className="ml-auto size-1.5 shrink-0 rounded-full bg-amber group-data-[collapsible=icon]:hidden" data-needs-action-mark />}
      {/* ", " keeps the link's name "Board, needs your action", not "Boardneeds your action" */}
      <span className="sr-only">, {t("shell.pageNeedsAction")}</span>
    </>
  )
  return (
    <SidebarMenuItem>
      {children({ onKeyDown, className: "relative pr-8", dot, marked: mark !== "none" && !open })}
      <PageDisclosureButton page={page} label={label} open={open} />
      {open && <PageChildren page={page} label={label} kids={kids} />}
    </SidebarMenuItem>
  )
}

const inboxKey = shortcutFor("/inbox")

/** The Inbox link. Its count lives in the header's Inbox pill and the tab title only (src/lib/inbox.ts), not here too. */
function InboxRow({ active }: { active: boolean }) {
  const { t } = useT()
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={{ children: <span className="flex items-center gap-2">{t("inbox.title")}<kbd aria-hidden className={kbdClass}>{inboxKey}</kbd></span> }}>
        <Link href="/inbox" aria-keyshortcuts={inboxKey} className="relative">
          <Inbox />
          <span>{t("inbox.title")}</span>
          <kbd aria-hidden className={cn(kbdClass, "ml-auto hidden group-hover/menu-item:inline group-focus-within/menu-item:inline")}>{inboxKey}</kbd>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

/** True while the sidebar's scroll area has rows below its bottom edge (the sentinel `end` is out of view). */
function useBelowFold() {
  const end = useRef<HTMLDivElement>(null)
  const [more, setMore] = useState(false)
  useEffect(() => {
    const el = end.current
    if (!el?.parentElement) return
    const io = new IntersectionObserver(([e]) => setMore(!e.isIntersecting), { root: el.parentElement })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return { end, more }
}

export function AppSidebar() {
  const pathname = usePathname()
  const { demo, activeProject } = useApp()
  const { t } = useT()
  const settingsKey = shortcutFor("/settings")
  const projectsKey = shortcutFor("/projects")
  const children = usePageChildren()
  const { end, more } = useBelowFold()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          <div aria-hidden className="grid size-6 shrink-0 place-items-center rounded-md bg-accent text-accent-fg">
            <Hexagon className="size-3.5" strokeWidth={2.5} />
          </div>
          <span className="text-sm font-semibold tracking-tight text-txt group-data-[collapsible=icon]:hidden">VibeDoc</span>
          <span title={t("shell.version")} className="truncate font-mono text-[11px] text-muted group-data-[collapsible=icon]:hidden">v{VIBEDOC_VERSION}</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {!demo && <nav aria-label={t("shell.chats")}><SidebarChats /></nav>}
        <nav aria-label={t("shell.mainNav")}>
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{t(group.label)}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map(({ href, icon: Icon, label: labelKey }) => {
                  const label = t(labelKey)
                  const key = shortcutFor(href)
                  return (
                    <PageRow key={href} href={href} kids={isChildPage(href) ? children[href] : []} label={label}>
                      {(rowProps) => (
                        <SidebarMenuButton
                          asChild
                          isActive={pathname.startsWith(href)}
                          tooltip={{ children: <span className="flex items-center gap-2">{label}{key && <kbd aria-hidden className={kbdClass}>{key}</kbd>}</span> }}
                        >
                          <Link href={href} aria-keyshortcuts={key} onKeyDown={rowProps.onKeyDown} className={rowProps.className}>
                            <Icon />
                            <span>{label}</span>
                            {rowProps.dot}
                            {key && <kbd aria-hidden className={cn(kbdClass, !rowProps.marked && "ml-auto", "hidden group-hover/menu-item:inline group-focus-within/menu-item:inline")}>{key}</kbd>}
                          </Link>
                        </SidebarMenuButton>
                      )}
                    </PageRow>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
        </nav>
        {/* After the nav, so on an empty project the page rows never get pushed under the fold; it scrolls with the fade below.
            Keyed by project: its hide / seen-open state belongs to one project */}
        <FirstWeek key={activeProject ?? ""} />
        {/* Below-the-fold cue: a fade on the bottom edge while rows are hidden under it */}
        <div ref={end} aria-hidden className="h-px shrink-0" />
        <div aria-hidden data-sidebar-fade={more || undefined} className={cn("pointer-events-none sticky bottom-0 -mt-8 h-8 shrink-0 bg-gradient-to-t from-sidebar to-transparent transition-opacity duration-150 group-data-[collapsible=icon]:hidden", more ? "opacity-100" : "opacity-0")} />
      </SidebarContent>
      <SidebarFooter>
        <nav aria-label={t("shell.footerNav")}>
        <SidebarMenu>
          {!demo && <InboxRow active={pathname.startsWith("/inbox")} />}
          {!demo && <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname.startsWith("/projects")} tooltip={{ children: <span className="flex items-center gap-2">{t("shell.allProjects")}<kbd aria-hidden className={kbdClass}>{projectsKey}</kbd></span> }}>
              <Link href="/projects" aria-keyshortcuts={projectsKey}>
                <Folders />
                <span>{t("shell.allProjects")}</span>
                <kbd aria-hidden className={cn(kbdClass, "ml-auto hidden group-hover/menu-item:inline group-focus-within/menu-item:inline")}>{projectsKey}</kbd>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>}
          <SidebarMenuItem>
            <SidebarMenuButton onClick={openShortcutHelp} aria-keyshortcuts="?" tooltip={t("shell.shortcutsTip")} className="text-muted">
              <Keyboard />
              <span>{t("shell.shortcuts")}</span>
              <kbd aria-hidden className={cn(kbdClass, "ml-auto")}>?</kbd>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {!demo && <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname.startsWith("/settings")} tooltip={{ children: <span className="flex items-center gap-2">{t("shell.settings")}<kbd aria-hidden className={kbdClass}>{settingsKey}</kbd></span> }}>
              <Link href="/settings" aria-keyshortcuts={settingsKey}>
                <Settings />
                <span>{t("shell.settings")}</span>
                <kbd aria-hidden className={cn(kbdClass, "ml-auto hidden group-hover/menu-item:inline group-focus-within/menu-item:inline")}>{settingsKey}</kbd>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>}
        </SidebarMenu>
        </nav>
      </SidebarFooter>
    </Sidebar>
  )
}
