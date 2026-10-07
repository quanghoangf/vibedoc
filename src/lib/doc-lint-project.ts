// Project-level doc lint (R088, shared with R090's `vibedoc check`): capability specs + unmerged epics' spec changes
// + `lintDocs` over every .md, no fs. Core's `getDocLint` and the CLI bundle (`src/cli/check.ts`) both call it, so CI
// reports exactly what the app shows. Imports values from other libs, so no `.check.mts` may import it directly.

import { lintDocs, summarizeLint, type DocLint, type LintFile, type LintOutdated, type LintSpecChange } from './doc-lint'
import type { DocGraph } from './doc-links'
import { applyDelta, isSpecPath, parseSpec, parseSpecChanges } from './specs'

const specSlug = (p: string) => p.replace(/^docs\/specs\//, '').replace(/\.md$/, '')

/** Every issue in `files` (or only `file`'s, a root-relative path), totals over the checked files. `outdated` (R092) needs git, so core passes it; the CLI doesn't. */
export function lintProject(files: LintFile[], graph: DocGraph, file?: string, outdated: readonly LintOutdated[] = []): DocLint {
  const one = file?.replace(/\\/g, '/').replace(/^\.?\//, '')
  const specs = files.filter(f => isSpecPath(f.path)).map(f => ({ path: f.path, spec: parseSpec(f.path, f.raw) }))
  const specRaw = new Map(files.filter(f => isSpecPath(f.path)).map(f => [specSlug(f.path), f.raw]))
  const specChanges: LintSpecChange[] = []
  for (const f of files) {
    if (!/^plans\/roadmap\/R\d+[^/]*\.md$/.test(f.path) || /^\*\*Spec merged:\*\*/m.test(f.raw)) continue
    for (const c of parseSpecChanges(f.raw)) {
      if (!/^[a-z0-9][a-z0-9._-]*$/.test(c.capability)) {
        specChanges.push({ path: f.path, capability: c.capability, op: '', name: '', message: 'not a capability slug (docs/specs/<slug>.md)' })
        continue
      }
      // op by op, so each error points at its own heading; same result as previewSpecMerge's one applyDelta call
      let raw = specRaw.get(c.capability) ?? null
      for (const op of c.ops) {
        const res = applyDelta(raw, [op], c.capability)
        raw = res.raw
        for (const message of res.errors) specChanges.push({ path: f.path, capability: c.capability, op: op.op, name: op.name, message })
      }
    }
  }
  return summarizeLint(lintDocs(files, graph, { path: one, specs, specChanges, outdated }), one ? files.filter(f => f.path === one).length : files.length)
}
