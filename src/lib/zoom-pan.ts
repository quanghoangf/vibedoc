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
