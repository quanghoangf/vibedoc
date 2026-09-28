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
