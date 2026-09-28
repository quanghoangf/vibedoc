"use client"

import { useEffect, useMemo, useRef } from "react"
import { cn } from "@/lib/utils"
import type { RoadmapItem } from "@/types"
import { StatusDot } from "./RoadmapNodes"
import { LANE_ROW_H, buildTimeline, formatDay } from "./timeline"

const LANE_LABEL_W = 200
const HEADER_H = 36

interface RoadmapTimelineProps {
  items: RoadmapItem[]
  today: string
  onSelect: (id: string) => void
}

export function RoadmapTimeline({ items, today, onSelect }: RoadmapTimelineProps) {
  const tl = useMemo(() => buildTimeline(items, today), [items, today])
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
            <div className="absolute inset-y-0 w-0.5 bg-accent" style={{ left: tl.todayX }}>
              <span
                className="absolute left-1 rounded-sm bg-accent px-1 font-mono text-[10px] text-white"
                style={{ top: HEADER_H + 4 }}
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
                <span key={m.x} className="absolute top-2.5 whitespace-nowrap pl-2 font-mono text-xs text-muted" style={{ left: m.x }}>
                  {m.label}
                </span>
              ))}
            </div>
          </div>

          {tl.lanes.map((lane) => (
            <div key={lane.item.id} className="relative flex border-b border-border">
              <button
                type="button"
                onClick={() => onSelect(lane.item.id)}
                className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r border-border bg-surface px-3 text-left hover:bg-surface2"
                style={{ width: LANE_LABEL_W }}
              >
                <StatusDot status={lane.item.status} />
                <span className="text-sm font-semibold text-txt leading-snug">{lane.item.title}</span>
              </button>
              <div className="relative" style={{ width: tl.width, height: lane.rows * LANE_ROW_H + 12 }}>
                {lane.markers.map((mk) => (
                  <button
                    key={mk.item.id}
                    type="button"
                    onClick={() => onSelect(mk.item.id)}
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
                    <span className="flex max-w-[150px] flex-col text-left">
                      <span className={cn("truncate text-xs text-txt group-hover:text-accent", mk.horizon && "font-semibold")}>
                        {mk.item.title}
                      </span>
                      <span
                        className={cn(
                          "font-mono text-[10px]",
                          mk.state === "overdue" ? "text-danger" : mk.state === "soon" ? "text-amber" : "text-muted",
                        )}
                      >
                        {formatDay(mk.item.due as string)}
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
          <p className="mb-1.5 text-xs text-muted">No due date ({tl.undated.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {tl.undated.map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() => onSelect(i.id)}
                className="flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-xs text-muted hover:border-accent hover:text-txt"
              >
                <StatusDot status={i.status} />
                {i.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
