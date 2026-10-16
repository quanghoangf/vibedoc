// Which .md files VibeDoc looks at. Pure: core.ts and the `vibedoc check` CLI list the files (git or glob) and pass
// the paths in. Dependency folders are never listed. Build folders are pruned by the glob fallback, and in a git work
// tree git's ignore rules leave them out. One Rust `target/` (200k files) made every scan take 7 s and stalled every
// other request behind it.

/** Dependency folders, at any depth: always skipped, even when git tracks them (a vendored Go module). */
export const DEPENDENCY_DIRS: readonly string[] = [
  '.git', 'node_modules', 'bower_components', 'jspm_packages', 'vendor', 'Pods', 'venv', '.venv', '__pycache__',
]

/**
 * Build output and caches, at any depth: the glob fallback never walks them. In a git work tree git's ignore rules
 * decide instead, so a tracked `build/` folder of hand-written docs still shows.
 */
export const BUILD_DIRS: readonly string[] = [
  'target', 'dist', 'build', 'out', 'coverage', '.next', '.nuxt', '.svelte-kit', '.turbo', '.cache', '.parcel-cache',
  '.output', '.vercel', '.serverless', '.terraform', '.gradle', '.dart_tool', 'elm-stuff', 'DerivedData',
  '.pytest_cache', '.mypy_cache', '.tox',
]

export const SKIP_DIRS: readonly string[] = [...DEPENDENCY_DIRS, ...BUILD_DIRS]

/** glob `ignore` for SKIP_DIRS; the trailing `/**` makes glob prune the folder instead of walking it. */
export const SKIP_IGNORE: string[] = [`**/{${SKIP_DIRS.join(',')}}/**`]

/** True when any folder on the path is one of `dirs`. */
export function isSkippedPath(p: string, dirs: readonly string[] = SKIP_DIRS): boolean {
  return p.split('/').slice(0, -1).some((s) => dirs.includes(s))
}

/** True when any folder on the path starts with a dot (`.claude/skills/x.md`): such files are known, but not docs. */
export function isHiddenPath(p: string): boolean {
  return p.split('/').slice(0, -1).some((s) => s.startsWith('.'))
}

/**
 * VibeDoc's own folders, read up front with the root-level .md files: the doc list, the graph, lint, llms.txt and the
 * memory graph see only these. Every other top-level folder is lazy: listed by name, its files read when someone opens
 * it (the docs list, `vibedoc_list_docs { dir }`) or asks (search, a loose doc name).
 */
export const EAGER_DIRS: readonly string[] = ['docs', 'plans', 'memory']

/** True for a root-level file or a path under one of EAGER_DIRS. */
export function isEagerPath(p: string): boolean {
  const slash = p.indexOf('/')
  return slash === -1 || EAGER_DIRS.includes(p.slice(0, slash))
}

/** A folder `?dir=` may load: one top-level name outside EAGER_DIRS, not a dot folder, not a dependency folder. */
export function isLazyDir(dir: string): boolean {
  return /^[^/\\]+$/.test(dir) && !dir.startsWith('.') && !EAGER_DIRS.includes(dir) && !DEPENDENCY_DIRS.includes(dir)
}

/** A lazy folder: its name, how many .md files it holds, and whether any is a project doc (not licence/changelog). */
export type LazyFolder = { name: string; count: number; hasDocs: boolean }

/**
 * The lazy folders among listed doc paths, by name. `isProjectDocs` is first-screen's `hasProjectDocs`, passed in
 * because pure libs never import each other.
 */
export function lazyFolders(docs: readonly string[], isProjectDocs: (paths: string[]) => boolean): LazyFolder[] {
  const byDir = new Map<string, string[]>()
  for (const p of docs) {
    if (isEagerPath(p)) continue
    const dir = p.slice(0, p.indexOf('/'))
    byDir.set(dir, [...(byDir.get(dir) ?? []), p])
  }
  return [...byDir].sort(([a], [b]) => a.localeCompare(b))
    .map(([name, paths]) => ({ name, count: paths.length, hasDocs: isProjectDocs(paths) }))
}

export type MarkdownPaths = { docs: string[]; hidden: string[] }

/**
 * Listed paths → sorted, unique POSIX `.md` paths, minus the `skip` folders; dot-folder files go to `hidden`.
 * git listings pass DEPENDENCY_DIRS (git already left out what it ignores), glob listings keep SKIP_DIRS.
 */
export function splitMarkdown(paths: readonly string[], skip: readonly string[] = SKIP_DIRS): MarkdownPaths {
  const docs = new Set<string>()
  const hidden = new Set<string>()
  for (const raw of paths) {
    const p = raw.replace(/\\/g, '/').replace(/^\.\//, '')
    if (!/\.md$/i.test(p) || isSkippedPath(p, skip)) continue
    ;(isHiddenPath(p) ? hidden : docs).add(p)
  }
  return { docs: [...docs].sort(), hidden: [...hidden].sort() }
}

/** `git ls-files -z` output → paths, minus the ones `git ls-files -z -d` lists (deleted with rm, still in the index). */
export function parseGitPaths(listed: string, deleted = ''): string[] {
  const gone = new Set(deleted.split('\0').filter(Boolean))
  return listed.split('\0').filter((p) => p && !gone.has(p))
}

/**
 * The doc a loose name points at, as readDoc's old glob fallback found it: `**\/<q>.md`, then `**\/<q>*.md`, then
 * `**\/*<q>*.md`, case-insensitive (a `*` never crosses a `/`). Ties → the shallowest path, then alphabetical.
 */
export function fuzzyDocMatch(paths: readonly string[], query: string): string | null {
  const q = query.toLowerCase()
  if (!q) return null
  const sorted = [...paths].sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b))
  const rests = (p: string, atBoundary: boolean) => {
    const out: string[] = []
    for (let i = p.indexOf(q); i !== -1; i = p.indexOf(q, i + 1)) {
      if (!atBoundary || i === 0 || p[i - 1] === '/') out.push(p.slice(i + q.length))
    }
    return out
  }
  const tests: ((p: string) => boolean)[] = [
    (p) => rests(p, true).includes('.md'),
    (p) => rests(p, true).some((r) => r.endsWith('.md') && !r.includes('/')),
    (p) => rests(p, false).some((r) => r.endsWith('.md') && !r.includes('/')),
  ]
  for (const test of tests) {
    const hit = sorted.find((p) => test(p.toLowerCase()))
    if (hit) return hit
  }
  return null
}
