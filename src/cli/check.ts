// `vibedoc check [--json] [--root <dir>]` (R090): R088's doc lint for CI, no server. Bundled by esbuild into
// dist/cli/check.mjs (`pnpm build:cli`); bin/vibedoc.mjs imports it. It lives outside the Next app, so it reads the
// .md files itself (CLAUDE.md's "fs only in core.ts" is about the app; core can't be bundled here). Same file set and
// graph as core's `readMarkdownFiles` / `getDocGraph`, same assembly via `lintProject`.
// Exit codes: 0 = no error-level issue, 1 = errors found, 2 = bad arguments or unreadable root.

import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { glob } from 'glob'
import { buildDocGraph, docNode, extractLinks } from '../lib/doc-links'
import { formatLint } from '../lib/doc-lint'
import { lintProject } from '../lib/doc-lint-project'

const USAGE = 'Usage: vibedoc check [--json] [--root <dir>]\n  Lints every .md file (broken links, frontmatter, specs, …). Exit 1 on any error.'

function parseArgs(argv: string[]): { json: boolean; root: string } | string {
  let json = false
  let root = process.cwd()
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--json') json = true
    else if (a === '--root') {
      const v = argv[++i]
      if (!v) return '--root needs a directory'
      root = path.resolve(v)
    } else if (a.startsWith('--root=')) root = path.resolve(a.slice('--root='.length))
    else return `unknown argument: ${a}`
  }
  return { json, root }
}

async function run(argv: string[]): Promise<number> {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(USAGE)
    return 0
  }
  const args = parseArgs(argv)
  if (typeof args === 'string') {
    console.error(`✗ ${args}\n${USAGE}`)
    return 2
  }
  const { json, root } = args
  if (!(await stat(root).then(s => s.isDirectory(), () => false))) {
    console.error(`✗ not a directory: ${root}`)
    return 2
  }
  const paths = (await glob('**/*.md', { cwd: root, ignore: ['node_modules/**', '.git/**', '.next/**'], nodir: true }))
    .map(f => f.replace(/\\/g, '/')).sort()
  const files = await Promise.all(paths.map(async f => ({ path: f, raw: await readFile(path.join(root, f), 'utf8') })))
  const hidden = (await glob('.*/**/*.md', { cwd: root, dot: true, ignore: ['.git/**', '.next/**', '**/node_modules/**'], nodir: true }))
    .map(f => f.replace(/\\/g, '/'))
  const graph = buildDocGraph(files.map(f => ({ node: docNode(f.path, f.raw), links: extractLinks(f.raw, f.path) })), hidden)
  const lint = lintProject(files, graph)
  console.log(json ? JSON.stringify(lint, null, 2) : formatLint(lint, Infinity))
  return lint.errors ? 1 : 0
}

/** bin/vibedoc.mjs passes everything after `check` and sets the exit code from the result. */
export default run
