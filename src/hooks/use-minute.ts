import { useSyncExternalStore } from "react"

const subscribe = (tick: () => void) => {
  const id = setInterval(tick, 30_000)
  return () => clearInterval(id)
}
// Rounded to the minute so the snapshot is stable between ticks
const snapshot = () => Math.floor(Date.now() / 60_000) * 60_000

/** Current time in ms, updated about once a minute (for "5m ago" labels). 0 during server render. */
export function useMinute(): number {
  return useSyncExternalStore(subscribe, snapshot, () => 0)
}
