import type { RoadmapItem, RoadmapLayout } from "@/types"

export const HORIZON_W = 260
export const FEATURE_W = 220
const BRANCH_DX = 340
const ROW_H = 110
const HORIZON_GAP = 90
const COL_DX = FEATURE_W + 40
const MAX_ROWS_PER_SIDE = 6 // beyond this, a side gets a second (outer, half-row staggered) column

/** Items that sit on the spine: real horizons plus orphans whose parent is not a horizon. */
export function spineItems(items: RoadmapItem[]): RoadmapItem[] {
  const horizonIds = new Set(items.filter((i) => i.parent === null).map((i) => i.id))
  return items
    .filter((i) => i.parent === null || !horizonIds.has(i.parent))
    .sort((a, b) => a.order - b.order)
}

export function childrenOf(items: RoadmapItem[], parentId: string): RoadmapItem[] {
  return items.filter((i) => i.parent === parentId).sort((a, b) => a.order - b.order)
}

/**
 * Resolve a position for every item: saved (layout.json) wins, otherwise auto-place.
 * Horizons stack on x=0 by order; children alternate right/left of their parent's RESOLVED position.
 */
export function resolvePositions(items: RoadmapItem[], layout: RoadmapLayout): RoadmapLayout {
  const out: RoadmapLayout = {}
  let cursor = 0
  for (const h of spineItems(items)) {
    const hp = layout[h.id] ?? { x: 0, y: cursor }
    out[h.id] = hp
    const kids = h.parent === null ? childrenOf(items, h.id) : []
    const cols = Math.ceil(kids.length / 2) > MAX_ROWS_PER_SIDE ? 2 : 1
    kids.forEach((c, i) => {
      const side = i % 2 === 0 ? 1 : -1
      const k = Math.floor(i / 2) // index within its side
      const col = k % cols
      const row = Math.floor(k / cols)
      out[c.id] = layout[c.id] ?? {
        x: hp.x + (HORIZON_W - FEATURE_W) / 2 + side * (BRANCH_DX + col * COL_DX),
        // outer column sits half a row lower so its edges pass between inner nodes
        y: hp.y + row * ROW_H + col * (ROW_H / 2),
      }
    })
    const rows = Math.ceil(Math.ceil(kids.length / 2) / cols)
    cursor += Math.max(1, rows) * ROW_H + HORIZON_GAP
  }
  return out
}

const ARRANGE_ROW_GAP = 14 // between stacked epics in a column
const ARRANGE_BLOCK_GAP = 120 // between one horizon's block and the next

/**
 * "Arrange" (tidy the whole map): ignores saved positions. Each horizon sits on the spine with its epics
 * in one column per side, stacked by their real heights, in order, each epic going to the shorter side.
 * The column is centred on its horizon so branches fan out evenly and never cross a node; each horizon's
 * block starts below the previous block's lowest node.
 */
export function arrangePositions(items: RoadmapItem[], heightOf: (id: string) => number): RoadmapLayout {
  const out: RoadmapLayout = {}
  let top = 0
  for (const h of spineItems(items)) {
    const hh = heightOf(h.id)
    const kids = h.parent === null ? childrenOf(items, h.id) : []
    const sides: { id: string; y: number }[][] = [[], []] // right, left
    const used = [0, 0]
    for (const c of kids) {
      const s = used[0] <= used[1] ? 0 : 1
      sides[s].push({ id: c.id, y: used[s] })
      used[s] += heightOf(c.id) + ARRANGE_ROW_GAP
    }
    const colH = used.map((u) => Math.max(0, u - ARRANGE_ROW_GAP))
    // centre each column on the horizon, then shift the whole block down so its top is at `top`
    const centre = hh / 2
    const colTop = colH.map((c) => centre - c / 2)
    const shift = top - Math.min(0, ...colTop)
    out[h.id] = { x: 0, y: shift }
    sides.forEach((col, s) => {
      const x = (HORIZON_W - FEATURE_W) / 2 + (s === 0 ? 1 : -1) * BRANCH_DX
      for (const { id, y } of col) out[id] = { x, y: shift + colTop[s] + y }
    })
    top = shift + Math.max(hh, ...colTop.map((t, s) => t + colH[s])) + ARRANGE_BLOCK_GAP
  }
  return out
}

