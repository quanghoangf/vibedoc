// node src/lib/mermaid-theme.check.mts
import assert from 'node:assert/strict'
import { toHex, mermaidThemeVariables } from './mermaid-theme.ts'

assert.equal(toHex('124 106 247', '#000000'), '#7c6af7')
assert.equal(toHex(' 10, 10, 15 ', '#000000'), '#0a0a0f')
assert.equal(toHex('#ABCDEF', '#000000'), '#abcdef')
for (const bad of [undefined, '', '1 2', '300 0 0', 'rgb(1 2 3)', '1.5 2 3']) assert.equal(toHex(bad, '#123456'), '#123456')

const light = mermaidThemeVariables({ bg: '255 255 255', surface: '248 248 252', border2: '208 208 228', txt: '26 26 46', muted: '107 107 128', fontSans: 'var-resolved Sans' }, false)
assert.equal(light.darkMode, false)
assert.equal(light.primaryColor, '#f8f8fc')
assert.equal(light.primaryBorderColor, '#d0d0e4')
assert.equal(light.nodeBorder, '#d0d0e4')
assert.equal(light.actorBorder, '#d0d0e4')
assert.equal(light.primaryTextColor, '#1a1a2e')
assert.equal(light.lineColor, '#6b6b80')
assert.equal(light.edgeLabelBackground, '#ffffff')
assert.equal(light.fontFamily, 'var-resolved Sans, system-ui, sans-serif')
assert.equal(light.fontSize, '14px')
assert.equal(light.dropShadow, 'none')

// missing tokens fall back to the theme's own defaults, never to Mermaid's
const dark = mermaidThemeVariables({}, true)
assert.equal(dark.darkMode, true)
assert.equal(dark.primaryColor, '#111118')
assert.equal(dark.primaryBorderColor, '#2d2d3d')
assert.equal(dark.fontFamily, 'system-ui, sans-serif')
// every colour is hex: khroma can't derive shades from triplets
for (const [k, v] of Object.entries(dark)) if (typeof v === 'string' && !['fontFamily', 'fontSize', 'dropShadow'].includes(k)) assert.match(v, /^#[0-9a-f]{6}$/, k)

console.log('mermaid-theme: ok')
