// Zoom and pan state for the fullscreen diagram viewer (T514): the stage is drawn with
// `transform: translate(x, y) scale(scale)` and `transform-origin: 0 0`. Pure: `node src/lib/zoom-pan.check.mts`.

export interface ZoomPan { x: number; y: number; scale: number }

export const MIN_SCALE = 0.25
export const MAX_SCALE = 4
export const FIT: ZoomPan = { x: 0, y: 0, scale: 1 }

/** Zoom by `factor` keeping `point` (viewport coordinates) under the cursor; the scale stays in MIN..MAX. */
export function zoomAt(s: ZoomPan, factor: number, point: { x: number; y: number }): ZoomPan {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, s.scale * factor))
  const k = scale / s.scale
  return { scale, x: point.x - (point.x - s.x) * k, y: point.y - (point.y - s.y) * k }
}

export function panBy(s: ZoomPan, dx: number, dy: number): ZoomPan {
  return { ...s, x: s.x + dx, y: s.y + dy }
}

/** Below this share of its own width a diagram fitted to its frame stops being readable (labels under ~8px). */
export const DIAGRAM_FIT_FLOOR = 0.6

/** The reader's pick on the control row ("Fit to width" / "Actual size"); null = not picked, the rule decides. */
export type DiagramChoice = "fit" | "actual" | null

/**
 * How a diagram sits in its frame (the inline doc view; Fullscreen has its own zoom). It fits: as drawn. Wider than
 * the frame: scaled to the width while that keeps at least DIAGRAM_FIT_FLOOR, else at actual size, scrolling
 * sideways. A reader's pick wins either way. `scale` is what the control row shows.
 */
export function diagramView(natural: number, inner: number, choice: DiagramChoice): { overflow: boolean; actual: boolean; scale: number } {
  if (!(natural > inner + 1) || inner <= 0) return { overflow: false, actual: false, scale: 1 }
  const fit = inner / natural
  const actual = choice ? choice === "actual" : fit < DIAGRAM_FIT_FLOOR
  return { overflow: true, actual, scale: actual ? 1 : fit }
}
