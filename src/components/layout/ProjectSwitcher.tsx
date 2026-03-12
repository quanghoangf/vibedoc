"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Project } from "@/types"

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
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-surface2 border border-border text-sm hover:border-border2 transition-colors">
          <span className="text-txt font-medium truncate max-w-[200px]">
            {currentName || "Select project"}
          </span>
          <span className="text-muted text-xs">▾</span>
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
