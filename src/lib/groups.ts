/**
 * Project groups (R102): repos that make one product. Membership lives only in each member repo's
 * `.vibedoc/settings.json` (`groups: ["shop"]`, `groupNames: {"shop": "Shop"}`); the hub forms a group by
 * matching slugs across the projects it knows. Pure: no fs.
 */

export interface GroupMember { id: string; name: string; root: string }
export interface ProjectGroup { slug: string; name: string; members: GroupMember[] }

/** One hub project with its settings' raw `groups` / `groupNames` and the settings file's mtime (ms, 0 = none). */
export interface ProjectSettingsGroups extends GroupMember { groups: unknown; groupNames: unknown; mtime: number }

/** "Shop App!" → "shop-app"; "" when nothing url-safe is left. */
export const groupSlug = (name: string): string =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

/** A settings `groups` value → its valid slugs, deduped, in order. Junk is dropped, never thrown. */
export function slugsOf(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return [...new Set(raw.filter((s): s is string => typeof s === 'string' && s !== '' && groupSlug(s) === s))]
}

/** A settings `groupNames` value → only string names. */
export function namesOf(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  return Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v === 'string' && v.trim()) as [string, string][])
}

/** Every group the given projects form, sorted by name; a group's name = the newest settings file's (mtime) that names it, else the slug. */
export function groupsOf(projects: ProjectSettingsGroups[]): ProjectGroup[] {
  const groups = new Map<string, ProjectGroup & { at: number }>()
  for (const p of projects) {
    const names = namesOf(p.groupNames)
    for (const slug of slugsOf(p.groups)) {
      const g = groups.get(slug) ?? { slug, name: slug, members: [], at: -1 }
      g.members.push({ id: p.id, name: p.name, root: p.root })
      if (names[slug] && p.mtime > g.at) { g.name = names[slug].trim(); g.at = p.mtime }
      groups.set(slug, g)
    }
  }
  return [...groups.values()].map(({ at: _at, ...g }) => g).sort((a, b) => a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug))
}

/**
 * A settings object with `slug` joined (name given → `groupNames[slug]` set) or left (`name` ignored, its name
 * dropped). Every other key is kept; empty `groups` / `groupNames` are removed so a repo that leaves carries nothing.
 */
export function withMembership(settings: Record<string, unknown>, slug: string, member: boolean, name?: string): Record<string, unknown> {
  const next = { ...settings }
  const slugs = slugsOf(settings.groups).filter(s => s !== slug)
  const names = namesOf(settings.groupNames)
  delete names[slug]
  if (member) {
    slugs.push(slug)
    if (name?.trim()) names[slug] = name.trim()
  }
  if (slugs.length) next.groups = slugs
  else delete next.groups
  if (Object.keys(names).length) next.groupNames = names
  else delete next.groupNames
  return next
}
