"use client"

import { useEffect, useMemo, useRef } from "react"
import { cn } from "@/lib/utils"
import type { RoadmapItem } from "@/types"
import type { RoadmapProgress } from "@/lib/roadmap-health"
import { StatusDot } from "./RoadmapNodes"
import { AgentDot } from "@/components/chat/AgentMark"
import { LANE_ROW_H, buildTimeline, type TaskDates } from "./timeline"
import { AlertTriangle } from "lucide-react"
import { useFormat, useT } from "@/context/LanguageContext"

const LANE_LABEL_W = 200
const HEADER_H = 36

/** One repo's block on a group roadmap (R102): its items, health from its own tasks, and its at-risk epics. */
export interface TimelineSection {
  id: string
  name: string
  items: RoadmapItem[]
  progressById: Record<string, RoadmapProgress>
  atRisk: Set<string>
}

interface RoadmapTimelineProps {
  items: RoadmapItem[]
  today: string
  /** `section`: the repo the item lives in, on a group roadmap */
  onSelect: (id: string, section?: string) => void
  onItemContextMenu?: (id: string, e: React.MouseEvent) => void
  progressById: Record<string, RoadmapProgress>
  /** Tasks' Started / Done dates: an item with no Due is drawn over the span they cover (dashed, derived) */
  taskDates?: TaskDates
  /** R102: one block of lanes per repo under its header, on one shared month axis (`items` / `progressById` unused) */
  sections?: TimelineSection[]
}

