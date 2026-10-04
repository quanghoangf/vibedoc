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
  { href: "/graph", key: "l", label: "Graph", help: "Link graph" },
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

/** ⌘\ (Ctrl+\) on /docs: hide or show the docs list. Works inside the editor too, like a focus mode. */
export const DOCS_LIST_KEY = { key: "\\", label: "⌘\\" } as const
export const TOGGLE_DOCS_LIST_EVENT = "vibedoc:toggle-docs-list"

/** Keys on /graph: the help sheet's Graph section and the selected-file card's kbd strip read this one list. */
export const GRAPH_KEYS = {
  search: { key: "/", label: "Find a file" },
  matches: { key: "↵ ⇧↵", label: "In search: frame matches, then next / previous" },
  tab: { key: "Tab", label: "Next file, then the unlinked shelf" },
  select: { key: "↵", label: "Select file; again to open" },
  open: { key: "o", label: "Open the focused file" },
  move: { key: "←→↑↓", label: "Move to a linked file" },
  clear: { key: "Esc", label: "Clear the search, then the selection" },
} as const

/**
 * Keys on /manual-tests (Test review): the help sheet's section and the detail's kbd strip read this one list.
 * `a` and `s` shadow the Activity / Settings jumps on that page only.
 */
export const TEST_REVIEW_KEYS = {
  move: { key: "j k", label: "Next / previous task" },
  tick: { key: "x", label: "Tick the next manual check" },
  approve: { key: "a", label: "Approve (in review): focus it, a again confirms" },
  sendBack: { key: "s", label: "Send back with a note" },
  failed: { key: "f", label: "Next failed task" },
  pick: { key: "⇧/⌘-click", label: "Select several tasks (bulk tick, approve, send back); Esc clears" },
  expand: { key: "o", label: "Open the task as a page / collapse back to the list" },
  play: { key: "Space", label: "Play / pause (player focused)" },
} as const

/** Everything else the help sheet lists, after the page jumps, grouped by `section`. */
export const OTHER_SHORTCUTS: readonly { key: string; label: string; section: "Open" | "Board" | "Graph" | "Test review" | "Open item" | "Editing & other" }[] = [
  { key: "⌘K", label: "Command palette", section: "Open" },
  { key: "⌘P", label: "Go to file", section: "Open" },
  { key: CHAT_KEY, label: "Open next chat", section: "Open" },
  { key: "n", label: "New task", section: "Board" },
  { key: "v", label: "Next view", section: "Board" },
  { key: "1–4", label: "Board · Table · By epic · Timeline", section: "Board" },
  { key: "f", label: "Open filters", section: "Board" },
  { key: "⇧-click", label: "Select tasks (bulk actions)", section: "Board" },
  ...Object.values(GRAPH_KEYS).map(({ key, label }) => ({ key, label, section: "Graph" as const })),
  ...Object.values(TEST_REVIEW_KEYS).map(({ key, label }) => ({ key, label, section: "Test review" as const })),
  ...Object.values(ITEM_KEYS).map(({ label, help }) => ({ key: label, label: help, section: "Open item" as const })),
  { key: "/", label: "Focus search (docs, board)", section: "Editing & other" },
  { key: DOCS_LIST_KEY.label, label: "Hide / show the docs list", section: "Editing & other" },
  { key: "⌘B", label: "Toggle sidebar", section: "Editing & other" },
  { key: "?", label: "Toggle this help", section: "Editing & other" },
  { key: "Esc", label: "Close panel or modal", section: "Editing & other" },
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
