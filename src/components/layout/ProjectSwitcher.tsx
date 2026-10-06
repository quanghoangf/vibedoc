"use client"

import { useState } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Project } from "@/types"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { useT } from "@/context/LanguageContext"

/** Keep the meaningful tail of a path: /Users/me/work/vibedoc → …/work/vibedoc */
function shortPath(root: string): string {
  const parts = root.split("/").filter(Boolean)
  return parts.length > 2 ? `…/${parts.slice(-2).join("/")}` : root
}

interface ProjectSwitcherProps {
  projects: Project[]
  activeProject: string
  currentName: string
  onSelect: (root: string) => void
}

/** Above this many projects the menu gets a filter field. */
const FILTER_FROM = 6

export function ProjectSwitcher({ projects, activeProject, currentName, onSelect }: ProjectSwitcherProps) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState("")
  const filterable = projects.length >= FILTER_FROM
  const f = filter.trim().toLowerCase()
  const shown = f ? projects.filter((p) => `${p.name} ${p.root}`.toLowerCase().includes(f)) : projects

  return (
    <DropdownMenu open={open} onOpenChange={(v) => { setOpen(v); if (!v) setFilter("") }}>
      <DropdownMenuTrigger asChild>
        <button className="flex h-8 items-center gap-1.5 rounded-md px-2 text-sm text-muted transition-colors hover:bg-surface2 hover:text-txt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg">
          <span className="max-w-[160px] truncate">{currentName || t("shell.selectProject")}</span>
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
              } else if (e.key === "Enter" && shown[0]) {
                onSelect(shown[0].root)
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
        {shown.length === 0 ? (
          <div className="px-3 py-2 text-sm text-muted">{projects.length ? t("shell.noProjectMatches", { query: filter.trim() }) : t("shell.noProjects")}</div>
        ) : (
          shown.map((p) => {
            const active = p.root === activeProject
            return (
              <DropdownMenuItem
                key={p.root}
                onClick={() => onSelect(p.root)}
                title={p.root}
                aria-current={active || undefined}
                className={cn("cursor-pointer hover:bg-surface2 focus:bg-surface2", active && "text-accent")}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{p.name}</div>
                  <div className="truncate font-mono text-[11px] text-muted">{shortPath(p.root)}</div>
                </div>
                <Check aria-hidden className={cn("size-3.5 shrink-0", !active && "invisible")} />
              </DropdownMenuItem>
            )
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
