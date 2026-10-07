// Keyboard shortcuts: one list for the global key handler ((app)/layout.tsx), the `?` help sheet,
// the ⌘K palette and the sidebar hints. Pure data, no React. Text is message keys (src/i18n, R078): the Help panel and
// the tab title resolve them with t(); the type import is erased, so `node shortcuts.check.mts` still runs.
import type { MessageKey } from "../i18n"

export interface PageShortcut {
  href: string
  /** Single key, as KeyboardEvent.key reports it */
  key: string
  label: MessageKey
  /** Help-sheet wording when `label` alone is ambiguous (label still names the page in the tab title) */
  help?: MessageKey
}

/** Single-key page jumps. Only fire outside text fields and without ⌘/Ctrl/Alt. */
export const PAGE_SHORTCUTS: readonly PageShortcut[] = [
  { href: "/board", key: "b", label: "shell.board" },
  { href: "/roadmap", key: "r", label: "shell.roadmap" },
  { href: "/docs", key: "d", label: "shell.docs" },
  { href: "/activity", key: "a", label: "shell.activity" },
  { href: "/memory", key: "m", label: "shell.memory" },
  { href: "/explorer", key: "e", label: "shell.explorer" },
  { href: "/graph", key: "l", label: "shell.graph", help: "help.linkGraph" },
  { href: "/manual-tests", key: "t", label: "shell.manualTests" },
  { href: "/settings", key: "s", label: "shell.settings" },
  { href: "/chat", key: "g", label: "shell.chats", help: "help.chatsPage" },
]

/** Opens the head of the attention queue (needs you, then errors); again on the head walks to the next. */
export const CHAT_KEY = "c"

/**
 * Actions on the open or selected item (task panel, epic sheet, open doc, board selection).
 * Shift + letter so they never collide with the bare-letter page jumps above.
 */
export const ITEM_KEYS = {
  edit: { key: "E", label: "⇧E", help: "help.itemEdit" },
  open: { key: "O", label: "⇧O", help: "help.itemOpen" },
  status: { key: "S", label: "⇧S", help: "help.itemStatus" },
  duplicate: { key: "D", label: "⇧D", help: "docs.duplicate" },
  chat: { key: "C", label: "⇧C", help: "help.itemChat" },
  remove: { key: "Backspace", label: "⌫", help: "help.itemRemove" },
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
  search: { key: "/", label: "help.graphFind" },
  matches: { key: "↵ ⇧↵", label: "help.graphMatches" },
  tab: { key: "Tab", label: "help.graphTab" },
  select: { key: "↵", label: "help.graphSelect" },
  open: { key: "o", label: "help.graphOpen" },
  move: { key: "←→↑↓", label: "help.graphMove" },
  clear: { key: "Esc", label: "help.graphClear" },
} as const

/**
 * Keys on /manual-tests (Test review): the help sheet's section and the detail's kbd strip read this one list.
 * `a` and `s` shadow the Activity / Settings jumps on that page only.
 */
export const TEST_REVIEW_KEYS = {
  move: { key: "j k", label: "help.trMove" },
  tick: { key: "x", label: "help.trTick" },
  approve: { key: "a", label: "help.trApprove" },
  sendBack: { key: "s", label: "help.trSendBack" },
  failed: { key: "f", label: "help.trFailed" },
  pick: { key: "⇧/⌘-click", label: "help.trPick" },
  run: { key: "p", label: "help.trRun" },
  suite: { key: "u", label: "help.trSuite" },
  view: { key: "v", label: "help.trView" },
  runs: { key: "[ ]", label: "help.trRuns" },
  expand: { key: "o", label: "help.trExpand" },
  play: { key: "Space", label: "help.trPlay" },
} as const

/** Everything else the help sheet lists, after the page jumps, grouped by `section`. */
export const OTHER_SHORTCUTS: readonly { key: string; label: MessageKey; section: "Open" | "Board" | "Graph" | "Test review" | "Open item" | "Editing & other" }[] = [
  { key: "⌘K", label: "help.commandPalette", section: "Open" },
  { key: "⌘P", label: "help.goToFile", section: "Open" },
  { key: CHAT_KEY, label: "help.openNextChat", section: "Open" },
  { key: "n", label: "board.newTask", section: "Board" },
  { key: "v", label: "help.nextView", section: "Board" },
  { key: "1–4", label: "help.boardViews", section: "Board" },
  { key: "f", label: "help.openFilters", section: "Board" },
  { key: "⇧-click", label: "help.selectTasks", section: "Board" },
  ...Object.values(GRAPH_KEYS).map(({ key, label }) => ({ key, label, section: "Graph" as const })),
  ...Object.values(TEST_REVIEW_KEYS).map(({ key, label }) => ({ key, label, section: "Test review" as const })),
  ...Object.values(ITEM_KEYS).map(({ label, help }) => ({ key: label, label: help, section: "Open item" as const })),
  { key: "/", label: "help.focusSearchWhere", section: "Editing & other" },
  { key: DOCS_LIST_KEY.label, label: "help.toggleDocsList", section: "Editing & other" },
  { key: "⌘B", label: "help.toggleSidebar", section: "Editing & other" },
  { key: "?", label: "help.pinHelp", section: "Editing & other" },
  { key: "Esc", label: "help.closePanel", section: "Editing & other" },
]

