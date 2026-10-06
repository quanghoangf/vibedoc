// Self-check for UI languages (R078). Run: node src/lib/i18n.check.mts
import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import {
  agoShort, dayHeading, formatDate, formatDay, formatNumber, interpolate, langCookie, monthName, parseLang,
  placeholderMismatches, placeholders, pluralSuffix, timeAgo,
} from './i18n.ts'

assert.equal(parseLang('vi'), 'vi')
assert.equal(parseLang('en'), 'en')
assert.equal(parseLang(undefined), 'en')
assert.equal(parseLang('fr'), 'en', 'unknown language → English')
assert.equal(parseLang(''), 'en')

assert.equal(interpolate('All chats · {n}', { n: 3 }), 'All chats · 3')
assert.equal(interpolate('{a} and {a}', { a: 'x' }), 'x and x')
assert.equal(interpolate('Hi {name}', {}), 'Hi {name}', 'a missing var stays visible')
assert.equal(interpolate('No vars'), 'No vars')

const has = (...s: string[]) => (x: string) => s.includes(x)
assert.equal(pluralSuffix('en', 1, has('one', 'other')), 'one')
assert.equal(pluralSuffix('en', 0, has('one', 'other')), 'other')
assert.equal(pluralSuffix('en', 2, has('one', 'other')), 'other')
assert.equal(pluralSuffix('vi', 1, has('one', 'other')), 'other', 'Vietnamese has no singular form')

assert.deepEqual(placeholders('{b} {a} {b}'), ['a', 'b'])
assert.deepEqual(placeholderMismatches({ a: '{n} x', b: 'y' }, { a: '{count} x', b: 'z' }), ['a'])

assert.match(langCookie('vi'), /^vibedoc-lang=vi; path=\/;/)

// Dates and numbers (T216)
const now = Date.parse('2026-10-06T12:00:00Z')
const min = 60_000
assert.equal(timeAgo('en', now - 20_000, now), 'just now')
assert.equal(timeAgo('en', now - 5 * min, now), '5m ago', 'English keeps its compact format')
assert.equal(timeAgo('en', now - 3 * 60 * min, now), '3h ago')
assert.equal(timeAgo('en', now - 2 * 1440 * min, now), '2d ago')
assert.equal(timeAgo('vi', now - 20_000, now), 'vừa xong')
assert.equal(timeAgo('vi', now - 5 * min, now), '5 phút trước')
assert.equal(timeAgo('vi', now - 2 * 1440 * min, now), '2 ngày trước', 'numeric, never "hôm kia"')
assert.equal(agoShort('en', now - 3 * 60 * min, now), '3h')
assert.equal(agoShort('en', now, now), 'now')
assert.equal(agoShort('vi', now - 3 * 60 * min, now), '3 giờ')
assert.equal(monthName('en', 10), 'Oct')
assert.equal(monthName('vi', 10), 'thg 10')
assert.equal(formatDay('en', '2026-10-15'), '15 Oct')
assert.equal(formatDay('vi', '2026-10-15'), '15 thg 10')
assert.equal(formatDay('vi', '2026-01-01'), '1 thg 1', 'a calendar date never shifts a day')
assert.equal(formatNumber('vi', 12345.6), '12.345,6')
assert.equal(formatDate('vi', now, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }), '6 thg 10, 2026')
assert.equal(formatDate('en', now, { month: 'short', day: 'numeric', timeZone: 'UTC' }, 'en-US'), 'Oct 6', 'English keeps the locale a call named')
assert.equal(dayHeading('en', now, now), 'Today')
assert.equal(dayHeading('vi', now, now), 'Hôm nay')
assert.equal(dayHeading('vi', now - 1440 * min, now), 'Hôm qua')
assert.match(dayHeading('vi', now - 5 * 1440 * min, now), /thg 10/)

// Every area: same keys, same {placeholders}, a _one/_other pair complete, nothing left empty
const dir = new URL('../i18n/', import.meta.url)
const areas = readdirSync(dir).filter((f) => f.endsWith('.ts') && f !== 'index.ts')
assert.ok(areas.includes('shell.ts'))
for (const file of areas) {
  const { en, vi } = await import(new URL(file, dir).href) as { en: Record<string, string>; vi: Record<string, string> }
  assert.deepEqual(Object.keys(vi).sort(), Object.keys(en).sort(), `${file}: vi has the same keys as en`)
  assert.deepEqual(placeholderMismatches(en, vi), [], `${file}: placeholders match`)
  for (const k of Object.keys(en)) {
    assert.ok(en[k].trim() && vi[k].trim(), `${file}: ${k} is not empty`)
    if (k.endsWith('_one')) assert.ok(`${k.slice(0, -4)}_other` in en, `${file}: ${k} has an _other`)
  }
}

console.log(`i18n.check: ok (${areas.length} area${areas.length === 1 ? '' : 's'})`)
