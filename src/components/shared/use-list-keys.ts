"use client"

import { useEffect, useRef, type RefObject } from "react"
import { shouldHandleShortcut } from "@/lib/shortcuts"

/** Extra keys on the list (Inbox a / s): called with the current item and its index (-1 = none yet). */
type ExtraKeys = Record<string, (item: HTMLElement | undefined, index: number) => void>

/**
 * One keyboard model for lists (board cards, table rows, chats, inbox rows):
 * j / k move focus to the next / previous item from anywhere on the page, ↓ / ↑ do the same from inside the list,
 * Enter opens the current item when nothing has focus (on the item itself Enter is native).
 * Items = `selector` matches inside `ref`, visible only, in DOM (reading) order. Never while typing or in a dialog.
 * Capture phase, so an extra key like `a` wins over the layout's page jumps on this page.
 */
export function useListKeys(ref: RefObject<HTMLElement | null>, selector: string, extra: ExtraKeys = {}, enabled = true) {
  const last = useRef(-1)
  const extraRef = useRef(extra)
  useEffect(() => { extraRef.current = extra })

  useEffect(() => {
    if (!enabled) return
    function onKey(e: KeyboardEvent) {
      if (!shouldHandleShortcut(e) || document.querySelector("[role=dialog]")) return
      const root = ref.current
      if (!root) return
      const items = Array.from(root.querySelectorAll<HTMLElement>(selector)).filter((el) => el.getClientRects().length > 0 && !el.closest("[inert]"))
      const active = document.activeElement
      const focused = items.findIndex((el) => el.contains(active))
      if (focused >= 0) last.current = focused
      const at = focused >= 0 ? focused : last.current < items.length ? last.current : -1
      const arrow = e.key === "ArrowDown" || e.key === "ArrowUp"
      if (arrow && !root.contains(active)) return
      if (e.key === "j" || e.key === "k" || arrow) {
        if (!items.length) return
        const next = Math.min(items.length - 1, Math.max(0, at < 0 ? 0 : at + (e.key === "j" || e.key === "ArrowDown" ? 1 : -1)))
        last.current = next
        items[next].focus()
        items[next].scrollIntoView({ block: "nearest" })
      } else if (e.key === "Enter") {
        if (active && active !== document.body) return
        if (at < 0) return
        items[at].click()
      } else if (extraRef.current[e.key]) {
        extraRef.current[e.key](items[at], at)
      } else return
      e.preventDefault()
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [ref, selector, enabled])
}
