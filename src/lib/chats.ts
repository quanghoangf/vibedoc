// Pure helpers for agent chats (ChatContext, ChatView, sidebar, /chat page). No React, no fs:
// `node src/lib/chats.check.mts` runs them.

/** What a chat is about: the roadmap/board show its status there, and the first turn tells the agent. */
export interface Attach { kind: "epic" | "task"; id: string }

export interface Chat<M = unknown> {
  id: string
  title: string
  messages: M[]
  /** Claude session to `--resume`; set by the first `session_id` in the stream */
  sessionId: string | null
  busy: boolean
  /** Accept/reject outcomes the agent hasn't heard about yet; sent with this chat's next message */
  notes: string[]
  attach: Attach | null
  createdAt: string
  updatedAt: string
  /** The user dismissed this chat's error; cleared by the next turn */
  dismissed?: boolean
}

export function newChatId(now: number, salt = Math.random()): string {
  return `c-${now.toString(36)}${salt.toString(36).slice(2, 6)}`
}

export function addChat<M>(chats: Chat<M>[], id: string, opts: { title?: string; attach?: Attach | null; now?: string } = {}): Chat<M>[] {
  const now = opts.now ?? new Date().toISOString()
  const title = opts.title ?? (opts.attach ? attachTitle(opts.attach) : "New chat")
  return [...chats, { id, title, messages: [], sessionId: null, busy: false, notes: [], attach: opts.attach ?? null, createdAt: now, updatedAt: now }]
}

/** A missing id (e.g. a closed chat whose stream is still unwinding) is a no-op. */
export function patchChat<M>(chats: Chat<M>[], id: string, fn: (c: Chat<M>) => Chat<M>): Chat<M>[] {
  return chats.map((c) => (c.id === id ? fn(c) : c))
}

/** The fields of a chat message the status reads (ChatContext's ChatMessage has more). */
export interface StatusMessage {
  role: "user" | "assistant"
  text?: string
  tools?: unknown[]
  questions: { answers?: unknown }[]
  proposals: { status: string }[]
  plans: { status: string }[]
  error?: string
}

export type ChatStatus = "running" | "needs-answer" | "review" | "idle" | "error"

export const STATUS_LABEL: Record<ChatStatus, string> = {
  running: "Running",
  "needs-answer": "Waiting for your answers",
  review: "Plan or edit to review",
  error: "Error",
  idle: "Idle",
}

/** Plan and edit cards the user hasn't accepted or rejected yet, across the whole chat. */
export function pendingReviews(chat: Chat<StatusMessage>): number {
  return chat.messages.reduce(
    (n, m) => n + m.plans.filter((p) => p.status === "pending").length + m.proposals.filter((p) => p.status === "pending").length,
    0,
  )
}

/** Precedence: running > needs-answer > review > error > idle. */
export function chatStatus(chat: Chat<StatusMessage>): ChatStatus {
  if (chat.busy) return "running"
  const last = chat.messages[chat.messages.length - 1]
  // Same rule as the composer hint: only the latest reply's questions block
  if (last?.questions.some((q) => !q.answers)) return "needs-answer"
  if (pendingReviews(chat)) return "review"
  const lastReply = chat.messages.findLast((m) => m.role === "assistant")
  return lastReply?.error ? "error" : "idle"
}

/** Errors older than this stop alarming in the shell; the chat itself still shows them. */
export const ERROR_ALARM_MS = 24 * 60 * 60 * 1000

/** An error worth a count in the header / collapsed rail: recent and not dismissed. */
export function isActionableError(chat: Chat<StatusMessage>, now: number): boolean {
  return !chat.dismissed && now - Date.parse(chat.updatedAt) < ERROR_ALARM_MS && chatStatus(chat) === "error"
}

/** The status the shell (sidebar, palette) shows: an error that no longer alarms reads as idle. */
export function shellStatus(chat: Chat<StatusMessage>, now: number): ChatStatus {
  const s = chatStatus(chat)
  return s === "error" && !isActionableError(chat, now) ? "idle" : s
}

export const isWaiting = (s: ChatStatus): s is "needs-answer" | "review" => s === "needs-answer" || s === "review"

/** Each running chat is one `claude -p` process. */
export const MAX_RUNNING_CHATS = 4
export const TOO_MANY_CHATS = `Too many agents running (${MAX_RUNNING_CHATS}). Stop or close a chat, or wait.`

