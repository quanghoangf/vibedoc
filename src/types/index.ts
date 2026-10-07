import type { Task, ActivityEvent } from "@/lib/core"
import type { FirstWeek } from "@/lib/first-week"

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
  /** The first-week checklist (R084), derived on the server; optional so an older payload still types */
  firstWeek?: FirstWeek & { epicToBreakDown: string | null; epicToWork: string | null; dismissed: boolean }
  /** VIBEDOC_DEMO=1 on the server: read-only demo, the UI hides every write control (R042) */
  demo?: boolean
}

export interface SelectedDoc {
  path: string
  content: string
  /** Who last created or saved it, from the activity log (R055) */
  lastEdit?: { actor: "ai" | "human"; at: string } | null
}
