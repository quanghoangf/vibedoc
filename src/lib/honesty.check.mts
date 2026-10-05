import assert from 'node:assert/strict'
import { isPageSubject, stepVerdict } from './honesty.ts'

const passed = (total?: number, onPage?: number) => ({ status: 'passed', ...(total === undefined ? {} : { assertions: { total, onPage: onPage ?? total } }) })
assert.deepEqual(stepVerdict(passed(2, 1)), [])
assert.deepEqual(stepVerdict(passed(0, 0)), ['no assertion'])
assert.deepEqual(stepVerdict(passed(1, 0)), ['only trivial assertions'])
assert.deepEqual(stepVerdict(passed()), [], 'no counts (old run / not on the kit) = unknown, not flagged')
assert.deepEqual(stepVerdict(passed(1, 1), true), ['passes without the app'])
assert.deepEqual(stepVerdict(passed(0, 0), true), ['no assertion', 'passes without the app'])
assert.deepEqual(stepVerdict({ status: 'failed', assertions: { total: 0, onPage: 0 } }, true), [])

const locator = { waitFor() {}, locator() {} }
const page = { goto() {} }
const response = { status() {}, headers() {} }
for (const s of [locator, page, response, () => 1]) assert.equal(isPageSubject(s), true)
for (const s of [true, 1, 'x', null, undefined, { a: 1 }, [locator]]) assert.equal(isPageSubject(s), false)
console.log('ok honesty')
