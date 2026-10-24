"use client"

import { cn } from "@/lib/utils"
import { useT } from "@/context/LanguageContext"

/** How recently a file was edited: 0 = this week, 1 = this month (28 days), 2 = older. */
export type Freshness = 0 | 1 | 2

export function freshness(mtime: string, now = Date.now()): Freshness {
  const days = (now - new Date(mtime).getTime()) / 86_400_000
  return days <= 7 ? 0 : days <= 28 ? 1 : 2
}

/**
 * Neutral ink steps (txt → muted → faint): recency is not a task status, so it never borrows Done teal or
 * In-progress amber, and not the accent either (that means selected). DESIGN.md Highlighter Rule.
 */
export const FRESH_TEXT: Record<Freshness, string> = { 0: "text-txt", 1: "text-muted", 2: "text-muted/45" }
const FRESH_SWATCH: Record<Freshness, string> = { 0: "bg-txt", 1: "bg-muted", 2: "bg-muted/35" }
// the treemap's tiles (FileTreemap freshnessColor: txt at 30% / 14% over the surface, then plain surface2)
const TILE_SWATCH: Record<Freshness, string> = { 0: "bg-txt/30", 1: "bg-txt/14", 2: "bg-surface2 ring-1 ring-inset ring-border" }

/** The three steps with their words, so the shading reads without guessing. */
export function FreshnessLegend({ className, tiles = false }: { className?: string; tiles?: boolean }) {
  const { t } = useT()
  const steps = [t("docs.freshWeek"), t("docs.freshMonth"), t("docs.freshOlder")]
  return (
    <div data-freshness-legend className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted", className)}>
      <span>{t("docs.freshLegend")}</span>
      {steps.map((label, i) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <span aria-hidden className={cn(tiles ? "size-2.5" : "size-2", "rounded-sm", (tiles ? TILE_SWATCH : FRESH_SWATCH)[i as Freshness])} />
          {label}
        </span>
      ))}
    </div>
  )
}
