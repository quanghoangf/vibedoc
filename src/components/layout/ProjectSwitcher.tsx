"use client"

import { useEffect, useState } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useApp } from "@/context/AppContext"
import type { Project } from "@/types"
import { Check, ChevronsUpDown, FolderPlus, Layers } from "lucide-react"
import { useRouter } from "next/navigation"
import { chooseAndAddFolder } from "@/components/projects/AddProjectDialog"
import { toast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"
import { useT } from "@/context/LanguageContext"
import { switcherOrder } from "@/lib/hub"

/** ⌘K "Switch project…" opens the switcher with this window event. */
export const OPEN_PROJECT_SWITCHER = "vibedoc:open-project-switcher"

/** Keep the meaningful tail of a path: /Users/me/work/vibedoc → …/work/vibedoc */
function shortPath(root: string): string {
  const parts = root.split("/").filter(Boolean)
  return parts.length > 2 ? `…/${parts.slice(-2).join("/")}` : root
}

interface ProjectSwitcherProps {
  projects: Project[]
  activeProject: string
  currentName: string
  /** The picked project's hub id */
  onSelect: (id: string) => void
}

/** Above this many projects the menu gets a filter field. */
const FILTER_FROM = 6

export function ProjectSwitcher({ projects, activeProject, currentName, onSelect }: ProjectSwitcherProps) {
  const { t } = useT()
  // R102: groups sit above the projects; an open group names the switcher and no project is current
  const { groups, activeGroup, onGroupChange, demo, playground } = useApp()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState("")
  // R099: pinned first, then the most recently opened; archived projects stay on All projects only
  const listed = switcherOrder(projects)
  const filterable = listed.length >= FILTER_FROM
  const f = filter.trim().toLowerCase()
  const shown = f ? listed.filter((p) => `${p.name} ${p.root}`.toLowerCase().includes(f)) : listed
  const shownGroups = f ? groups.filter((g) => g.name.toLowerCase().includes(f)) : groups

  // Add project…: Finder, then the hub, then open it; no OS picker on this machine → All projects' typed-path dialog
  const addProject = async () => {
    try {
      const res = await chooseAndAddFolder(t("projects.pickPrompt"), t("projects.pickBusy"))
      if (res === "unsupported") router.push("/projects?add=path")
      else if (res?.[0]) {
        if (!res[0].added) toast(t("projects.alreadyInHub", { name: res[0].name }))
        onSelect(res[0].id)
      }
    } catch (e) {
      toast(t("projects.addFailed", { error: (e as Error).message }))
    }
  }

  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener(OPEN_PROJECT_SWITCHER, onOpen)
    return () => window.removeEventListener(OPEN_PROJECT_SWITCHER, onOpen)
  }, [])

  return (
    <DropdownMenu open={open} onOpenChange={(v) => { setOpen(v); if (!v) setFilter("") }}>
      <DropdownMenuTrigger asChild>
        <button className="flex h-8 items-center gap-1.5 rounded-md px-2 text-sm text-muted transition-colors hover:bg-surface2 hover:text-txt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg">
          {activeGroup && <Layers aria-hidden className="size-3.5 shrink-0" />}
          <span className="max-w-[160px] truncate">{activeGroup?.name || currentName || t("shell.selectProject")}</span>
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-64 bg-surface border-border2 text-txt"
        align="start"
      >
        {filterable && (
          <input
            // Focused before the menu's focus scope mounts, so the scope leaves it there
            autoFocus
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => {
              // Letters type here, not into the menu's own type-ahead; ↓ moves into the list, Enter picks the first match
              if (e.key === "ArrowDown") {
                e.preventDefault()
                e.currentTarget.parentElement?.querySelector<HTMLElement>("[role=menuitem]")?.focus()
              } else if (e.key === "Enter" && shown[0] && !shown[0].missing) {
                onSelect(shown[0].id)
                setOpen(false)
                setFilter("")
              } else if (e.key.length === 1) {
                e.stopPropagation()
              }
            }}
            placeholder={t("shell.filterProjectsPlaceholder")}
            aria-label={t("shell.filterProjects")}
            className="mb-1 h-8 w-full border-b border-border bg-transparent px-2 text-sm text-txt outline-none placeholder:text-muted"
          />
        )}
        {shownGroups.length > 0 && (
          <>
            <DropdownMenuLabel className="text-xs text-muted">{t("shell.switcherGroups")}</DropdownMenuLabel>
            {shownGroups.map((g) => {
              const active = g.slug === activeGroup?.slug
              return (
                <DropdownMenuItem
                  key={`group:${g.slug}`}
                  onClick={() => onGroupChange(g.slug)}
                  aria-current={active || undefined}
                  className={cn("cursor-pointer hover:bg-surface2 focus:bg-surface2", active && "text-accent")}
                >
                  <Layers aria-hidden className="size-3.5 shrink-0 text-muted" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium" data-user-content>{g.name}</div>
                    <div className="truncate text-[11px] text-muted" data-user-content>{g.members.map((m) => m.name).join(", ")}</div>
                  </div>
                  <Check aria-hidden className={cn("size-3.5 shrink-0", !active && "invisible")} />
                </DropdownMenuItem>
              )
            })}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted">{t("shell.switcherProjects")}</DropdownMenuLabel>
          </>
        )}
        {shown.length === 0 ? (
          <div className="px-3 py-2 text-sm text-muted">{listed.length ? t("shell.noProjectMatches", { query: filter.trim() }) : t("shell.noProjects")}</div>
        ) : (
          shown.map((p) => {
            const active = !activeGroup && p.root === activeProject
            return (
              <DropdownMenuItem
                key={p.root}
                onClick={() => onSelect(p.id)}
                // T532: a moved or deleted folder can't be opened; All projects offers Locate
                disabled={p.missing}
                title={p.root}
                aria-current={active || undefined}
                className={cn("cursor-pointer hover:bg-surface2 focus:bg-surface2", active && "text-accent")}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{p.name}</div>
                  <div className="truncate font-mono text-[11px] text-muted">{p.missing ? t("shell.projectMissing") : shortPath(p.root)}</div>
                </div>
                <Check aria-hidden className={cn("size-3.5 shrink-0", !active && "invisible")} />
              </DropdownMenuItem>
            )
          })
        )}
        {!demo && !playground && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={addProject} className="cursor-pointer text-muted hover:bg-surface2 focus:bg-surface2" data-switcher-add>
              <FolderPlus aria-hidden className="size-3.5 shrink-0" />
              {t("shell.addProject")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
