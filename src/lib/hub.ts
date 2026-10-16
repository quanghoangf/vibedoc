/**
 * The projects hub (R099): the per-user list of projects one VibeDoc manages, `<home>/hub.json`.
 * Pure: no fs. Roots are absolute and already resolved by the caller (core's `path.resolve`).
 */

export interface HubProject {
  id: string
  root: string
  name: string
  pinned: boolean
  archived: boolean
  /** ISO time the project was last opened in VibeDoc, null = never */
  lastOpened: string | null
}

export interface Hub {
  version: 1
  projects: HubProject[]
}

export type HubPatch = Partial<Pick<HubProject, 'name' | 'pinned' | 'archived' | 'lastOpened' | 'root'>>

export const emptyHub = (): Hub => ({ version: 1, projects: [] })

/** `/a/b/` → `/a/b`, so one folder is one entry however it was typed. */
export const normalizeRoot = (root: string): string => root.length > 1 ? root.replace(/\/+$/, '') || '/' : root

const baseName = (root: string): string => normalizeRoot(root).split('/').pop() || root

/** Folder name → url-safe id; `web`, then `web-2`, `web-3` when taken. */
export function allocateId(root: string, taken: Iterable<string>): string {
  const base = baseName(root).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'project'
  const used = new Set(taken)
  if (!used.has(base)) return base
  let n = 2
  while (used.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

/** hub.json text → Hub. Bad JSON or bad rows are dropped, never thrown: a broken file must not take the app down. */
export function parseHub(text: string | null | undefined): Hub {
  let raw: unknown
  try { raw = JSON.parse(text ?? '') } catch { return emptyHub() }
  const rows = (raw as { projects?: unknown })?.projects
  if (!Array.isArray(rows)) return emptyHub()
  const hub = emptyHub()
  for (const r of rows as Record<string, unknown>[]) {
    if (!r || typeof r.root !== 'string' || !r.root.startsWith('/')) continue
    const root = normalizeRoot(r.root)
    if (hub.projects.some(p => p.root === root)) continue
    const ids = hub.projects.map(p => p.id)
    const id = typeof r.id === 'string' && r.id && !ids.includes(r.id) ? r.id : allocateId(root, ids)
    hub.projects.push({
      id,
      root,
      name: typeof r.name === 'string' && r.name.trim() ? r.name : baseName(root),
      pinned: r.pinned === true,
      archived: r.archived === true,
      lastOpened: typeof r.lastOpened === 'string' ? r.lastOpened : null,
    })
  }
  return hub
}

/** Adds `root` unless it's already there (same root = same project). `added` false = the existing entry. */
export function addProject(hub: Hub, root: string, now: string | null = null): { hub: Hub; project: HubProject; added: boolean } {
  const r = normalizeRoot(root)
  const existing = hub.projects.find(p => p.root === r)
  if (existing) return { hub, project: existing, added: false }
  const project: HubProject = { id: allocateId(r, hub.projects.map(p => p.id)), root: r, name: baseName(r), pinned: false, archived: false, lastOpened: now }
  return { hub: { ...hub, projects: [...hub.projects, project] }, project, added: true }
}

export function removeProject(hub: Hub, id: string): { hub: Hub; removed: HubProject | null } {
  const removed = hub.projects.find(p => p.id === id) ?? null
  return { hub: removed ? { ...hub, projects: hub.projects.filter(p => p !== removed) } : hub, removed }
}

/** Puts a removed entry back as it was (Undo); null when its id or root is taken meanwhile. */
export function restoreProject(hub: Hub, entry: unknown): Hub | null {
  const [p] = parseHub(JSON.stringify({ projects: [entry] })).projects
  if (!p || typeof (entry as { id?: unknown })?.id !== 'string' || p.id !== (entry as { id: string }).id) return null
  if (hub.projects.some(x => x.id === p.id || x.root === p.root)) return null
  return { ...hub, projects: [...hub.projects, p] }
}

/** Points a project at its folder's new place (Locate, T532); the id stays, so links and its last page survive. */
export function relocateProject(hub: Hub, id: string, root: string): { hub: Hub } | { error: 'unknown' | 'taken' } {
  const r = normalizeRoot(root)
  if (!hub.projects.some(p => p.id === id)) return { error: 'unknown' }
  if (hub.projects.some(p => p.root === r && p.id !== id)) return { error: 'taken' }
  return { hub: patchProject(hub, id, { root: r }) as Hub }
}

/** Changes the given fields of one project; null = unknown id. The id never changes. */
export function patchProject(hub: Hub, id: string, patch: HubPatch): Hub | null {
  if (!hub.projects.some(p => p.id === id)) return null
  const clean: HubPatch = { ...patch }
  if (clean.root !== undefined) clean.root = normalizeRoot(clean.root)
  if (clean.name !== undefined && !clean.name.trim()) delete clean.name
  return { ...hub, projects: hub.projects.map(p => p.id === id ? { ...p, ...clean } : p) }
}

/** The project with this id, or whose root this is. */
export function projectFor(hub: Hub, key: string): HubProject | null {
  const r = normalizeRoot(key)
  return hub.projects.find(p => p.id === key) ?? hub.projects.find(p => p.root === r) ?? null
}

/** Display order of `/api/projects`: the configured root first, archived last, else hub order. */
export function orderProjects<T extends { root: string; archived: boolean }>(list: T[], configuredRoot: string): T[] {
  const c = normalizeRoot(configuredRoot)
  const rank = (p: T) => p.root === c ? 0 : p.archived ? 2 : 1
  return list.map((p, i) => ({ p, i })).sort((a, b) => rank(a.p) - rank(b.p) || a.i - b.i).map(x => x.p)
}

/** The switcher's list (R099): archived hidden, pinned first, then the most recently opened, then hub order. */
export function switcherOrder<T extends { pinned: boolean; archived: boolean; lastOpened: string | null }>(list: T[]): T[] {
  return list.map((p, i) => ({ p, i })).filter(x => !x.p.archived)
    .sort((a, b) => Number(b.p.pinned) - Number(a.p.pinned) || (b.p.lastOpened ?? '').localeCompare(a.p.lastOpened ?? '') || a.i - b.i)
    .map(x => x.p)
}

// ─── Import (R101) ────────────────────────────────────────────────────────────

/** `~` / `~/x` → under `home`; anything else as typed (trimmed). */
export const expandHome = (p: string, home: string): string => {
  const t = p.trim()
  return t === '~' ? home : t.startsWith('~/') ? `${home}${t.slice(1)}` : t
}

/** A folder a scan looks into: never node_modules or a dot folder. */
export const isScannable = (name: string): boolean => name !== 'node_modules' && !name.startsWith('.')

export const MAX_SCAN_RESULTS = 200

export interface ScannedRepo { root: string; name: string; inHub: boolean }

/** Repo roots a scan found → the dialog's list: sorted by path, deduped, marked when already in the hub, capped. */
export function scanResults(found: string[], hubRoots: Iterable<string>, cap = MAX_SCAN_RESULTS): ScannedRepo[] {
  const known = new Set([...hubRoots].map(normalizeRoot))
  return [...new Set(found.map(normalizeRoot))].sort().slice(0, cap)
    .map(root => ({ root, name: baseName(root), inHub: known.has(root) }))
}
