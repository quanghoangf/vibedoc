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
