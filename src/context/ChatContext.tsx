"use client"

/**
 * Agent chats: one store for the sidebar list, the chat modal, the /chat page and the roadmap/board markers.
 * Each chat is its own `claude -p` session (POST /api/chat per turn); chats are saved to
 * .vibedoc/chats/<id>.json (/api/conversations) at turn end, card resolution and attach changes.
 */

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useApp } from "@/context/AppContext"
import type { Proposal, ProposalStatus } from "@/components/chat/ProposalCard"
import type { PlanCreated, PlanProposal, PlanStatus } from "@/components/chat/PlanCard"
import { formatAnswers, isRenderableQuestions, type Question, type QuestionSet } from "@/components/chat/QuestionCard"
import { asRenderablePlan, planTarget } from "@/lib/plan"
import type { TextEdit } from "@/lib/diff"
import { ASK_AGENT_EVENT, OPEN_CHAT_EVENT, openAgentChat, type AskAgentDetail } from "@/lib/ask-agent"
import {
  addChat, attachContext, attachKey, attentionQueue, chatFor, chatStatus, chatTitle, defaultChat, epicOf, fromSaved, isActionableError, isWaiting,
  itemAgents, newChatId, newlyWaiting, nextInQueue, patchChat, pendingReviews, routeAsk, toSaved, waitingTitle,
  type Attach, type Chat, type ChatStatus, type ItemAgent,
} from "@/lib/chats"

export interface ChatMessage {
  role: "user" | "assistant"
  text: string
  tools: string[]
  proposals: Proposal[]
  plans: PlanProposal[]
  questions: QuestionSet[]
  error?: string
}

export type ChatTab = Chat<ChatMessage>

const blank = (role: ChatMessage["role"], text = ""): ChatMessage =>
  ({ role, text, tools: [], proposals: [], plans: [], questions: [] })

interface ChatApi {
  chats: ChatTab[]
  loaded: boolean
  /** Chat shown in the modal; null = closed */
  modalId: string | null
  /** keep: don't drop an empty chat (it is moving to the /chat page) */
  closeModal: (opts?: { keep?: boolean }) => void
  /** Open a chat: in the modal, or selected in place when already on /chat */
  show: (chatId: string) => void
  /**
   * Header button / `c`: walks the attention queue (the open chat's next item, else its head); past its end closes
   * the modal; with nothing open and nothing queued, the running or newest chat, else a fresh one.
   */
  showDefault: () => void
  /** Resume the chat attached to `a`, or start one */
  showAbout: (a: Attach) => void
  /** A new empty chat (not saved until its first message); returns its id */
  create: (attach?: Attach | null) => string
  send: (chatId: string, text: string) => void
  stop: (chatId: string) => void
  /** Stop counting an errored chat in the header / rail (saved; the next turn clears it) */
  dismiss: (chatId: string) => void
  /** Delete a chat (asks first when cards are unreviewed); returns false if the user cancelled */
  remove: (chatId: string) => boolean
  resolveProposal: (chatId: string, id: string, path: string, status: ProposalStatus) => void
  resolvePlan: (chatId: string, p: PlanProposal, status: PlanStatus, created: PlanCreated[], unchecked: string[]) => void
  answerQuestions: (chatId: string, set: QuestionSet, answers: string[]) => void
  /** attachKey → the most urgent chat working on that epic/task */
  agents: Record<string, ItemAgent>
  runningCount: number
  waitingCount: number
  /** Errored chats worth an alarm: recent and not dismissed (isActionableError) */
  errorCount: number
  /** Chats that need the user: waiting, then actionable errors (attentionQueue) */
  queue: ChatTab[]
  /** Minute clock the error counts use; pass to isActionableError for per-row checks */
  now: number
  /** An askAgent() refused at the running-chat cap */
  notice: string | null
  dismissNotice: () => void
}

const ChatContext = createContext<ChatApi | null>(null)
// Split out so roadmap nodes and board cards re-render only when some item's status flips, not per stream delta
const ItemAgentsContext = createContext<Record<string, ItemAgent>>({})

export function useChats(): ChatApi {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error("useChats() must be used inside <ChatProvider>")
  return ctx
}

