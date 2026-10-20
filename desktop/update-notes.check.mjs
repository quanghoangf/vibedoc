// Self-check for desktop/update-notes.mjs (R112 T582). Run: node desktop/update-notes.check.mjs
import assert from 'node:assert/strict'
import { notesText, visibleUpdate } from './update-notes.mjs'

assert.equal(notesText('  <p>Fixed it</p>\n'), '<p>Fixed it</p>')
assert.equal(notesText(null), '')
assert.equal(notesText(undefined), '')
assert.equal(notesText([{ version: '1.26.0', note: 'B' }, { version: '1.25.0', note: ' A ' }, { version: '1.24.1', note: null }]), '## 1.26.0\n\nB\n\n## 1.25.0\n\nA')

const found = { version: '1.25.0', notes: 'x', date: '2026-10-21' }
assert.equal(visibleUpdate(found, null), found)
assert.equal(visibleUpdate(found, '1.24.9'), found, 'Later on an older version does not hide a newer one')
assert.equal(visibleUpdate(found, '1.25.0'), null, 'Later hides that version')
assert.equal(visibleUpdate(null, null), null)
console.log('update-notes.check: ok')
