/**
 * Cross-project inbox (R105, pure): everything waiting on the user in every hub project, newest first.
 * Core resolves the facts per project (needs-you rule, chat status, live turns); this only classifies, links and sorts.
 * No fs, no value imports from other libs. Self-check: node src/lib/inbox.check.mts
 */

export type InboxKind = "review" | "needs-test" | "failed-run" | "blocked" | "chat-waiting"

export interface InboxTaskInput {
  id: string
  title: string
  status: string
  /** The last run (or the checklist's Auto: result) failed */
  failedRun: boolean
  /** Test review's Needs you rule (`countNeedsYou`): unticked checks, unverified steps, … */
  needsTest: boolean
  /** ISO time it last changed, null when unknown */
  since: string | null
}

export interface InboxChatInput {
  id: string
  title: string
  /** `isWaiting(chatStatus(...))` and no live turn running */
  waiting: boolean
  since: string | null
  /** R108 T558: a worker chat, labelled "Worker · <branch> · <task>" */
  worker?: { branch: string; taskId: string | null }
}

export interface InboxProjectInput {
  project: { id: string; name: string; root?: string; archived?: boolean; missing?: boolean }
  tasks: InboxTaskInput[]
  chats: InboxChatInput[]
}

export interface InboxItem {
  kind: InboxKind
  /** `root` (when known) is where to send actions such as Approve: `?root=<root>` */
  project: { id: string; name: string; root?: string }
  id: string
  title: string
  since: string | null
  href: string
}

/** One item per task, the most pressing kind first: failed-run > blocked > review > needs-test. */
export function taskKind(t: InboxTaskInput): InboxKind | null {
  if (t.failedRun) return "failed-run"
  if (t.status === "blocked") return "blocked"
  if (t.status === "review") return "review"
  if (t.needsTest) return "needs-test"
  return null
}

function href(kind: InboxKind, id: string, projectId: string): string {
  const p = `project=${encodeURIComponent(projectId)}`
  const q = encodeURIComponent(id)
  if (kind === "chat-waiting") return `/chat?id=${q}&${p}`
  if (kind === "failed-run" || kind === "needs-test") return `/manual-tests?task=${q}&${p}`
  return `/board?task=${q}&${p}`
}

/** A worker row names its branch and task, so two workers' rows tell apart; a plain chat keeps its title. */
export function chatLabel(c: InboxChatInput): string {
  return c.worker ? ["Worker", c.worker.branch, ...(c.worker.taskId ? [c.worker.taskId] : [])].join(" · ") : c.title
}

/** Newest first; unknown times last; ties by project id, then item id, so the order is stable. */
export function sortInbox(items: InboxItem[]): InboxItem[] {
  return [...items].sort((a, b) =>
    (b.since ?? "").localeCompare(a.since ?? "") || a.project.id.localeCompare(b.project.id) || a.id.localeCompare(b.id))
}

/** The inbox from every project's inputs; archived and missing projects are skipped, `project` keeps one, `projects` (a group's members) keeps those. */
export function buildInbox(inputs: InboxProjectInput[], opts: { project?: string | null; projects?: ReadonlySet<string> | null } = {}): InboxItem[] {
  const items: InboxItem[] = []
  for (const { project, tasks, chats } of inputs) {
    if (project.archived || project.missing) continue
    if (opts.project && project.id !== opts.project) continue
    if (opts.projects && !opts.projects.has(project.id)) continue
    const p = { id: project.id, name: project.name, ...(project.root ? { root: project.root } : {}) }
    for (const t of tasks) {
      const kind = taskKind(t)
      if (kind) items.push({ kind, project: p, id: t.id, title: t.title, since: t.since, href: href(kind, t.id, p.id) })
    }
    for (const c of chats) {
      if (c.waiting) items.push({ kind: "chat-waiting", project: p, id: c.id, title: chatLabel(c), since: c.since, href: href("chat-waiting", c.id, p.id) })
    }
  }
  return sortInbox(items)
}
