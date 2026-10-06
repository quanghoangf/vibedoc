// node src/lib/presentation.check.mts
import assert from 'node:assert/strict'
import { presentationMode } from './presentation.ts'

assert.deepEqual(presentationMode({}, true), { on: true, reason: null })
assert.deepEqual(presentationMode({ CI: '' }, true), { on: true, reason: null }, 'a Run from VibeDoc spawns with CI=""')
assert.deepEqual(presentationMode({ CI: 'false' }, true), { on: true, reason: null })
assert.deepEqual(presentationMode({ CI: 'true' }, true), { on: false, reason: 'ci' })
assert.deepEqual(presentationMode({ CI: '1' }, true), { on: false, reason: 'ci' })
assert.deepEqual(presentationMode({ VIBEDOC_PRESENT: '0' }, true), { on: false, reason: 'disabled' })
assert.deepEqual(presentationMode({ VIBEDOC_PRESENT: '1' }, true), { on: true, reason: null })
assert.deepEqual(presentationMode({ VIBEDOC_TASK_MAP: '{"a.spec.ts":"T1"}' }, true), { on: false, reason: 'suite' })
assert.deepEqual(presentationMode({ VIBEDOC_BLANK: '1', VIBEDOC_TASK_MAP: 'x' }, true), { on: false, reason: 'blank' }, 'blank wins')
assert.deepEqual(presentationMode({}, false), { on: false, reason: 'old-playwright' })
assert.deepEqual(presentationMode({ VIBEDOC_PRESENT: '0' }, false), { on: false, reason: 'disabled' }, 'an explicit off says so, not the version')

console.log('presentation.check: ok')
