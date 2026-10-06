// Self-check for keyboard shortcuts. Run: node src/lib/shortcuts.check.mts
import assert from 'node:assert/strict'
import { GLOBAL_HELP_KEYS, GRAPH_KEYS, ITEM_KEYS, PAGE_HELP, SHORTCUT_SECTIONS, helpFor, TEST_REVIEW_KEYS, OTHER_SHORTCUTS, PAGE_SHORTCUTS, inTextField, itemActionForKey, pageForKey, pageTitle, shortcutFor, shouldHandleShortcut } from './shortcuts.ts'

// A page-jump key never means anything else, and a key appears once per help-sheet section (the Graph section
// repeats / and Esc on purpose: on /graph they do graph things)
const pageKeys = PAGE_SHORTCUTS.map((s) => s.key)
assert.equal(new Set(pageKeys).size, pageKeys.length, 'duplicate page key')
// Test review's a / s shadow Activity / Settings on /manual-tests only (that page handles them first)
for (const s of OTHER_SHORTCUTS) {
  if (s.section === 'Test review' && ['a', 's'].includes(s.key)) continue
  assert.ok(!pageKeys.includes(s.key), `${s.key} is a page jump`)
}
for (const section of new Set(OTHER_SHORTCUTS.map((s) => s.section))) {
  const keys = OTHER_SHORTCUTS.filter((s) => s.section === section).map((s) => s.key)
  assert.equal(new Set(keys).size, keys.length, `duplicate key in ${section}`)
}

assert.equal(pageForKey('r'), '/roadmap')
assert.equal(pageForKey('z'), undefined)
assert.equal(shortcutFor('/board'), 'b')
assert.equal(pageForKey('t'), '/manual-tests')
assert.equal(pageForKey('s'), '/settings')
assert.equal(pageForKey('g'), '/chat')
assert.equal(pageForKey('l'), '/graph')
assert.equal(pageTitle('/graph'), 'shell.graph')
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
assert.equal(pageTitle('/chat'), 'shell.chats')
// g and c read differently in the help sheet
assert.equal(PAGE_SHORTCUTS.find((s) => s.key === 'g')?.help, 'help.chatsPage')
assert.equal(OTHER_SHORTCUTS.find((s) => s.key === 'c')?.label, 'help.openNextChat')
assert.equal(pageTitle('/docs/some/path'), 'shell.docs')
// graph node keys never shadow a page jump
assert.equal(pageForKey('o'), undefined, 'o opens the focused graph node')
// the help sheet's Graph section lists every graph key, from the same list as the selected-file card
const graphRows = OTHER_SHORTCUTS.filter((s) => s.section === 'Graph')
assert.deepEqual(graphRows.map((s) => s.key), Object.values(GRAPH_KEYS).map((k) => k.key))
for (const k of ['/', 'Tab', '↵', 'o', '←→↑↓', 'Esc', '↵ ⇧↵']) assert.ok(graphRows.some((s) => s.key === k), `Graph section lists ${k}`)
assert.equal(pageForKey(GRAPH_KEYS.open.key), undefined, 'o is not a page jump')
assert.equal(pageTitle('/boardx'), undefined)
assert.deepEqual(OTHER_SHORTCUTS.filter((s) => s.section === 'Test review').map((s) => s.key), Object.values(TEST_REVIEW_KEYS).map((k) => k.key))
for (const { key } of Object.values(TEST_REVIEW_KEYS)) {
  if (!['a', 's'].includes(key)) assert.equal(pageForKey(key), undefined, `test review key ${key} clashes with a page jump`)
}

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

// Help panel: every page with a key has help (except Explorer / Settings, which have no page keys); every key it
// shows is in the full list, so the two never disagree
const allKeys = new Set(SHORTCUT_SECTIONS.flatMap((sec) => sec.rows.map((r) => r.key)))
for (const [href, help] of Object.entries(PAGE_HELP)) {
  assert.ok(PAGE_SHORTCUTS.some((p) => p.href === href), `${href} is not a page`)
  for (const { key } of help.keys) assert.ok(allKeys.has(key), `${href} help lists ${key}, missing from the full list`)
  assert.ok(help.tips.length > 0, `${href} has no tips`)
}
for (const { key } of GLOBAL_HELP_KEYS) assert.ok(allKeys.has(key), `global ${key} missing from the full list`)
for (const href of ['/board', '/roadmap', '/docs', '/graph', '/manual-tests']) assert.ok(PAGE_HELP[href], `${href} needs help`)
assert.equal(helpFor('/manual-tests')?.title, 'tests.title')
assert.equal(helpFor('/docs/architecture/HLD.md')?.title, 'shell.docs')
assert.equal(helpFor('/settings'), null)
assert.equal(helpFor('/boardx'), null)

// Every text is a message key that exists in English (types catch typos in the app; this catches them here too)
const areas = Object.fromEntries(await Promise.all(['shell', 'board', 'docs', 'tests', 'help'].map(async (a) => [a, (await import(`../i18n/${a}.ts`)).en])))
const texts = [
  ...PAGE_SHORTCUTS.flatMap((p) => [p.label, p.help]), ...SHORTCUT_SECTIONS.flatMap((s) => [s.title, ...s.rows.map((r) => r.description)]),
  ...Object.values(PAGE_HELP).flatMap((h) => [h.title, ...h.keys.map((k) => k.label), ...h.tips]), ...GLOBAL_HELP_KEYS.map((k) => k.label),
].filter((x): x is string => !!x)
for (const k of texts) {
  const [area, key] = k.split('.')
  assert.ok(areas[area]?.[key], `${k} is not a message`)
}

console.log('shortcuts.check: ok')
