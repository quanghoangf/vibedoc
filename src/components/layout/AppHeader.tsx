import type { Project, Summary } from "@/types"
import { ProjectSwitcher } from "./ProjectSwitcher"
import { StatsPills } from "./StatsPills"
import { LiveIndicator } from "./LiveIndicator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"

interface AppHeaderProps {
  summary: Summary | null
  projects: Project[]
  activeProject: string
  liveIndicator: boolean
  onProjectChange: (root: string) => void
  onToggleChat: () => void
}

export function AppHeader({ summary, projects, activeProject, liveIndicator, onProjectChange, onToggleChat }: AppHeaderProps) {
  return (
    <header className="h-12 border-b border-border flex items-center px-4 gap-4 shrink-0 bg-surface/80 backdrop-blur-xs sticky top-0 z-50">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      {/* Logo */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-6 h-6 rounded-md bg-linear-to-br from-accent to-teal flex items-center justify-center text-xs">
          ⬡
        </div>
        <span className="font-mono text-xs text-muted tracking-widest uppercase">
          VibeDoc
        </span>
      </div>

      <ProjectSwitcher
        projects={projects}
        activeProject={activeProject}
        currentName={summary?.name || ""}
        onSelect={onProjectChange}
      />

      {summary && <StatsPills board={summary.tasks.board} />}

      <div className="flex-1" />

      <LiveIndicator active={liveIndicator} />

      <button
        onClick={onToggleChat}
        title="Agent chat (c)"
        className="px-2 py-1 rounded-sm border border-border bg-surface2 text-xs font-mono text-muted hover:text-txt"
      >
        Agent
      </button>

      {/* MCP endpoint hint */}
      <div className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded-sm bg-surface2 border border-border">
        <span className="text-xs font-mono text-muted">MCP</span>
        <code className="text-xs font-mono text-accent">localhost:3000/api/mcp</code>
      </div>
    </header>
  )
}