/** Horizons whose epics are all done: the map draws them as one compact node until expanded (render only, layout.json untouched). */
export function doneHorizons(items: RoadmapItem[]): Set<string> {
  const out = new Set<string>()
  for (const h of items.filter((i) => i.parent === null)) {
    const kids = items.filter((i) => i.parent === h.id)
    if (kids.length > 0 && kids.every((k) => k.status === "done")) out.add(h.id)
  }
  return out
}

/** The epics that count as live work: in-progress or planned, with an open task (`isOpen`; unknown ids count as open). */
function isLive(i: RoadmapItem, isOpen: (taskId: string) => boolean): boolean {
  return (i.status === "in-progress" || i.status === "planned") && i.tasks.some(isOpen)
}

/**
 * The horizon the map opens on: the first (by order) with an in-progress or planned epic that has an open task.
 * `isOpen(taskId)` says whether a task still needs work (unknown ids should count as open). null = no such horizon.
 */
export function focusHorizon(items: RoadmapItem[], isOpen: (taskId: string) => boolean): string | null {
  for (const h of items.filter((i) => i.parent === null).sort((a, b) => a.order - b.order)) {
    if (items.some((i) => i.parent === h.id && isLive(i, isOpen))) return h.id
  }
  return null
}

/** The live epics of a horizon (see focusHorizon), in order: what the first viewport frames. */
export function liveEpics(items: RoadmapItem[], horizonId: string, isOpen: (taskId: string) => boolean): string[] {
  return childrenOf(items, horizonId).filter((i) => isLive(i, isOpen)).map((i) => i.id)
}

/**
 * The vertical span to frame when not every box fits a viewport `viewH` tall: the window holding the most boxes
 * (whole), ties to the lower one (epics are ordered oldest first, so lower = newer work). Returns the chosen boxes'
 * extent, or null for no boxes. A real map (this repo) has 2 old live epics high up among 40 done ones and 5 new
 * ones at the bottom: framing the top of the block, or the middle of all 7, shows only done work.
 */
/**
 * Where to centre the camera across when the map is wider than the viewport (`viewW`, flow units): the framed boxes'
 * span if it fits, else the column holding most of them (ties: the one with the topmost box). null = no boxes framed.
 * A phone shows one column of the two-sided map; centring the whole map there cut every live epic in half.
 */
export function focusX(
  boxes: { x: number; y: number; w: number; h: number }[],
  frame: { top: number; bottom: number },
  viewW: number,
): number | null {
  const inside = boxes.filter((b) => b.y >= frame.top && b.y + b.h <= frame.bottom)
  if (!inside.length) return null
  const left = Math.min(...inside.map((b) => b.x))
  const right = Math.max(...inside.map((b) => b.x + b.w))
  if (right - left <= viewW) return (left + right) / 2
  const cols = new Map<number, typeof inside>()
  for (const b of [...inside].sort((a, c) => a.y - c.y)) cols.set(Math.round(b.x), [...(cols.get(Math.round(b.x)) ?? []), b])
  let best = [...cols.values()][0]
  for (const c of cols.values()) if (c.length > best.length) best = c
  return best[0].x + best[0].w / 2
}

export function densestWindow(boxes: { y: number; h: number }[], viewH: number): { top: number; bottom: number } | null {
  if (!boxes.length) return null
  const sorted = [...boxes].sort((a, b) => a.y - b.y)
  let best: { top: number; bottom: number; n: number } | null = null
  for (const start of sorted) {
    const inside = sorted.filter((b) => b.y >= start.y && b.y + b.h <= start.y + viewH)
    const n = Math.max(1, inside.length)
    const bottom = inside.length ? Math.max(...inside.map((b) => b.y + b.h)) : start.y + start.h
    if (!best || n >= best.n) best = { top: start.y, bottom, n }
  }
  return best && { top: best.top, bottom: best.bottom }
}
