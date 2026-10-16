"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useApp } from "@/context/AppContext"
import { useT } from "@/context/LanguageContext"
import { localToday, roadmapHealth } from "@/lib/roadmap-health"
import type { ProjectGroup } from "@/lib/groups"
import type { RoadmapItem, Task } from "@/types"
import { RoadmapTimeline, type TimelineSection } from "./RoadmapTimeline"

// stable: the timeline reads only `sections` on a group
const NO_ITEMS: RoadmapItem[] = []
const NO_PROGRESS = {}

async function fetchItems(slug: string): Promise<RoadmapItem[]> {
  try {
    const data = await (await fetch(`/api/roadmap?group=${encodeURIComponent(slug)}`)).json()
    return Array.isArray(data?.items) ? data.items : []
  } catch {
    return []
  }
}

/**
 * A group's roadmap (R102 T540): every member repo's epics on one Timeline, a block per repo. Read-only:
 * an epic opens in its own project. The Map stays per project (layout.json positions are per repo).
 */
export function GroupRoadmap({ group }: { group: ProjectGroup }) {
  const { board, onProjectChange } = useApp()
  const { t } = useT()
  const [items, setItems] = useState<RoadmapItem[] | null>(null)
  const today = localToday()

  const load = useCallback(() => fetchItems(group.slug).then(setItems), [group.slug])
  useEffect(() => {
    fetchItems(group.slug).then(setItems)
    const onSse = (e: Event) => {
      const type = (e as CustomEvent).detail?.type
      if (type === "roadmap_updated" || type === "projects_updated") load()
    }
    window.addEventListener("vibedoc:sse", onSse)
    return () => window.removeEventListener("vibedoc:sse", onSse)
  }, [group.slug, load])

  // Health per repo from that repo's own tasks (the group board tags each with its project), as on its own roadmap
  const sections = useMemo<TimelineSection[]>(() => {
    const tasks = Object.values(board ?? {}).flat()
    return group.members.map((m) => {
      const own = (items ?? []).filter((i) => i.project?.id === m.id)
      const tasksById = Object.fromEntries(tasks.filter((x) => x.project?.id === m.id).map((x): [string, Task] => [x.id, x]))
      const health = roadmapHealth(own, tasksById, today)
      return { id: m.id, name: m.name, items: own, progressById: health.progress, atRisk: new Set(health.drift.filter((d) => d.kind === "at-risk").map((d) => d.id)) }
    })
  }, [board, group.members, items, today])

  return (
    <div className="relative flex flex-1 min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-3 py-2">
        <div className="flex rounded-md border border-border p-0.5 text-xs">
          {/* a disabled button gets no pointer events, so the reason sits on its wrapper */}
          <span title={t("roadmap.mapPerProject")}>
            <button type="button" disabled aria-describedby="group-map-why" className="whitespace-nowrap rounded-sm px-3 py-1 text-muted/60">
              {t("roadmap.viewMap")}
            </button>
            <span id="group-map-why" className="sr-only">{t("roadmap.mapPerProject")}</span>
          </span>
          <button type="button" aria-pressed className="whitespace-nowrap rounded-sm bg-surface2 px-3 py-1 text-txt">
            {t("board.viewTimeline")}
          </button>
        </div>
        <p className="text-xs text-muted">{t("roadmap.groupTimelineLead", { name: group.name })}</p>
      </div>
      {items && (
        <RoadmapTimeline
          items={NO_ITEMS}
          progressById={NO_PROGRESS}
          sections={sections}
          today={today}
          onSelect={(id, repo) => repo && onProjectChange(repo, `/roadmap?item=${encodeURIComponent(id)}`)}
        />
      )}
    </div>
  )
}
