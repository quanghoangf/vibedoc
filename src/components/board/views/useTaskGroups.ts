"use client"

import { useCallback } from "react"
import { groupTasks, type GroupBy, type TaskGroup } from "@/lib/board-views"
import type { Task } from "@/types"
import { useStatusDefs } from "@/components/shared/status-defs"
import { useStatusLabel } from "@/components/shared/StatusIcon"
import { useT } from "@/context/LanguageContext"

/**
 * groupTasks() with labels in the UI language (R078): statuses through useStatusLabel, and the lib's English
 * fallbacks ("All tasks", "No size", "Human", "No owner", "<agent> (AI)", "No epic") by group key. Epic titles stay.
 */
export function useTaskGroups(): (tasks: Task[], by: GroupBy) => TaskGroup[] {
  const defs = useStatusDefs()
  const label = useStatusLabel()
  const { t } = useT()
  return useCallback((tasks: Task[], by: GroupBy) => {
    if (!tasks.length) return []
    if (by === "none") return [{ key: "all", label: t("board.allTasks"), epicId: null, tasks }]
    const statuses = defs.map((d) => ({ id: d.id, label: label(d.id) }))
    return groupTasks(tasks, by, statuses).map((g) => {
      if (by === "size" && g.key === "none") return { ...g, label: t("board.noSize") }
      if (by === "owner") {
        const owner = g.key === "human" ? t("board.human") : g.key === "none" ? t("board.noOwner") : t("board.agentOwner", { name: g.key.slice(3) })
        return { ...g, label: owner }
      }
      if (by === "epic" && g.key === "none") return { ...g, label: t("board.noEpic") }
      return g
    })
  }, [defs, label, t])
}