export type AskRoute =
  | { chatId: string }
  | { newChat: true; attach: Attach | null }
  | { open: string }
  | { refused: string }

/**
 * Where an askAgent() message goes. An ask about an item (`target`, e.g. "Break down epic R004…") goes to that item's
 * chat when it is idle, opens it when it is running or waiting on you, else starts a new chat attached to the item.
 * Any other ask reuses the current chat only when it is idle and about nothing in particular; `newChat` never does.
 * A chat waiting on the user, running, or about another item is never written into. Refused at the cap.
 * `running` overrides the busy count when `chats` may be stale (several asks in one tick).
 */
export function routeAsk<C extends Chat<StatusMessage>>(
  chats: C[],
  currentId: string | null,
  opts: { target?: Attach | null; newChat?: boolean; running?: number } = {},
): AskRoute {
  const { target = null, newChat = false } = opts
  const free = (c: C) => chatStatus(c) === "idle" || chatStatus(c) === "error"
  if (target) {
    const own = chatFor(chats, target)
    if (own && !free(own)) return { open: own.id }
  }
  if ((opts.running ?? chats.filter((c) => c.busy).length) >= MAX_RUNNING_CHATS) return { refused: TOO_MANY_CHATS }
  if (target) {
    const own = chatFor(chats, target)
    return own ? { chatId: own.id } : { newChat: true, attach: target }
  }
  const current = chats.find((c) => c.id === currentId)
  return current && !newChat && !current.attach && free(current) ? { chatId: current.id } : { newChat: true, attach: null }
}

// ─── Attachments ──────────────────────────────────────────────────────────────

export const attachKey = (a: Attach) => `${a.kind}:${a.id}`
export const sameAttach = (a: Attach | null, b: Attach | null) => !!a && !!b && a.kind === b.kind && a.id === b.id

export function attachTitle(a: Attach): string {
  return a.kind === "epic" ? `Epic ${a.id}` : `Task ${a.id}`
}

/** The epic a message asks to break down: the roadmap's "Break down with agent" wording, or the same typed by hand. */
export function epicOf(message: string): string | null {
  return message.trim().match(/^Break down epic (R\d+)/i)?.[1].toUpperCase() ?? null
}

/** The chat to resume for `a`: the most recently updated one attached to it. */
export function chatFor<C extends Chat>(chats: C[], a: Attach): C | undefined {
  return chats.filter((c) => sameAttach(c.attach, a)).sort((x, y) => y.updatedAt.localeCompare(x.updatedAt))[0]
}

/** What the roadmap/board show on an item while a chat works on it. Idle and errored chats show nothing. */
export interface ItemAgent { status: "running" | "needs-answer" | "review"; chatId: string }

const RANK = { running: 3, "needs-answer": 2, review: 1 } as const

/** attachKey → the most urgent chat on it (running > needs-answer > review). */
export function itemAgents(chats: Chat<StatusMessage>[]): Record<string, ItemAgent> {
  const out: Record<string, ItemAgent> = {}
  for (const c of chats) {
    const status = chatStatus(c)
    if (!c.attach || status === "idle" || status === "error") continue
    const key = attachKey(c.attach)
    const cur = out[key]
    if (!cur || RANK[status] > RANK[cur.status]) out[key] = { status, chatId: c.id }
  }
  return out
}

/** First-turn context for an attached chat; later turns resume the Claude session, which remembers it. */
export function attachContext(a: Attach): string {
  return a.kind === "epic"
    ? `[This chat is about epic ${a.id}. Read it with vibedoc_get_roadmap (and its tasks with vibedoc_get_task) before answering.]`
    : `[This chat is about task ${a.id}. Read it with vibedoc_get_task before answering.]`
}

/** Starter prompts shown in an empty chat. Each is something the agent can do with only the vibedoc_* tools. */
export function suggestions(a: Attach | null): string[] {
  if (!a) return ["What should I work on next?", "Plan a roadmap for this project.", "What is blocked right now?"]
  if (a.kind === "epic") return [`Break down epic ${a.id} into tasks.`, "Summarize this epic's progress.", "What is at risk in this epic?"]
  return ["Refine this task's spec.", "Split this task into smaller tasks.", "What blocks this task?"]
}

// ─── Lists ────────────────────────────────────────────────────────────────────

export interface ChatGroups<C> { needsYou: C[]; errors: C[]; running: C[]; recent: C[] }

