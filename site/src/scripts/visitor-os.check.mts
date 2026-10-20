// Self-check for visitorOs (R112 T586). Run: node site/src/scripts/visitor-os.check.mts
import assert from 'node:assert/strict'
import { visitorOs } from './visitor-os.ts'

assert.equal(visitorOs({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/141 Safari/537.36' }), 'mac')
assert.equal(visitorOs({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141' }), 'windows')
assert.equal(visitorOs({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/141' }), 'linux')
assert.equal(visitorOs({ userAgent: 'x', userAgentData: { platform: 'macOS', mobile: false } }), 'mac')
assert.equal(visitorOs({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148' }), null, 'an iPhone says Mac OS X')
assert.equal(visitorOs({ userAgent: 'Mozilla/5.0 (Linux; Android 15) Mobile' }), null)
assert.equal(visitorOs({ userAgent: '' }), null)
console.log('visitor-os.check: ok')
