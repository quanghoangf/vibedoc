"use client"

import { useSyncExternalStore } from "react"
import { DEFAULT_STATUSES, type StatusDef } from "@/lib/statuses"

// The project's statuses (R055), set by AppContext from .vibedoc/settings.json.
// ponytail: module store, one project on screen at a time.
let defs: StatusDef[] = DEFAULT_STATUSES
const listeners = new Set<() => void>()

export function setStatusDefs(next: StatusDef[]) {
  if (JSON.stringify(next) === JSON.stringify(defs)) return
  defs = next
  listeners.forEach((l) => l())
}

export const getStatusDefs = () => defs

/** Every status in the project's order (built-ins included). Re-renders when settings change. */
export function useStatusDefs(): StatusDef[] {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb) } },
    () => defs,
    () => DEFAULT_STATUSES,
  )
}

/** The def for a status key; an unknown key (a removed custom status) shows as its built-in, else todo. */
export function statusDefIn(list: StatusDef[], key: string): StatusDef {
  return list.find((d) => d.id === key) ?? DEFAULT_STATUSES.find((d) => d.id === key) ?? DEFAULT_STATUSES[0]
}
