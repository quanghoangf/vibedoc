// Self-check for keyboard shortcuts. Run: node src/lib/shortcuts.check.mts
import assert from 'node:assert/strict'
import { ITEM_KEYS, OTHER_SHORTCUTS, PAGE_SHORTCUTS, inTextField, itemActionForKey, pageForKey, pageTitle, shortcutFor, shouldHandleShortcut } from './shortcuts.ts'

// Keys are unique across page jumps and the rest, so one key never means two things
const keys = [...PAGE_SHORTCUTS.map((s) => s.key), ...OTHER_SHORTCUTS.map((s) => s.key)]
assert.equal(new Set(keys).size, keys.length, 'duplicate shortcut key')

assert.equal(pageForKey('r'), '/roadmap')
assert.equal(pageForKey('z'), undefined)
assert.equal(shortcutFor('/board'), 'b')
assert.equal(pageForKey('t'), '/manual-tests')
assert.equal(pageForKey('s'), '/settings')
assert.equal(pageForKey('g'), '/chat')
assert.equal(pageForKey('l'), '/graph')
assert.equal(pageTitle('/graph'), 'Graph')
assert.equal(shortcutFor('/setup'), undefined)
// Keys the global handler already uses for something else
for (const k of ['c', '/', '?']) assert.equal(pageForKey(k), undefined, `page key ${k} clashes`)
// Item actions are Shift+letter / ⌫: never a page jump or another global key
for (const { key } of Object.values(ITEM_KEYS)) {
  assert.equal(pageForKey(key), undefined, `item key ${key} clashes with a page jump`)
  assert.ok(!['c', '/', '?', 'n', 'v', 'f'].includes(key), `item key ${key} clashes`)
}
assert.equal(itemActionForKey('E'), 'edit')
assert.equal(itemActionForKey('e'), undefined, 'bare e stays Explorer')
assert.equal(itemActionForKey('Delete'), 'remove')
assert.equal(itemActionForKey('Backspace'), 'remove')
assert.equal(pageTitle('/chat'), 'Chats')
// g and c read differently in the help sheet
assert.equal(PAGE_SHORTCUTS.find((s) => s.key === 'g')?.help, 'Chats page')
assert.equal(OTHER_SHORTCUTS.find((s) => s.key === 'c')?.label, 'Open next chat')
assert.equal(pageTitle('/docs/some/path'), 'Docs')
// graph node keys never shadow a page jump
assert.equal(pageForKey('o'), undefined, 'o opens the focused graph node')
assert.ok(OTHER_SHORTCUTS.some((s) => s.section === 'Graph' && s.key === 'Enter'))
assert.equal(pageTitle('/boardx'), undefined)

const base = { defaultPrevented: false, metaKey: false, ctrlKey: false, altKey: false }
const el = (inField: boolean, editable = false) => ({ isContentEditable: editable, closest: () => (inField ? {} : null) })

// Plain key on the page → handled
assert.equal(shouldHandleShortcut({ ...base, target: el(false) }), true)
assert.equal(shouldHandleShortcut({ ...base, target: null }), true, 'window target')
// Modifiers and already-handled events → left alone (⌘B, ⌘C)
assert.equal(shouldHandleShortcut({ ...base, metaKey: true, target: el(false) }), false)
assert.equal(shouldHandleShortcut({ ...base, ctrlKey: true, target: el(false) }), false)
assert.equal(shouldHandleShortcut({ ...base, altKey: true, target: el(false) }), false)
assert.equal(shouldHandleShortcut({ ...base, defaultPrevented: true, target: el(false) }), false)
// Typing in a field (input, CodeMirror, combobox) or contenteditable → left alone
assert.equal(shouldHandleShortcut({ ...base, target: el(true) }), false)
assert.equal(shouldHandleShortcut({ ...base, target: el(false, true) }), false)
// ⌘B guard (ui/sidebar.tsx) reads the field check alone
assert.equal(inTextField(el(true)), true)
assert.equal(inTextField(el(false)), false)
assert.equal(inTextField(null), false)

console.log('shortcuts.check: ok')
