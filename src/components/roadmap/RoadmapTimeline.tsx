"use client"

import { useEffect, useMemo, useRef } from "react"
import { cn } from "@/lib/utils"
import type { RoadmapItem } from "@/types"
import type { RoadmapProgress } from "@/lib/roadmap-health"
import { StatusDot } from "./RoadmapNodes"
import { AgentDot } from "@/components/chat/AgentMark"
import { LANE_ROW_H, buildTimeline } from "./timeline"
import { useFormat } from "@/context/LanguageContext"

const LANE_LABEL_W = 200
const HEADER_H = 36

interface RoadmapTimelineProps {
  items: RoadmapItem[]
  today: string
  onSelect: (id: string) => void
  onItemContextMenu?: (id: string, e: React.MouseEvent) => void
  progressById: Record<string, RoadmapProgress>
}

export function RoadmapTimeline({ items, today, onSelect, onItemContextMenu, progressById }: RoadmapTimelineProps) {
  // same chapter numbers as the map: real horizons by order
  const chapters = new Map(items.filter((i) => i.parent === null).sort((a, b) => a.order - b.order).map((h, i) => [h.id, i + 1]))
  const f = useFormat()
  const tl = useMemo(() => buildTimeline(items, today, f.month), [items, today, f.month])
  const scrollRef = useRef<HTMLDivElement>(null)

  // open with today about a third from the left
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollLeft = Math.max(0, tl.todayX - (el.clientWidth - LANE_LABEL_W) / 3)
  }, [tl.todayX])

  const hasDates = tl.lanes.some((l) => l.markers.length > 0)

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
            <div className="absolute inset-y-0 w-px bg-accent shadow-[0_0_12px_rgb(var(--rgb-accent)/0.8)]" style={{ left: tl.todayX }}>
              <span
                className="absolute -translate-x-1/2 rounded-full bg-accent px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-accent-fg"
                style={{ top: HEADER_H + 6 }}
              >
                Today
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

          {tl.lanes.map((lane) => (
            <div key={lane.item.id} className="relative flex border-b border-border">
              <LaneLabel item={lane.item} chapter={chapters.get(lane.item.id)} progress={progressById[lane.item.id]} onSelect={onSelect} onContextMenu={onItemContextMenu} />
              <div className="relative" style={{ width: tl.width, height: lane.rows * LANE_ROW_H + 12 }}>
                {lane.markers.map((mk) => (
                  <button
                    key={mk.item.id}
                    type="button"
                    onClick={() => onSelect(mk.item.id)}
                    onContextMenu={(e) => onItemContextMenu?.(mk.item.id, e)}
                    title={`${mk.item.id} · ${mk.item.title} · due ${mk.item.due}${mk.state === "overdue" ? " (overdue)" : ""}`}
                    className="group absolute flex items-center gap-1.5"
                    style={{ left: mk.x - 10, top: 6 + mk.row * LANE_ROW_H }}
                  >
                    {mk.horizon ? (
                      <span
                        className={cn(
                          "h-4 w-4 rotate-45 border-2 border-accent",
                          mk.item.status === "done" ? "bg-accent" : "bg-bg",
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
                        mk.item.status === "in-progress" ? "border-accent/50 bg-surface shadow-[0_6px_18px_-10px_rgb(var(--rgb-accent)/0.7)]"
                          : mk.item.status === "done" ? "border-border bg-surface/60" : "border-dashed border-border2 bg-bg",
                        "group-hover:border-accent",
                      )}
                    >
                      <span className="flex items-center gap-1">
                        <span className={cn("truncate text-xs", mk.item.status === "done" ? "text-muted" : "text-txt", mk.horizon && "font-semibold")}>
                          {mk.item.title}
                        </span>
                        <AgentDot attach={{ kind: "epic", id: mk.item.id }} />
                      </span>
                      <span
                        className={cn(
                          "font-mono text-[10px]",
                          mk.state === "overdue" ? "text-danger" : mk.state === "soon" ? "text-amber" : "text-muted",
                        )}
                      >
                        {f.day(mk.item.due as string)}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}

          {!hasDates && (
            <p className="px-6 py-8 text-sm text-muted" style={{ marginLeft: LANE_LABEL_W }}>
              No due dates yet — open an item and set a Due date.
            </p>
          )}
        </div>
      </div>

      {tl.undated.length > 0 && (
        <div className="max-h-28 shrink-0 overflow-y-auto border-t border-border bg-surface px-4 py-2">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted">No due date · {tl.undated.length}</p>
          <div className="flex flex-wrap gap-1.5">
            {tl.undated.map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() => onSelect(i.id)}
                onContextMenu={(e) => onItemContextMenu?.(i.id, e)}
                className="flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-xs text-muted hover:border-accent hover:text-txt"
              >
                <StatusDot status={i.status} />
                {i.title}
                <AgentDot attach={{ kind: "epic", id: i.id }} />
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
          item.status === "in-progress" ? "text-accent" : item.status === "done" ? "text-teal" : "text-muted",
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
