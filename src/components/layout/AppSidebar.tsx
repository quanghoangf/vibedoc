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
import { useInbox } from "@/components/inbox/use-inbox"
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

function PageRowWithChildren({ page, kids, label, children }: { page: SidebarPage; kids: SidebarChild[]; label: string; children: (p: RowProps) => React.ReactNode }) {
  const { t } = useT()
  const { open, needsAction, onKeyDown } = usePageDisclosure(page, kids)
  // Children are collapsed by default: a closed row (and the icon rail, which never shows them) carries a dot instead
  const dot = needsAction && (
    <>
      <span aria-hidden className="absolute right-1 top-1 hidden size-1.5 rounded-full bg-amber group-data-[collapsible=icon]:block" data-needs-action-dot />
      {!open && <span aria-hidden className="ml-auto size-1.5 shrink-0 rounded-full bg-amber group-data-[collapsible=icon]:hidden" data-needs-action-mark />}
      <span className="sr-only">{t("shell.pageNeedsAction")}</span>
    </>
  )
  return (
    <SidebarMenuItem>
      {children({ onKeyDown, className: "relative pr-8", dot, marked: needsAction && !open })}
      <PageDisclosureButton page={page} label={label} open={open} />
      {open && <PageChildren page={page} label={label} kids={kids} />}
    </SidebarMenuItem>
  )
}

const inboxKey = shortcutFor("/inbox")

/** The Inbox row with the one "needs you" count (src/lib/inbox.ts): the header's Inbox and the tab title say the same number. */
function InboxRow({ active }: { active: boolean }) {
  const { t, tn } = useT()
  const n = useInbox().items?.length ?? 0
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={{ children: <span className="flex items-center gap-2">{t("inbox.title")}<kbd className={kbdClass}>{inboxKey}</kbd></span> }}>
        <Link href="/inbox" aria-keyshortcuts={inboxKey} className="relative">
          <Inbox />
          <span>{t("inbox.title")}</span>
          {n > 0 && (
            <span data-sidebar-inbox-count className="ml-auto font-mono text-[11px] tabular-nums text-txt">{n}<span className="sr-only"> {tn("inbox.badge", n)}</span></span>
          )}
          {n > 0 && <span aria-hidden className="absolute right-1 top-1 hidden size-1.5 rounded-full bg-amber group-data-[collapsible=icon]:block" />}
          <kbd aria-hidden className={cn(kbdClass, n === 0 && "ml-auto", "hidden group-hover/menu-item:inline group-focus-within/menu-item:inline")}>{inboxKey}</kbd>
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
        {!demo && <SidebarChats />}
        {/* Keyed by project: its hide / seen-open state belongs to one project */}
        <FirstWeek key={activeProject ?? ""} />
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
                          tooltip={{ children: <span className="flex items-center gap-2">{label}{key && <kbd className={kbdClass}>{key}</kbd>}</span> }}
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
        {/* Below-the-fold cue: a fade on the bottom edge while rows are hidden under it */}
        <div ref={end} aria-hidden className="h-px shrink-0" />
        <div aria-hidden data-sidebar-fade={more || undefined} className={cn("pointer-events-none sticky bottom-0 -mt-8 h-8 shrink-0 bg-gradient-to-t from-sidebar to-transparent transition-opacity duration-150 group-data-[collapsible=icon]:hidden", more ? "opacity-100" : "opacity-0")} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          {!demo && <InboxRow active={pathname.startsWith("/inbox")} />}
          {!demo && <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname.startsWith("/projects")} tooltip={{ children: <span className="flex items-center gap-2">{t("shell.allProjects")}<kbd className={kbdClass}>{projectsKey}</kbd></span> }}>
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
            <SidebarMenuButton asChild isActive={pathname.startsWith("/settings")} tooltip={{ children: <span className="flex items-center gap-2">{t("shell.settings")}<kbd className={kbdClass}>{settingsKey}</kbd></span> }}>
              <Link href="/settings" aria-keyshortcuts={settingsKey}>
                <Settings />
                <span>{t("shell.settings")}</span>
                <kbd aria-hidden className={cn(kbdClass, "ml-auto hidden group-hover/menu-item:inline group-focus-within/menu-item:inline")}>{settingsKey}</kbd>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
