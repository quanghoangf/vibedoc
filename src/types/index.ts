import type { Task, ActivityEvent } from "@/lib/core"

export type { RoadmapSource } from "@/lib/roadmap-import"
export type { Session } from "@/lib/sessions"
export type { Task, TaskBoard, TaskStatus, DocFile, ActivityEvent, Project, ExplorerFile, DescriptionCache, RoadmapItem, RoadmapLayout, RoadmapStatus, CreateRoadmapItemParams, UpdateRoadmapItemPatch, TaskMetaPatch } from "@/lib/core"

export interface Summary {
  name: string
  root: string
  tasks: {
    total: number
    board: Record<string, number>
    active: Task[]
    blocked: Task[]
  }
  docs: { total: number }
  memory: { content: string; exists: boolean }
  activity: ActivityEvent[]
  /** VIBEDOC_DEMO=1 on the server: read-only demo, the UI hides every write control (R042) */
  demo?: boolean
  /** VIBEDOC_PLAYGROUND=1: `vibedoc --demo`, a writable throwaway copy of the sample project (R085) */
  playground?: boolean
}

export interface SelectedDoc {
  path: string
  content: string
  /** Who last created or saved it, from the activity log (R055) */
  lastEdit?: { actor: "ai" | "human"; at: string } | null
}
