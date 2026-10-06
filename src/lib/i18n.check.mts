// Self-check for UI languages (R078). Run: node src/lib/i18n.check.mts
import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { interpolate, langCookie, parseLang, placeholderMismatches, placeholders, pluralSuffix } from './i18n.ts'

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
