// R091: release notes from done work. Pure: which done tasks are new since the last tag, the `# Unreleased`
// section they make, and the old_string→new_string edit that puts it at the top of CHANGELOG.md.
// No fs, no git, no imports of values (run by `node release-notes.check.mts` without a bundler).
import type { TextEdit } from "./diff"

export type NoteTask = { id: string; title: string; status: string; finished: string | null }
export type NoteEpic = { id: string; title: string; status: string; tasks: string[] }
export type NoteGroup = { epic: { id: string; title: string; done: boolean } | null; tasks: { id: string; title: string }[] }

const UNRELEASED_RE = /^# Unreleased\b/

/** The top `# Unreleased` section as [start, end) offsets, or null when the first level-1 heading is something else. */
function unreleasedRange(changelog: string): [number, number] | null {
  const re = /^# .*$/gm
  const first = re.exec(changelog)
  if (!first || !UNRELEASED_RE.test(first[0])) return null
  const next = re.exec(changelog)
  return [first.index, next ? next.index : changelog.length]
}

/**
 * Done tasks finished on/after `since` (YYYY-MM-DD, string compare; null = no tag, every dated done task) whose id
 * the changelog doesn't name yet (ignoring a top `# Unreleased` section, which a new draft replaces), grouped by
 * epic in the given order, loose tasks last.
 */
export function collectReleaseNotes(input: { tasks: NoteTask[]; epics: NoteEpic[]; since: string | null; changelog: string }): NoteGroup[] {
  const range = unreleasedRange(input.changelog)
  const released = range ? input.changelog.slice(0, range[0]) + input.changelog.slice(range[1]) : input.changelog
  const named = new Set(released.match(/\bT\d+\b/g) ?? [])
  const fresh = input.tasks.filter(
    (t) => t.status === "done" && t.finished !== null && (input.since === null || t.finished >= input.since) && !named.has(t.id),
  )
  const left = new Map(fresh.map((t) => [t.id, t]))
  const groups: NoteGroup[] = []
  for (const e of input.epics) {
    const tasks = e.tasks.flatMap((id) => {
      const t = left.get(id)
      if (!t) return []
      left.delete(id)
      return [{ id: t.id, title: t.title }]
    })
    if (tasks.length) groups.push({ epic: { id: e.id, title: e.title, done: e.status === "done" }, tasks })
  }
  if (left.size) groups.push({ epic: null, tasks: [...left.values()].map((t) => ({ id: t.id, title: t.title })) })
  return groups
}

/** `# Unreleased (today)` + one `###` per epic (` — in progress` while unfinished) + `* title (Tnnn)` lines. */
export function formatReleaseNotes(groups: NoteGroup[], today: string): string {
  const parts = [`# Unreleased (${today})`, ""]
  for (const g of groups) {
    parts.push(g.epic ? `### ${g.epic.title} (${g.epic.id})${g.epic.done ? "" : " — in progress"}` : "### Other", "")
    for (const t of g.tasks) parts.push(`* ${t.title} (${t.id})`)
    parts.push("")
  }
  return parts.join("\n") + "\n"
}

/** Edits that put `section` at the top of `changelog`, replacing a top `# Unreleased` section; past entries stay byte-for-byte. */
export function releaseNotesEdits(changelog: string, section: string): TextEdit[] {
  if (changelog === "") return [{ old_string: "", new_string: section }]
  const [start, end] = unreleasedRange(changelog) ?? [0, 0]
  // old_string = a prefix of the file reaching past the replaced part, grown line by line until it is unique
  let k = end
  do {
    const nl = changelog.indexOf("\n", k)
    k = nl === -1 ? changelog.length : nl + 1
  } while (k < changelog.length && changelog.indexOf(changelog.slice(0, k), 1) !== -1)
  return [{ old_string: changelog.slice(0, k), new_string: changelog.slice(0, start) + section + changelog.slice(end, k) }]
}
