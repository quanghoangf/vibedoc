"use client"

import { useSyncExternalStore } from "react"
import { emptyRecent, parseRecent, pushRecent, recentCookie, RECENT_COOKIE, type Recent, type RecentKind } from "@/lib/recent-items"
import { disclosureCookie, parseDisclosure, SIDEBAR_COOKIE, type Disclosure, type SidebarPage } from "@/lib/sidebar-items"
import { readCookie } from "@/lib/player-prefs"

// The sidebar's per-browser state (T511): recently opened items and which pages are open, both cookies.
// A module store so a write anywhere (board, roadmap, the sidebar) re-renders the sidebar.
const listeners = new Set<() => void>()
const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb) } }
const notify = () => listeners.forEach((l) => l())

// Snapshots are cached by the raw cookie text: useSyncExternalStore needs the same object while nothing changed
let recentRaw: string | null | undefined
let recent: Recent = emptyRecent()
function getRecent(): Recent {
  const raw = readCookie(document.cookie, RECENT_COOKIE)
  if (raw !== recentRaw) { recentRaw = raw; recent = parseRecent(raw) }
  return recent
}

let disclosureRaw: string | null | undefined
let disclosure: Disclosure = {}
function getDisclosure(): Disclosure {
  const raw = readCookie(document.cookie, SIDEBAR_COOKIE)
  if (raw !== disclosureRaw) { disclosureRaw = raw; disclosure = parseDisclosure(raw) }
  return disclosure
}

const EMPTY_RECENT = emptyRecent()
const EMPTY_DISCLOSURE: Disclosure = {}

export function useRecent(): Recent {
  return useSyncExternalStore(subscribe, getRecent, () => EMPTY_RECENT)
}

export function useDisclosure(): Disclosure {
  return useSyncExternalStore(subscribe, getDisclosure, () => EMPTY_DISCLOSURE)
}

/** Remember an opened item for the sidebar (ids only). */
export function recordRecent(kind: RecentKind, id: string) {
  const cur = getRecent()
  const next = pushRecent(cur, kind, id)
  if (next === cur) return
  document.cookie = recentCookie(next)
  notify()
}

export function setPageOpen(page: SidebarPage, open: boolean) {
  document.cookie = disclosureCookie({ ...getDisclosure(), [page]: open })
  notify()
}
