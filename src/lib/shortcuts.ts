// Keyboard shortcuts: one list for the global key handler ((app)/layout.tsx), the `?` help sheet,
// the ⌘K palette and the sidebar hints. Pure data, no React.

export interface PageShortcut {
  href: string
  /** Single key, as KeyboardEvent.key reports it */
  key: string
  label: string
  /** Help-sheet wording when `label` alone is ambiguous (label still names the page in the tab title) */
  help?: string
}

/** Single-key page jumps. Only fire outside text fields and without ⌘/Ctrl/Alt. */
export const PAGE_SHORTCUTS: readonly PageShortcut[] = [
  { href: "/board", key: "b", label: "Board" },
  { href: "/roadmap", key: "r", label: "Roadmap" },
  { href: "/docs", key: "d", label: "Docs" },
  { href: "/activity", key: "a", label: "Activity" },
  { href: "/memory", key: "m", label: "Memory" },
  { href: "/explorer", key: "e", label: "Explorer" },
  { href: "/manual-tests", key: "t", label: "Manual tests" },
  { href: "/settings", key: "s", label: "Settings" },
  { href: "/chat", key: "g", label: "Chats", help: "Chats page" },
]

/** Opens the head of the attention queue (needs you, then errors); again on the head walks to the next. */
export const CHAT_KEY = "c"

/**
 * Actions on the open or selected item (task panel, epic sheet, open doc, board selection).
 * Shift + letter so they never collide with the bare-letter page jumps above.
 */
export const ITEM_KEYS = {
  edit: { key: "E", label: "⇧E", help: "Edit / rename" },
  status: { key: "S", label: "⇧S", help: "Change status" },
  duplicate: { key: "D", label: "⇧D", help: "Duplicate" },
  chat: { key: "C", label: "⇧C", help: "Chat about it" },
  remove: { key: "Backspace", label: "⌫", help: "Delete (Undo in the toast)" },
} as const
export type ItemAction = keyof typeof ITEM_KEYS

/** The item action a key press means (Delete works like Backspace). */
export function itemActionForKey(key: string): ItemAction | undefined {
  if (key === "Delete") return "remove"
  return (Object.keys(ITEM_KEYS) as ItemAction[]).find((a) => ITEM_KEYS[a].key === key)
}

/** Everything else the help sheet lists, after the page jumps, grouped by `section`. */
export const OTHER_SHORTCUTS: readonly { key: string; label: string; section: "Open" | "Board" | "Open item" | "Editing & other" }[] = [
  { key: "⌘K", label: "Command palette", section: "Open" },
  { key: "⌘P", label: "Go to file", section: "Open" },
  { key: CHAT_KEY, label: "Open next chat", section: "Open" },
  { key: "n", label: "New task", section: "Board" },
  { key: "v", label: "Next view", section: "Board" },
  { key: "1–4", label: "Board · Table · By epic · Timeline", section: "Board" },
  { key: "f", label: "Open filters", section: "Board" },
  { key: "⇧-click", label: "Select tasks (bulk actions)", section: "Board" },
  ...Object.values(ITEM_KEYS).map(({ label, help }) => ({ key: label, label: help, section: "Open item" as const })),
  { key: "/", label: "Focus search (docs, board)", section: "Editing & other" },
  { key: "⌘B", label: "Toggle sidebar", section: "Editing & other" },
  { key: "?", label: "Toggle this help", section: "Editing & other" },
  { key: "Esc", label: "Close panel / modal", section: "Editing & other" },
]

export function shortcutFor(href: string): string | undefined {
  return PAGE_SHORTCUTS.find((s) => s.href === href)?.key
}

/** The page a bare key jumps to, if any. */
export function pageForKey(key: string): string | undefined {
  return PAGE_SHORTCUTS.find((s) => s.key === key)?.href
}

/** Page name for a pathname (document.title), matching nested routes too. */
export function pageTitle(pathname: string): string | undefined {
  return PAGE_SHORTCUTS.find((s) => pathname === s.href || pathname.startsWith(`${s.href}/`))?.label
}

const TEXT_FIELDS = "input, textarea, select, [contenteditable], [role=textbox], [role=combobox], .cm-editor"

/** The bits of a KeyboardEvent the guard reads; duck-typed so it runs outside the DOM. */
export interface ShortcutEvent {
  defaultPrevented: boolean
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
  target: EventTarget | { isContentEditable?: boolean; closest?: (s: string) => unknown } | null
}

/**
 * Single-key shortcuts fire only when nothing else claimed the key: no ⌘/Ctrl/Alt (⌘B, ⌘C keep
 * their meaning), not already handled, and focus not in a text field (inputs, CodeMirror,
 * contenteditable), where the key belongs to the field.
 */
export function shouldHandleShortcut(e: ShortcutEvent): boolean {
  if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return false
  return !inTextField(e.target)
}

/** Focus is in a text field (inputs, CodeMirror, contenteditable), where keys belong to the field. */
export function inTextField(target: ShortcutEvent["target"]): boolean {
  const t = target as { isContentEditable?: boolean; closest?: (s: string) => unknown } | null
  return !!(t?.isContentEditable || (typeof t?.closest === "function" && t.closest(TEXT_FIELDS)))
}