export function RoadmapTimeline({ items, today, onSelect, onItemContextMenu, progressById, taskDates, sections }: RoadmapTimelineProps) {
  const f = useFormat()
  const { t, tn } = useT()
  // Ids repeat across repos (R001 in each), so every repo builds its own lanes; the axis spans every repo's dates
  const blocks = useMemo(() => {
    const list: TimelineSection[] = sections ?? [{ id: "", name: "", items, progressById, atRisk: new Set() }]
    const axis = list.flatMap((b) => b.items.map((i) => i.due)).filter((d): d is string => !!d)
    return list.map((b) => ({
      ...b,
      tl: buildTimeline(b.items, today, f.month, axis, sections ? {} : taskDates),
      // same chapter numbers as the map: real horizons by order
      chapters: new Map(b.items.filter((i) => i.parent === null).sort((a, c) => a.order - c.order).map((h, i) => [h.id, i + 1])),
    }))
  }, [sections, items, progressById, today, f.month, taskDates])
  const tl = blocks[0]?.tl ?? buildTimeline([], today, f.month)
  const group = !!sections
  const scrollRef = useRef<HTMLDivElement>(null)

  // open with today about a third from the left
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollLeft = Math.max(0, tl.todayX - (el.clientWidth - LANE_LABEL_W) / 3)
  }, [tl.todayX])

  const hasDates = blocks.some((b) => b.tl.lanes.some((l) => l.markers.length > 0))
  const undated = blocks.flatMap((b) => b.tl.undated.map((item) => ({ item, block: b })))

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <div ref={scrollRef} className="relative flex-1 min-h-0 overflow-auto">
        <div className="relative" style={{ width: LANE_LABEL_W + tl.width, minHeight: "100%" }}>
          {/* month grid + today line, behind the lanes */}
          <div className="pointer-events-none absolute inset-y-0" style={{ left: LANE_LABEL_W, width: tl.width }}>
            {tl.months.map((m) => (
              <div key={m.x} className="absolute inset-y-0 border-l border-border" style={{ left: m.x }} />
            ))}
            <div className="absolute inset-y-0 left-0 bg-surface/50" style={{ width: tl.todayX }} />
            <div className="absolute inset-y-0 w-px bg-muted" style={{ left: tl.todayX }}>
              <span
                className="absolute -translate-x-1/2 rounded-full bg-txt px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-bg"
                style={{ top: HEADER_H + 6 }}
              >
                {t("roadmap.todayMarker")}
              </span>
            </div>
          </div>

          {/* month header */}
          <div className="sticky top-0 z-20 flex border-b border-border bg-bg" style={{ height: HEADER_H }}>
            <div className="sticky left-0 z-10 shrink-0 bg-bg" style={{ width: LANE_LABEL_W }} />
            <div className="relative">
              {tl.months.map((m) => (
                <span key={m.x} className="absolute top-3 whitespace-nowrap pl-2 font-mono text-[10px] uppercase tracking-widest text-muted" style={{ left: m.x }}>
                  {m.label}
                </span>
              ))}
            </div>
          </div>

          {blocks.map((b) => (
          <section key={b.id || "project"} aria-label={group ? b.name : undefined} data-timeline-repo={group ? b.id : undefined}>
          {group && (
            <div className="relative z-10 border-b border-border bg-bg py-2" style={{ width: LANE_LABEL_W + tl.width }}>
              <div className="sticky left-0 flex w-max items-baseline gap-2 px-3">
                <h2 className="truncate text-sm font-semibold text-txt" data-user-content>{b.name}</h2>
                <span className="font-mono text-[11px] text-muted">{tn("roadmap.repoEpics", b.items.filter((i) => i.parent !== null).length)}</span>
              </div>
            </div>
          )}
          {b.tl.lanes.map((lane) => (
            <div key={lane.item.id} className="relative flex border-b border-border">
              <LaneLabel item={lane.item} chapter={b.chapters.get(lane.item.id)} progress={b.progressById[lane.item.id]} onSelect={(id) => onSelect(id, b.id || undefined)} onContextMenu={onItemContextMenu} />
              <div className="relative" style={{ width: tl.width, height: lane.rows * LANE_ROW_H + 12 }}>
                {lane.markers.map((mk) => (
                  <div key={mk.item.id} className="contents">
                  {/* no Due: a dashed bar over the span its tasks' Started → Done cover */}
                  {mk.derived && (
                    <span
                      aria-hidden
                      className="absolute border-t-2 border-dashed border-muted/60"
                      style={{ left: mk.startX, width: Math.max(0, mk.x - mk.startX), top: 6 + mk.row * LANE_ROW_H + 17 }}
                    />
                  )}
                  <button
                    type="button"
                    data-derived={mk.derived || undefined}
                    onClick={() => onSelect(mk.item.id, b.id || undefined)}
                    onContextMenu={(e) => onItemContextMenu?.(mk.item.id, e)}
                    title={mk.derived
                      ? t("roadmap.markerDerived", { id: mk.item.id, title: mk.item.title, start: f.day(mk.start as string), end: f.day(mk.end as string) })
                      : t(mk.state === "overdue" ? "roadmap.markerOverdue" : "roadmap.markerDue", { id: mk.item.id, title: mk.item.title, date: f.day(mk.item.due as string) })}
                    className="group absolute flex items-center gap-1.5"
                    style={{ left: mk.x - 10, top: 6 + mk.row * LANE_ROW_H }}
                  >
                    {mk.horizon ? (
                      <span
                        className={cn(
                          "h-4 w-4 rotate-45 border-2",
                          mk.item.status === "done" ? "border-teal bg-teal" : mk.item.status === "in-progress" ? "border-amber bg-bg" : "border-border2 bg-bg",
                          mk.state === "overdue" && "border-danger",
                        )}
                      />
                    ) : (
                      <span className={cn("rounded-full", mk.state === "overdue" && "ring-2 ring-danger ring-offset-1 ring-offset-bg")}>
                        <StatusDot status={mk.item.status} />
                      </span>
                    )}
                    <span
                      className={cn(
                        "flex max-w-[150px] flex-col rounded-md border px-2 py-0.5 text-left transition-colors",
                        mk.derived ? "border-dashed border-border2 bg-bg" : mk.item.status === "in-progress" ? "border-amber/50 bg-surface"
                          : mk.item.status === "done" ? "border-border bg-surface/60" : "border-dashed border-border2 bg-bg",
                        "group-hover:border-accent",
                      )}
                    >
                      <span className="flex items-center gap-1">
                        <span className={cn("truncate text-xs", mk.item.status === "done" ? "text-muted" : "text-txt", mk.horizon && "font-semibold")}>
                          {mk.item.title}
                        </span>
                        {b.atRisk.has(mk.item.id) && <AlertTriangle data-at-risk className="size-3 shrink-0 text-amber" aria-label={t("roadmap.atRiskMark")} />}
                        {/* chats are per project: a group roadmap doesn't show them */}
                        {!group && <AgentDot attach={{ kind: "epic", id: mk.item.id }} />}
                      </span>
                      <span
                        className={cn(
                          "font-mono text-[10px]",
                          mk.state === "overdue" ? "text-danger" : mk.state === "soon" ? "text-amber" : "text-muted",
                        )}
                      >
                        {mk.derived ? t("roadmap.spanDates", { start: f.day(mk.start as string), end: f.day(mk.end as string) }) : f.day(mk.item.due as string)}
                      </span>
                    </span>
                  </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
          </section>
          ))}

          {/* above the today line (relative z-10 + a solid background), pinned next to the lane labels */}
          {!hasDates && (
            <p className="sticky z-10 my-6 w-max max-w-[min(32rem,calc(100vw-16rem))] rounded-md border border-border bg-bg px-4 py-3 text-sm text-muted" style={{ marginLeft: LANE_LABEL_W + 24, left: LANE_LABEL_W + 24 }}>
              {t("roadmap.noDueDates")}
            </p>
          )}
        </div>
      </div>

      {undated.length > 0 && (
        <div className="max-h-28 shrink-0 overflow-y-auto border-t border-border bg-surface px-4 py-2">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted">{t("roadmap.noDueDate", { n: undated.length })}</p>
          <div className="flex flex-wrap gap-1.5">
            {undated.map(({ item: i, block }) => (
              <button
                key={`${block.id}:${i.id}`}
                type="button"
                onClick={() => onSelect(i.id, block.id || undefined)}
                onContextMenu={(e) => onItemContextMenu?.(i.id, e)}
                className="flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-xs text-muted hover:border-accent hover:text-txt"
              >
                <StatusDot status={i.status} />
                {group && <span className="text-[10px] text-muted" data-user-content>{block.name} ·</span>}
                {i.title}
                {!group && <AgentDot attach={{ kind: "epic", id: i.id }} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function LaneLabel({ item, chapter, progress, onSelect, onContextMenu }: {
  item: RoadmapItem
  chapter?: number
  progress?: RoadmapProgress
  onSelect: (id: string) => void
  onContextMenu?: (id: string, e: React.MouseEvent) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      onContextMenu={(e) => onContextMenu?.(item.id, e)}
      className="sticky left-0 z-10 flex shrink-0 items-center gap-3 border-r border-border bg-surface px-3 text-left hover:bg-surface2"
      style={{ width: LANE_LABEL_W }}
    >
      <span
        className={cn(
          "font-mono text-lg font-semibold tabular-nums",
          item.status === "in-progress" ? "text-amber" : item.status === "done" ? "text-teal" : "text-muted",
        )}
      >
        {chapter ? String(chapter).padStart(2, "0") : "··"}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="line-clamp-2 text-[11px] font-semibold uppercase leading-snug tracking-wider text-txt">{item.title}</span>
        {progress && (
          <span className="h-1 overflow-hidden rounded-full bg-border">
            <span className="block h-full rounded-full bg-teal" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </span>
        )}
      </span>
    </button>
  )
}
