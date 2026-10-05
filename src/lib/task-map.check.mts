import assert from 'node:assert/strict'
import { normSpecPath, parseTaskMap, taskForFile } from './task-map.ts'

assert.equal(normSpecPath('./e2e\\vibedoc\\T1.spec.ts'), 'e2e/vibedoc/T1.spec.ts')
const map = parseTaskMap('{"./e2e/a.spec.ts":"T138","e2e\\\\b.spec.ts":"T155","bad.spec.ts":"nope","n.spec.ts":3}')
assert.deepEqual(map, { 'e2e/a.spec.ts': 'T138', 'e2e/b.spec.ts': 'T155' })
assert.equal(taskForFile(map, 'e2e/a.spec.ts', 'no-task'), 'T138')
assert.equal(taskForFile(map, './e2e/b.spec.ts', 'no-task'), 'T155')
assert.equal(taskForFile(map, 'e2e/c.spec.ts', 'T9'), 'T9', 'unmapped spec → fallback')
assert.equal(taskForFile(null, 'e2e/a.spec.ts', 'no-task'), 'no-task')
for (const bad of [undefined, '', 'nope', '[]', 'null']) assert.equal(parseTaskMap(bad), null)
console.log('ok task-map')
