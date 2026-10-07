// Pure doc upkeep (R092, no fs, no git). Self-check: node src/lib/doc-upkeep.check.mts
// "May be outdated" is derived on read, never stored: a done task's commits renamed or deleted a file, and a doc
// still names the old path. Core runs one `git log -M --name-status` and feeds it here; the result becomes the
// `outdated-ref` lint rule (doc-lint.ts), so vibedoc_check_docs, /api/docs/lint and the /docs panel all show it.

/** `git log -M --name-status --format=%x1e%H%x1f%s` — the format `parseNameStatusLog` reads. */
export const NAME_STATUS_LOG_ARGS = ['log', '-M', '--name-status', '--format=%x1e%H%x1f%s']

export type PathChange = { status: 'R' | 'D'; from: string; to?: string }
export type LogCommit = { sha: string; subject: string; changes: PathChange[] }
/** A doc naming a path a done task renamed (`to`) or deleted (no `to`). `line` is 1-based, the first mention. */
export type OutdatedRef = { path: string; line: number; taskId: string; from: string; to?: string }

/** Commits newest first, with only their renames and deletes (adds and edits are dropped). */
export function parseNameStatusLog(stdout: string): LogCommit[] {
  const out: LogCommit[] = []
  for (const rec of stdout.split('\x1e')) {
    const [head, ...rest] = rec.split('\n')
    const sep = head.indexOf('\x1f')
    if (sep < 0) continue
    const changes: PathChange[] = []
    for (const l of rest) {
      const [st, a, b] = l.split('\t')
      if (/^R\d*$/.test(st ?? '') && a && b) changes.push({ status: 'R', from: a, to: b })
      else if (st === 'D' && a) changes.push({ status: 'D', from: a })
    }
    out.push({ sha: head.slice(0, sep), subject: head.slice(sep + 1), changes })
  }
  return out
}

const TASK_ID_RE = /\bT\d{3,}\b/g
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Which docs name a path a done task renamed or deleted. `commits` newest first (`parseNameStatusLog`); a commit
 * counts when its subject names a task in `doneTaskIds`. The newest change per old path wins, and a rename is
 * followed through later renames (a → b, then b → c reports a → c). Paths that `exists` again are skipped.
 * A mention is the full relative path as text, not part of a longer path (`src/a.tsx` is not `src/a.ts`).
 * ponytail: full paths only; a doc that says `a.ts` alone isn't caught.
 */
export function outdatedRefs(input: {
  docs: readonly { path: string; raw: string }[]
  commits: readonly LogCommit[]
  doneTaskIds: ReadonlySet<string>
  exists: (path: string) => boolean
}): OutdatedRef[] {
  const moved = new Map<string, { taskId: string; to?: string }>()
  // where each path ended up, over every commit (done task or not); null = deleted
  const finalOf = new Map<string, string | null>()
  for (const c of input.commits) {
    const taskId = (c.subject.match(TASK_ID_RE) ?? []).find(id => input.doneTaskIds.has(id))
    for (const ch of c.changes) {
      // older commits come later: a newer change of `to` is already resolved
      const to = ch.to ? (finalOf.has(ch.to) ? finalOf.get(ch.to) ?? null : ch.to) : null
      if (!finalOf.has(ch.from)) finalOf.set(ch.from, to)
      if (taskId && !moved.has(ch.from)) moved.set(ch.from, to ? { taskId, to } : { taskId })
    }
  }
  const stale = [...moved].filter(([from]) => !input.exists(from))
  const out: OutdatedRef[] = []
  for (const d of input.docs) {
    const lines = d.raw.split('\n')
    for (const [from, m] of stale) {
      if (!d.raw.includes(from)) continue
      const re = new RegExp(`(?<![\\w./-])${esc(from)}(?![\\w/-]|\\.\\w)`)
      const i = lines.findIndex(l => re.test(l))
      if (i >= 0) out.push({ path: d.path, line: i + 1, taskId: m.taskId, from, ...(m.to && { to: m.to }) })
    }
  }
  return out.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line)
}

/** The lint issue fields `fixDocsPrompt` reads (a `LintIssue` from doc-lint.ts fits). */
export type PromptIssue = { line: number; level: string; rule: string; message: string; target?: string; task?: string; renamedTo?: string }

/**
 * R092 Fix docs: the chat prompt for one doc. Names the doc, each done task with its old → new paths, the doc's
 * other docs check issues, and how to fix (propose, never write). Agent prompts stay English (R078).
 */
export function fixDocsPrompt(path: string, issues: readonly PromptIssue[]): string {
  const refs = issues.filter(i => i.rule === 'outdated-ref')
  const other = issues.filter(i => i.rule !== 'outdated-ref')
  const tasks = [...new Set(refs.map(r => r.task).filter(Boolean))]
  const out = [`Fix docs: ${path} may be outdated. Done tasks renamed or deleted files it names:`]
  for (const r of refs) out.push(`- L${r.line}: ${r.task} ${r.renamedTo ? `renamed \`${r.target}\` → \`${r.renamedTo}\`` : `deleted \`${r.target}\``}`)
  if (other.length) {
    out.push('', 'Other docs check issues in this doc:')
    for (const i of other) out.push(`- L${i.line} ${i.level} ${i.rule}: ${i.message}`)
  }
  out.push('',
    `Read the doc with vibedoc_read_doc${tasks.length ? ` and ${tasks.join(', ')} with vibedoc_get_task (vibedoc_verify_context has the diff)` : ''}. ` +
    'Then propose the corrections with vibedoc_propose_edit, never write the doc directly: point each old path to its new one, ' +
    'reword or drop mentions of deleted files, and fix the other issues if you can. ' +
    `Afterwards run vibedoc_check_docs with path "${path}".`)
  return out.join('\n')
}
