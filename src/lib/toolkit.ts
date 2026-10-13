/**
 * src/lib/toolkit.ts (R098)
 * Agent toolkit setup: which catalog plugins fit the open project, best fit first, and which Claude Code has.
 * Pure: no fs, no React. Core gathers the project facts (getToolkitFacts), the route merges `claude plugin list`.
 */

export const TOOLKIT_SIGNALS = ['web-frontend', 'git', 'server', 'lsp-ts', 'lsp-py', 'lsp-go'] as const
export type ToolkitSignal = (typeof TOOLKIT_SIGNALS)[number]

export interface ToolkitItem {
  id: string
  title: string
  /** plugin name inside its marketplace */
  plugin: string
  marketplace: { name: string; repo: string }
  reason: { en: string; vi: string }
  /** an item with signals shows only when one matches; [] = fits any codebase */
  fit: ToolkitSignal[]
  /** tie-break inside a group */
  order: number
}

export interface RankedToolkitItem extends ToolkitItem {
  /** the signal that put it first; absent on always-fit items */
  matched?: ToolkitSignal
}

/** What core reads from the project: top-level entries (dirs too), a few deep paths, and package.json dependencies. */
export interface ProjectFacts {
  frontend: boolean
  paths: string[]
  deps: string[]
}

const SERVER_DIRS = ['src/app/api', 'server', 'api']
const SERVER_DEPS = ['express', 'fastify', 'hono', 'koa']

export function signalsFrom(facts: ProjectFacts): Set<ToolkitSignal> {
  const has = (p: string) => facts.paths.includes(p)
  const out = new Set<ToolkitSignal>()
  if (facts.frontend) out.add('web-frontend')
  if (has('.git')) out.add('git')
  if (SERVER_DIRS.some(has) || SERVER_DEPS.some(d => facts.deps.includes(d))) out.add('server')
  if (has('tsconfig.json')) out.add('lsp-ts')
  if (has('pyproject.toml') || has('requirements.txt')) out.add('lsp-py')
  if (has('go.mod')) out.add('lsp-go')
  return out
}

/** Matched items first, then always-fit items, each group by `order`; items whose signals didn't match are left out. */
export function rankToolkit(catalog: ToolkitItem[], signals: Set<ToolkitSignal>): RankedToolkitItem[] {
  const matched: RankedToolkitItem[] = []
  const always: RankedToolkitItem[] = []
  for (const item of catalog) {
    if (item.fit.length === 0) { always.push(item); continue }
    const hit = item.fit.find(s => signals.has(s))
    if (hit) matched.push({ ...item, matched: hit })
  }
  const byOrder = (a: ToolkitItem, b: ToolkitItem) => a.order - b.order
  return [...matched.sort(byOrder), ...always.sort(byOrder)]
}

export const pluginId = (item: ToolkitItem) => `${item.plugin}@${item.marketplace.name}`

/** The exact commands for the copy fallback. */
export function installCommands(item: ToolkitItem): string[] {
  return [`claude plugin marketplace add ${item.marketplace.repo}`, `claude plugin install ${pluginId(item)}`]
}

/** The catalog items for a POSTed `ids` list, in catalog order; null when it isn't a non-empty list of known ids. */
export function pickItems(catalog: ToolkitItem[], ids: unknown): ToolkitItem[] | null {
  if (!Array.isArray(ids) || ids.length === 0 || ids.some(id => typeof id !== 'string')) return null
  if (ids.some(id => !catalog.some(i => i.id === id))) return null
  return catalog.filter(i => ids.includes(i.id))
}