/**
 * Sidebar and /chat list order: waiting on you, actionable errors, running, then the rest; newest first within a group.
 * `errors` fills only when `now` is given (actionable is time-dependent); without it errored chats stay in `recent`.
 */
export function groupChats<C extends Chat<StatusMessage>>(chats: C[], now?: number): ChatGroups<C> {
  const byNew = [...chats].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const groups: ChatGroups<C> = { needsYou: [], errors: [], running: [], recent: [] }
  for (const c of byNew) {
    const s = chatStatus(c)
    if (isWaiting(s)) groups.needsYou.push(c)
    else if (now !== undefined && isActionableError(c, now)) groups.errors.push(c)
    else if (s === "running") groups.running.push(c)
    else groups.recent.push(c)
  }
  return groups
}

/** What needs the user, in order: chats waiting on you, then actionable errors. `c`, the header strip and ⌘K open its head. */
export function attentionQueue<C extends Chat<StatusMessage>>(chats: C[], now: number): C[] {
  const g = groupChats(chats, now)
  return [...g.needsYou, ...g.errors]
}

/** Where `c` goes from `currentId`: the next queue item after it, the head when it isn't queued, undefined past the end. */
export function nextInQueue<C extends Chat>(queue: C[], currentId: string | null): C | undefined {
  const i = queue.findIndex((c) => c.id === currentId)
  return queue[i + 1]
}

/** The chat the header button / `c` opens: the queue head, else running, else the newest, else none. */
export function defaultChat<C extends Chat<StatusMessage>>(chats: C[], now = Date.now()): C | undefined {
  const g = groupChats(chats, now)
  return g.needsYou[0] ?? g.errors[0] ?? g.running[0] ?? g.recent[0]
}

// ─── Persistence (.vibedoc/chats/<id>.json via /api/conversations) ───────────

/** What gets saved: never busy (a running turn can't survive a reload). Empty chats aren't saved. */
export function toSaved<M>(c: Chat<M>): Chat<M> | null {
  return c.messages.length ? { ...c, busy: false } : null
}

/** A saved chat as loaded: a turn that was cut off (empty last reply, no error) gets an "interrupted" error. */
export function fromSaved<M extends StatusMessage>(raw: unknown): Chat<M> | null {
  const c = raw as Chat<M> | null
  if (!c || typeof c.id !== "string" || !Array.isArray(c.messages)) return null
  const last = c.messages[c.messages.length - 1]
  const cut = last?.role === "assistant" && !last.text && !last.error && !last.tools?.length && !last.plans?.length && !last.proposals?.length && !last.questions?.length
  const messages = cut ? [...c.messages.slice(0, -1), { ...last, error: "Interrupted: the page reloaded while the agent was working." }] : c.messages
  const at = c.updatedAt ?? c.createdAt ?? new Date(0).toISOString()
  return { ...c, messages, busy: false, notes: c.notes ?? [], attach: c.attach ?? null, createdAt: c.createdAt ?? at, updatedAt: at }
}

// ─── Waiting on the user: header badge, page title, desktop notification ─────

/** Chats that became waiting since `prev` (id → last status), so each one notifies once per change. */
export function newlyWaiting<C extends Chat<StatusMessage>>(prev: Record<string, ChatStatus>, chats: C[]): { chat: C; status: "needs-answer" | "review" }[] {
  return chats.flatMap((chat) => {
    const status = chatStatus(chat)
    return isWaiting(status) && prev[chat.id] !== status ? [{ chat, status }] : []
  })
}

/** "(2) VibeDoc" while 2 chats need you (the attention queue); the plain title otherwise. Idempotent. */
export function waitingTitle(title: string, n: number): string {
  const base = title.replace(/^\(\d+\) /, "")
  return n > 0 ? `(${n}) ${base}` : base
}

export function chatTitle(firstMessage: string): string {
  const epic = epicOf(firstMessage)
  if (epic) return `Break down ${epic}`
  const line = firstMessage.trim().split("\n")[0]
  return line.length > 40 ? `${line.slice(0, 40).trimEnd()}…` : line
}

/** "now", "5m", "3h", "2d" since `iso` (list rows). */
export function ago(iso: string, nowMs: number): string {
  const min = Math.max(0, Math.floor((nowMs - Date.parse(iso)) / 60_000))
  if (min < 1) return "now"
  if (min < 60) return `${min}m`
  if (min < 60 * 24) return `${Math.floor(min / 60)}h`
  return `${Math.floor(min / (60 * 24))}d`
}