/** The full list, by section: the Help panel's "All shortcuts" view. */
const SECTION_TITLE: Record<(typeof OTHER_SHORTCUTS)[number]["section"], MessageKey> = {
  Open: "help.sectionOpen",
  Board: "shell.board",
  Graph: "shell.graph",
  "Test review": "tests.title",
  "Open item": "help.sectionItem",
  "Editing & other": "help.sectionOther",
}

export const SHORTCUT_SECTIONS: readonly { title: MessageKey; rows: readonly { key: string; description: MessageKey }[] }[] = [
  { title: "help.goTo", rows: PAGE_SHORTCUTS.map(({ key, label, help }) => ({ key, description: help ?? label })) },
  ...(["Open", "Board", "Graph", "Test review", "Open item", "Editing & other"] as const).map((section) => ({
    title: SECTION_TITLE[section], rows: OTHER_SHORTCUTS.filter((s) => s.section === section).map(({ key, label }) => ({ key, description: label })),
  })),
]

export interface PageHelp {
  title: MessageKey
  /** This page's keys; every one also appears in the full list above */
  keys: readonly { key: string; label: MessageKey }[]
  tips: readonly MessageKey[]
}

const itemKeysWithout = (skip: ItemAction) =>
  (Object.keys(ITEM_KEYS) as ItemAction[]).filter((a) => a !== skip).map((a) => ({ key: ITEM_KEYS[a].label, label: ITEM_KEYS[a].help }))
// the board's task panel opens the full doc (⇧O) and has no edit form; roadmap and docs items edit / rename (⇧E)
const boardItemKeys = itemKeysWithout("edit")
const itemKeys = itemKeysWithout("open")
const board = (k: string) => OTHER_SHORTCUTS.find((s) => s.section === "Board" && s.key === k)!

/**
 * The Help panel (bottom-right) per page: the keys that work there and a few tips. Replaces the kbd strips that
 * used to sit on every record. Keyed by href; `helpFor` matches nested routes like `pageTitle`.
 */
export const PAGE_HELP: Readonly<Record<string, PageHelp>> = {
  "/board": {
    title: "shell.board",
    keys: [board("n"), board("v"), board("1–4"), board("f"), { key: "/", label: "help.focusSearch" }, board("⇧-click"), ...boardItemKeys],
    tips: [
      "help.tipBoardDrag",
      "help.tipBoardView",
      "help.tipBoardPlay",
    ],
  },
  "/roadmap": {
    title: "shell.roadmap",
    keys: [...itemKeys, { key: "Esc", label: "help.closePanel" }],
    tips: [
      "help.tipRoadmapMenu",
      "help.tipRoadmapArrange",
      "help.tipRoadmapViews",
      "help.tipRoadmapMerge",
    ],
  },
  "/docs": {
    title: "shell.docs",
    keys: [{ key: "/", label: "help.focusSearch" }, { key: "⌘P", label: "help.goToFile" }, { key: DOCS_LIST_KEY.label, label: "help.toggleDocsList" }, ...itemKeys],
    tips: [
      "help.tipDocsPreview",
      "help.tipDocsLinks",
      "help.tipDocsMenu",
    ],
  },
  "/graph": {
    title: "shell.graph",
    keys: Object.values(GRAPH_KEYS),
    tips: [
      "help.tipGraphDrag",
      "help.tipGraphRecent",
      "help.tipGraphShelf",
    ],
  },
  "/manual-tests": {
    title: "tests.title",
    keys: Object.values(TEST_REVIEW_KEYS),
    tips: [
      "help.tipTrSort",
      "help.tipTrEvidence",
      "help.tipTrBulk",
    ],
  },
  "/memory": {
    title: "shell.memory",
    keys: [],
    tips: [
      "help.tipMemorySearch",
      "help.tipMemoryUndo",
      "help.tipMemoryHistory",
    ],
  },
  "/activity": {
    title: "shell.activity",
    keys: [],
    tips: [
      "help.tipActivityFilter",
      "help.tipActivityOpen",
    ],
  },
  "/chat": {
    title: "shell.chats",
    keys: [{ key: CHAT_KEY, label: "help.openNextChat" }],
    tips: [
      "help.tipChatSessions",
      "help.tipChatAttach",
    ],
  },
}

/** Keys that work on every page: the Help panel's last section. */
export const GLOBAL_HELP_KEYS: readonly { key: string; label: MessageKey }[] = [
  { key: "⌘K", label: "help.commandPalette" },
  { key: "⌘P", label: "help.goToFile" },
  { key: CHAT_KEY, label: "help.openNextChat" },
  { key: "?", label: "help.pinThisHelp" },
]

/** The Help panel's content for a pathname (nested routes match their page), or null for pages without one. */
export function helpFor(pathname: string): PageHelp | null {
  const href = Object.keys(PAGE_HELP).find((h) => pathname === h || pathname.startsWith(`${h}/`))
  return href ? PAGE_HELP[href] : null
}

export function shortcutFor(href: string): string | undefined {
  return PAGE_SHORTCUTS.find((s) => s.href === href)?.key
}

/** The page a bare key jumps to, if any. */
export function pageForKey(key: string): string | undefined {
  return PAGE_SHORTCUTS.find((s) => s.key === key)?.href
}

/** Page name (a message key) for a pathname (document.title), matching nested routes too. */
export function pageTitle(pathname: string): MessageKey | undefined {
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
