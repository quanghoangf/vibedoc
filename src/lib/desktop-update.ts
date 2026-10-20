// The desktop app's update card (R112 T582/T583) as a state machine: available → downloading (percent) → ready
// (restart to update), or failed (a link to the release page instead, e.g. macOS can't install into an unsigned app).
// Events come from desktop/updater.mjs over the preload (window.vibedocDesktop.onUpdateEvent). Pure.
// Check: node src/lib/desktop-update.check.mts

export interface DesktopUpdate { version: string; notes: string; date: string | null }

export type UpdateState =
  | { phase: "none" }
  | { phase: "available"; update: DesktopUpdate }
  | { phase: "downloading"; update: DesktopUpdate; percent: number }
  | { phase: "ready"; update: DesktopUpdate }
  | { phase: "failed"; update: DesktopUpdate; message: string }

export type UpdateEvent =
  | { type: "available"; update: DesktopUpdate }
  | { type: "download" }
  | { type: "progress"; percent: number }
  | { type: "downloaded" }
  | { type: "error"; message: string }
  | { type: "dismiss" }

export const NO_UPDATE: UpdateState = { phase: "none" }

export function nextUpdateState(s: UpdateState, e: UpdateEvent): UpdateState {
  switch (e.type) {
    case "available":
      // a newer version replaces what was shown; the same one while it downloads or waits to restart changes nothing
      if (s.phase !== "none" && s.update.version === e.update.version && s.phase !== "available") return s
      return { phase: "available", update: e.update }
    case "dismiss":
      return s.phase === "available" || s.phase === "failed" ? NO_UPDATE : s
  }
  if (s.phase === "none") return s
  switch (e.type) {
    case "download":
      return s.phase === "available" || s.phase === "failed" ? { phase: "downloading", update: s.update, percent: 0 } : s
    case "progress":
      return s.phase === "downloading" ? { ...s, percent: Math.max(s.percent, Math.min(100, Math.round(e.percent))) } : s
    case "downloaded":
      return s.phase === "downloading" ? { phase: "ready", update: s.update } : s
    case "error":
      return { phase: "failed", update: s.update, message: e.message }
  }
}

/** Where a failed update sends the user: that version's GitHub release, with every installer. */
export const releasePage = (version: string) => `https://github.com/quanghoangf/vibedoc/releases/tag/v${version}`
