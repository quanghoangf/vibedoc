// Self-check for docStats. Run: node src/lib/headings.check.mts
import assert from 'node:assert/strict'
import { docStats, extractHeadings } from './headings.ts'

const doc = '# The **Plan**\n\nOne two three.\n\n## A\nfour\n```md\n## not a section\n```\n## B\n'
assert.deepEqual(docStats(doc), { title: 'The Plan', words: 8, sections: 2, minutes: 1 })
// Title only when the H1 opens the doc (matches the preview's h1:first-child hiding)
assert.equal(docStats('<!-- c -->\n# Late').title, null)
assert.equal(docStats('\n\n# Lead\n').title, 'Lead')
assert.equal(docStats('## Only h2').title, null)
// Links keep their label (changelog headings), and the outline anchor matches marked's id
assert.equal(docStats('# [1.7.0](https://x.dev/compare/a...b) (2026-09-29)\n').title, '1.7.0 (2026-09-29)')
assert.deepEqual(extractHeadings('## [1.6.1](https://x.dev) (2026-09-29)'), [{ level: 2, text: '1.6.1 (2026-09-29)', anchor: '161-2026-09-29' }])
assert.equal(extractHeadings('### `src/lib/core.ts`')[0].anchor, 'srclibcorets')
console.log('headings ok')