/** The chat working on an epic/task, if any (roadmap nodes, sheets, board cards). */
export function useItemAgent(a: Attach): ItemAgent | undefined {
  return useContext(ItemAgentsContext)[attachKey(a)]
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { rootParam, activeProject, selectedDoc, demo } = useApp()
  const pathname = usePathname()
  const router = useRouter()
  const [chats, setChats] = useState<ChatTab[]>([])
  const [loaded, setLoaded] = useState(false)
  const [modalId, setModalId] = useState<string | null>(null)
  // The chat last shown (modal or page): where an untargeted askAgent() goes when that chat is idle and unattached
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // One in-flight request per chat; a stream only ever writes into the chat id it was started for
  const abortsRef = useRef(new Map<string, AbortController>())
  // Chats changed since their last save; saved by the effect below once they aren't busy
  const dirtyRef = useRef(new Set<string>())
  const notifiedRef = useRef<Record<string, ChatStatus>>({})
  // Re-read each minute so a day-old error drops out of the alarm counts without a reload
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])

  const onChatPage = pathname === "/chat"
  const docPath = pathname === "/docs" ? selectedDoc?.path : undefined

  // A Claude session belongs to one project: stop everything and load that project's chats
  useEffect(() => {
    for (const ac of abortsRef.current.values()) ac.abort()
    abortsRef.current.clear()
    dirtyRef.current.clear()
    let cancelled = false
    fetch(`/api/conversations${rootParam}`)
      .then((r) => (r.ok ? r.json() : { chats: [] }))
      .then((d: { chats?: unknown[] }) => {
        if (cancelled) return
        // Read-only demo: no chats at all, so no item shows a chat mark to click
        const loadedChats = (demo ? [] : d.chats ?? []).map((c) => fromSaved<ChatMessage>(c)).filter((c): c is ChatTab => !!c)
        notifiedRef.current = Object.fromEntries(loadedChats.map((c) => [c.id, chatStatus(c)]))
        setChats(loadedChats)
        setModalId(null)
        setCurrentId(null)
        setLoaded(true)
      })
      .catch((e) => {
        console.warn("[vibedoc] could not load chats:", e)
        if (!cancelled) { setChats([]); setLoaded(true) }
      })
    return () => { cancelled = true }
  }, [activeProject, rootParam, demo])

  // Save chats marked dirty: at turn start (so a reload shows it as interrupted), turn end and card resolution.
  // Never per stream delta: nothing marks a chat dirty while it streams.
  useEffect(() => {
    for (const id of [...dirtyRef.current]) {
      const chat = chats.find((c) => c.id === id)
      dirtyRef.current.delete(id)
      const saved = chat && toSaved(chat)
      if (!saved) continue
      fetch(`/api/conversations${rootParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat: saved }),
      }).catch((e) => console.warn(`[vibedoc] could not save chat ${id}:`, e))
    }
  }, [chats, rootParam])

  // Reference-stable while no item's status changes (streaming text changes `chats` many times a second)
  const agentsRef = useRef<{ key: string; value: Record<string, ItemAgent> }>({ key: "{}", value: {} })
  const agents = useMemo(() => {
    const next = itemAgents(chats)
    const key = JSON.stringify(next)
    if (key !== agentsRef.current.key) agentsRef.current = { key, value: next }
    return agentsRef.current.value
  }, [chats])
  const runningCount = chats.filter((c) => c.busy).length
  const waitingCount = chats.filter((c) => isWaiting(chatStatus(c))).length
  const errorCount = chats.filter((c) => isActionableError(c, now)).length
  const queue = useMemo(() => attentionQueue(chats, now), [chats, now])

  // "(n) VibeDoc" in the browser tab; pathname is a dep because a navigation can put Next's metadata title back
  useEffect(() => { document.title = waitingTitle(document.title, queue.length) }, [queue.length, pathname])

  // Desktop notification when a chat starts waiting while this browser tab is in the background
  useEffect(() => {
    const fresh = newlyWaiting(notifiedRef.current, chats)
    notifiedRef.current = Object.fromEntries(chats.map((c) => [c.id, chatStatus(c)]))
    if (!fresh.length || !document.hidden || !("Notification" in window) || Notification.permission !== "granted") return
    for (const { chat, status } of fresh) {
      const n = new Notification(status === "needs-answer" ? "Agent needs your answer" : "Plan ready to review", { body: chat.title, tag: chat.id })
      n.onclick = () => { window.focus(); openAgentChat(chat.id); n.close() }
    }
  }, [chats])

  function markDirty(id: string) { dirtyRef.current.add(id) }

  // A chat closed before its first message was never saved; drop it so empty chats don't pile up
  function closeModal(opts: { keep?: boolean } = {}) {
    if (!opts.keep) setChats((cs) => cs.filter((c) => c.id !== modalId || c.messages.length > 0))
    setModalId(null)
  }

  // Read-only demo (R042): no chat ever opens, so no agent can be spawned from any button or key
  function show(chatId: string) {
    if (demo) return
    setCurrentId(chatId)
    if (onChatPage) {
      setModalId(null)
      router.replace(`/chat?id=${encodeURIComponent(chatId)}`, { scroll: false })
    } else {
      setModalId(chatId)
    }
  }

  function create(attach: Attach | null = null) {
    const id = newChatId(Date.now())
    setChats((cs) => addChat(cs, id, { attach }))
    return id
  }

  function showDefault() {
    const next = nextInQueue(queue, modalId ?? (onChatPage ? currentId : null))
    if (next) return show(next.id)
    if (modalId) return closeModal()
    const c = defaultChat(chats, now)
    show(c ? c.id : create())
  }

  function showAbout(a: Attach) {
    const c = chatFor(chats, a)
    show(c ? c.id : create(a))
  }

  // askAgent() from anywhere, routed by routeAsk(): an ask about an item goes to that item's chat (or opens it while it
  // runs or waits on you), anything else to the current chat only when it is idle and unattached; then show it.
  // No deps on purpose: re-subscribes each render so the handler sees the current `chats`/`send`.
  useEffect(() => {
    function onAsk(e: Event) {
      const { message, newChat } = (e as CustomEvent<AskAgentDetail>).detail ?? {}
      if (!message) return
      const epic = epicOf(message)
      // abortsRef is updated synchronously by send(), so it counts asks fired earlier in this same tick
      const route = routeAsk(chats, currentId, { target: epic ? { kind: "epic", id: epic } : null, newChat, running: abortsRef.current.size })
      if ("refused" in route) return setNotice(route.refused)
      setNotice(null)
      // already working on it, or waiting on your answer: show that chat instead of sending a second ask
      if ("open" in route) return newChat ? undefined : show(route.open)
      const id = "chatId" in route ? route.chatId : create(route.attach)
      send(id, message)
      // newChat asks (the multi-epic breakdown dialog) run in the background: the sidebar and roadmap show them
      if (!newChat) show(id)
    }
    function onOpen(e: Event) {
      const chatId = (e as CustomEvent<{ chatId: string }>).detail?.chatId
      if (chatId && chats.some((c) => c.id === chatId)) show(chatId)
    }
    window.addEventListener(ASK_AGENT_EVENT, onAsk)
    window.addEventListener(OPEN_CHAT_EVENT, onOpen)
    return () => {
      window.removeEventListener(ASK_AGENT_EVENT, onAsk)
      window.removeEventListener(OPEN_CHAT_EVENT, onOpen)
    }
  })

  function patchLast(chatId: string, fn: (m: ChatMessage) => ChatMessage) {
    setChats((cs) => patchChat(cs, chatId, (c) => ({ ...c, messages: [...c.messages.slice(0, -1), fn(c.messages[c.messages.length - 1])] })))
  }

  // Handles one line of `claude -p --output-format stream-json` for chat `chatId`
  function handleEvent(chatId: string, ev: any) {
    if (ev.session_id) setChats((cs) => patchChat(cs, chatId, (c) => (c.sessionId === ev.session_id ? c : { ...c, sessionId: ev.session_id })))
    if (ev.type === "stream_event") {
      const e = ev.event
      if (e?.type === "message_start") {
        patchLast(chatId, (m) => (m.text && !m.text.endsWith("\n\n") ? { ...m, text: m.text + "\n\n" } : m))
      } else if (e?.type === "content_block_delta" && e.delta?.type === "text_delta") {
        patchLast(chatId, (m) => ({ ...m, text: m.text + e.delta.text }))
      }
    } else if (ev.type === "assistant") {
      const uses: { type: string; id: string; name: string; input: Record<string, unknown> }[] =
        (ev.message?.content ?? []).filter((b: { type: string }) => b.type === "tool_use")
      const proposals: Proposal[] = uses
        .filter((b) => b.name.endsWith("vibedoc_propose_edit") && typeof b.input?.path === "string" && Array.isArray(b.input?.edits))
        .map((b) => ({
          id: b.id,
          path: b.input.path as string,
          edits: b.input.edits as TextEdit[],
          summary: typeof b.input.summary === "string" ? b.input.summary : undefined,
          status: "pending",
        }))
      // Cards render before the server validates the input, so drop shapes they can't draw instead of crashing
      const plans: PlanProposal[] = uses
        .filter((b) => b.name.endsWith("vibedoc_propose_plan"))
        .flatMap((b) => {
          const plan = asRenderablePlan(b.input?.plan)
          return plan ? [{ id: b.id, plan, status: "pending" as const }] : []
        })
      const questions: QuestionSet[] = uses
        .filter((b) => b.name.endsWith("vibedoc_ask_questions") && isRenderableQuestions(b.input?.questions))
        .map((b) => ({ id: b.id, questions: b.input.questions as Question[] }))
      const cards = ["vibedoc_propose_edit", "vibedoc_propose_plan", "vibedoc_ask_questions"]
      const tools = uses
        .filter((b) => !cards.some((c) => b.name.endsWith(c)))
        .map((b) => b.name.replace(/^mcp__vibedoc__vibedoc_/, ""))
      if (tools.length || proposals.length || plans.length || questions.length) {
        patchLast(chatId, (m) => ({
          ...m,
          tools: [...m.tools, ...tools],
          proposals: [...m.proposals, ...proposals],
          plans: [...m.plans, ...plans],
          questions: [...m.questions, ...questions],
        }))
      }
    } else if (ev.type === "user") {
      // A proposal the server rejected (bad old_string) is retried by the agent; don't show it
      const failed = new Set(
        (ev.message?.content ?? [])
          .filter((b: { type: string; is_error?: boolean }) => b.type === "tool_result" && b.is_error)
          .map((b: { tool_use_id: string }) => b.tool_use_id),
      )
      if (failed.size) {
        patchLast(chatId, (m) => ({
          ...m,
          proposals: m.proposals.filter((p) => !failed.has(p.id)),
          plans: m.plans.filter((p) => !failed.has(p.id)),
          questions: m.questions.filter((q) => !failed.has(q.id)),
        }))
      }
    } else if (ev.type === "result" && ev.is_error) {
      patchLast(chatId, (m) => ({ ...m, error: ev.result ?? ev.subtype ?? "Agent error" }))
    } else if (ev.type === "error") {
      patchLast(chatId, (m) => ({ ...m, error: ev.message }))
    }
  }

  // `chatId` may be a chat create() just queued, so a missing chat means a fresh one.
  async function send(chatId: string, text: string) {
    const message = text.trim()
    const chat = chats.find((c) => c.id === chatId)
    if (!message || chat?.busy || demo) return
    // Ask once, from this click/Enter (browsers want a user gesture), so waiting chats can notify later
    if ("Notification" in window && Notification.permission === "default") void Notification.requestPermission().catch(() => {})
    const first = !chat?.messages.length
    const epic = epicOf(message)
    const attach: Attach | null = chat?.attach ?? (epic ? { kind: "epic", id: epic } : null)
    setChats((cs) => patchChat(cs, chatId, (c) => ({
      ...c,
      // An attached chat keeps its item title until the first message names what it's for
      title: c.messages.length ? c.title : chatTitle(message),
      attach: c.attach ?? attach,
      busy: true,
      dismissed: false,
      notes: [],
      updatedAt: new Date().toISOString(),
      messages: [...c.messages, blank("user", message), blank("assistant")],
    })))
    markDirty(chatId)
    // Context only for a chat opened from an epic/task (showAbout); an ask like "Break down epic R004…" names it already
    const prefix = [
      ...(first && chat?.attach ? [attachContext(chat.attach)] : []),
      ...(chat?.notes.length ? [`[${chat.notes.join(" ")}]`] : []),
    ]
    const outgoing = prefix.length ? `${prefix.join("\n")}\n\n${message}` : message
    const ac = new AbortController()
    abortsRef.current.set(chatId, ac)
    try {
      const res = await fetch(`/api/chat${rootParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: outgoing, sessionId: chat?.sessionId ?? null, docPath, conversationId: chatId }),
        signal: ac.signal,
      })
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? `Request failed (${res.status})`)
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ""
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split("\n")
        buf = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.trim()) continue
          try { handleEvent(chatId, JSON.parse(line)) } catch { /* partial or non-JSON line */ }
        }
      }
    } catch (e) {
      if (!ac.signal.aborted) patchLast(chatId, (m) => ({ ...m, error: (e as Error).message }))
      else patchLast(chatId, (m) => (m.text || m.error ? m : { ...m, error: "Stopped." }))
    } finally {
      // Only save a turn that is still ours: a project switch or delete clears the map first,
      // and saving then would write this chat into the next project (or resurrect a deleted one)
      if (abortsRef.current.get(chatId) === ac) {
        abortsRef.current.delete(chatId)
        markDirty(chatId)
      }
      setChats((cs) => patchChat(cs, chatId, (c) => ({ ...c, busy: false, updatedAt: new Date().toISOString() })))
    }
  }

  // Aborting the fetch makes /api/chat kill its `claude -p` child
  function stop(chatId: string) {
    abortsRef.current.get(chatId)?.abort()
  }

  function dismiss(chatId: string) {
    setChats((cs) => patchChat(cs, chatId, (c) => ({ ...c, dismissed: true })))
    markDirty(chatId)
  }

  function remove(chatId: string) {
    const chat = chats.find((c) => c.id === chatId)
    const n = chat ? pendingReviews(chat) : 0
    if (n && !window.confirm(`Discard ${n} unreviewed proposal${n === 1 ? "" : "s"}?`)) return false
    stop(chatId)
    abortsRef.current.delete(chatId)
    dirtyRef.current.delete(chatId)
    // Functional update so a stream chunk queued since this render isn't dropped from the other chats
    setChats((cs) => cs.filter((c) => c.id !== chatId))
    if (modalId === chatId) setModalId(null)
    if (currentId === chatId) setCurrentId(null)
    fetch(`/api/conversations${rootParam}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delete: chatId }),
    }).catch((e) => console.warn(`[vibedoc] could not delete chat ${chatId}:`, e))
    return true
  }

  function mapMessages(chatId: string, fn: (m: ChatMessage) => ChatMessage, note?: string) {
    setChats((cs) => patchChat(cs, chatId, (c) => ({
      ...c,
      notes: note ? [...c.notes, note] : c.notes,
      messages: c.messages.map(fn),
    })))
    markDirty(chatId)
  }

  function resolveProposal(chatId: string, id: string, path: string, status: ProposalStatus) {
    mapMessages(chatId, (m) => ({
      ...m,
      proposals: m.proposals.map((p) => (p.id === id ? { ...p, status } : p)),
    }), `User ${status} your proposed edit to ${path}.`)
  }

  function resolvePlan(chatId: string, p: PlanProposal, status: PlanStatus, created: PlanCreated[], unchecked: string[]) {
    const epic = p.plan.kind === "breakdown" ? planTarget(p.plan) : "the roadmap"
    mapMessages(chatId, (m) => ({
      ...m,
      plans: m.plans.map((x) => (x.id === p.id ? { ...x, status, created } : x)),
    }), status === "accepted"
      ? `User accepted plan for ${epic}: created ${created.map((c) => c.id).join(", ")}${unchecked.length ? ` (unchecked: ${unchecked.join(", ")})` : ""}.`
      : `User rejected the plan for ${epic}.`)
  }

  function answerQuestions(chatId: string, set: QuestionSet, answers: string[]) {
    if (chats.find((c) => c.id === chatId)?.busy) return
    mapMessages(chatId, (m) => ({
      ...m,
      questions: m.questions.map((q) => (q.id === set.id ? { ...q, answers } : q)),
    }))
    send(chatId, formatAnswers(set.questions, answers))
  }

  const api: ChatApi = {
    chats, loaded, modalId,
    closeModal,
    show, showDefault, showAbout, create, send, stop, dismiss, remove,
    resolveProposal, resolvePlan, answerQuestions,
    agents, runningCount, waitingCount, errorCount, queue, now,
    notice, dismissNotice: () => setNotice(null),
  }
  return (
    <ChatContext.Provider value={api}>
      <ItemAgentsContext.Provider value={agents}>{children}</ItemAgentsContext.Provider>
    </ChatContext.Provider>
  )
}
