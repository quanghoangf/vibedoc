"use client"

import { useEffect, useRef, useSyncExternalStore } from "react"
import { ITEM_KEYS, itemActionForKey, shouldHandleShortcut, type ItemAction } from "@/lib/shortcuts"
import { useApp } from "@/context/AppContext"

export interface ItemCommand {
  /** The item key it answers to; none = a ⌘K-only command, told apart by `id` */
  action?: ItemAction
  id?: string
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
  // Every item action edits, deletes or chats: a read-only demo (R042) registers none, so keys and ⌘K offer nothing
  const { demo } = useApp()
  useEffect(() => { ref.current = commands })
  useEffect(() => {
    if (!title || demo) return
    const entry: Entry = { title, get: () => ref.current }
    stack = [...stack, entry]
    emit()
    return () => { stack = stack.filter((e) => e !== entry); emit() }
  }, [title, demo])
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
