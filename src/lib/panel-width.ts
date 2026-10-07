// Width of the board's task quick view, dragged from its left edge and remembered per browser in a cookie
// (CLAUDE.md bans localStorage). Pure: `node src/lib/panel-width.check.mts`.

export const PANEL_WIDTH_COOKIE = "vibedoc-panel-width"
export const PANEL_DEFAULT_WIDTH = 520
export const PANEL_MIN_WIDTH = 380
/** Never wider than this share of the window, so some of the board stays visible */
export const PANEL_MAX_SHARE = 0.85
export const PANEL_KEYBOARD_STEP = 32

/** `w` kept between the minimum and the largest width this window allows. */
export function clampPanelWidth(w: number, viewport: number): number {
  const max = Math.max(PANEL_MIN_WIDTH, Math.floor(viewport * PANEL_MAX_SHARE))
  return Math.round(Math.min(max, Math.max(PANEL_MIN_WIDTH, w)))
}

/** The cookie's value as a width; missing or junk → the default. */
export function parsePanelWidth(value: string | null | undefined): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : PANEL_DEFAULT_WIDTH
}

/** A `document.cookie` assignment, same lifetime as the player and language cookies. */
export function panelWidthCookie(w: number): string {
  return `${PANEL_WIDTH_COOKIE}=${Math.round(w)}; path=/; max-age=31536000; samesite=lax`
}
