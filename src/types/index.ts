import type { Task, ActivityEvent } from "@/lib/core"

export type { Task, TaskBoard, TaskStatus, DocFile, ActivityEvent, Project, ExplorerFile, DescriptionCache } from "@/lib/core"

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
}

export interface SelectedDoc {
  path: string
  content: string
}
