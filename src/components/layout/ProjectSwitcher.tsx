"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Project } from "@/types"
import { ChevronsUpDown } from "lucide-react"

interface ProjectSwitcherProps {
  projects: Project[]
  activeProject: string
  currentName: string
  onSelect: (root: string) => void
}

export function ProjectSwitcher({ projects, activeProject, currentName, onSelect }: ProjectSwitcherProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex h-8 items-center gap-1.5 rounded-md px-2 text-sm text-muted transition-colors hover:bg-surface2 hover:text-txt">
          <span className="max-w-[160px] truncate">{currentName || "Select project"}</span>
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-64 bg-surface border-border2 text-txt"
        align="start"
      >
        {projects.length === 0 ? (
          <div className="px-3 py-2 text-sm text-muted">No projects found</div>
        ) : (
          projects.map((p) => (
            <DropdownMenuItem
              key={p.root}
              onClick={() => onSelect(p.root)}
              className={`cursor-pointer hover:bg-surface2 focus:bg-surface2 ${p.root === activeProject ? "text-accent" : ""}`}
            >
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-muted truncate font-mono">{p.root}</div>
              </div>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
