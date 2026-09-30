"use client"

import { useEffect, useRef, useSyncExternalStore } from "react"
import { ITEM_KEYS, itemActionForKey, shouldHandleShortcut, type ItemAction } from "@/lib/shortcuts"

export interface ItemCommand {
  action: ItemAction
  label: string
  run: () => void
}

/** The open/selected item's actions. The newest registration wins (a panel over a board selection). */
interface Entry { title: string; get: () => ItemCommand[] }

let stack: Entry[] = []
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb) } }
const top = () => stack[stack.length - 1] ?? null

/**
 * Register the actions for the item on screen while `title` is set (e.g. "T075 · Edit and delete tasks").
 * Commands are read when used, so they may be a fresh array each render.
 */
export function useItemCommands(title: string | null, commands: ItemCommand[]) {
  const ref = useRef(commands)
  useEffect(() => { ref.current = commands })
  useEffect(() => {
    if (!title) return
    const entry: Entry = { title, get: () => ref.current }
    stack = [...stack, entry]
    emit()
    return () => { stack = stack.filter((e) => e !== entry); emit() }
  }, [title])
}

/** For the ⌘K palette: the current item and its actions, or null. */
export function useCurrentItemCommands(): { title: string; commands: ItemCommand[] } | null {
  const entry = useSyncExternalStore(subscribe, top, () => null)
  return entry && { title: entry.title, commands: entry.get() }
}

export const itemKeyLabel = (action: ItemAction) => ITEM_KEYS[action].label

/** Global key handler for item actions (mounted once in the app layout). */
export function ItemCommandKeys() {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const action = itemActionForKey(e.key)
      if (!action || !shouldHandleShortcut(e)) return
      // An open menu owns the keyboard (type-ahead, arrows)
      if (document.querySelector("[role=menu]")) return
      const cmd = top()?.get().find((c) => c.action === action)
      if (!cmd) return
      e.preventDefault()
      cmd.run()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])
  return null
}
