"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useApp } from "@/context/AppContext"
import { MarkdownRenderer } from "@/components/docs/MarkdownRenderer"
import { cn } from "@/lib/utils"
import { ProposalCard, type Proposal, type ProposalStatus } from "./ProposalCard"
import { PlanCard, type PlanCreated, type PlanProposal, type PlanStatus } from "./PlanCard"
import { QuestionCard, formatAnswers, isRenderableQuestions, type Question, type QuestionSet } from "./QuestionCard"
import { asRenderablePlan, planTarget } from "@/lib/plan"
import type { TextEdit } from "@/lib/diff"
import { ASK_AGENT_EVENT, OPEN_CHAT_EVENT, type AskAgentDetail } from "@/lib/ask-agent"
import { addChat, chatStatus, chatTitle, closeChat, epicAgents, epicAgentStore, epicOf, patchChat, pendingReviews, routeAsk, runningChats, type Chat, type ChatStatus } from "@/lib/chats"

interface ChatMessage {
  role: "user" | "assistant"
  text: string
  tools: string[]
  proposals: Proposal[]
  plans: PlanProposal[]
  questions: QuestionSet[]
  error?: string
}

type ChatTab = Chat<ChatMessage>

const STATUS_LABEL: Record<ChatStatus, string> = {
  running: "Running",
  "needs-answer": "Waiting for your answers",
  review: "Plan or edit to review",
  error: "Error",
  idle: "Idle",
}

function StatusMarker({ status }: { status: ChatStatus }) {
  if (status === "idle") return null
  return (
    <span title={STATUS_LABEL[status]} className="shrink-0 inline-flex">
      {status === "running"
        ? <Loader2 className="size-3 animate-spin text-muted" />
        : <span className={cn(
            "size-1.5 rounded-full",
            status === "needs-answer" && "bg-amber",
            status === "review" && "bg-accent",
            status === "error" && "bg-red-400",
          )} />}
    </span>
  )
}

const blank = (role: ChatMessage["role"], text = ""): ChatMessage =>
  ({ role, text, tools: [], proposals: [], plans: [], questions: [] })

export function ChatPanel({ onClose }: { onClose: () => void }) {
  const { rootParam, activeProject, selectedDoc } = useApp()
  const pathname = usePathname()
  const [chats, setChats] = useState<ChatTab[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [input, setInput] = useState("")
  // An askAgent() refused at the running-chat cap
  const [notice, setNotice] = useState<string | null>(null)
  // One in-flight request per chat; a stream only ever writes into the chat id it was started for
  const abortsRef = useRef(new Map<string, AbortController>())
  const nextIdRef = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const docPath = pathname === "/docs" ? selectedDoc?.path : undefined
  const active = chats.find((c) => c.id === activeId)
  const runningCount = chats.filter((c) => c.busy).length

  // Lets the roadmap's breakdown dialog see the free slots
  useEffect(() => { runningChats.set(runningCount) }, [runningCount])
  // Lets the roadmap mark the epics a chat is working on
  useEffect(() => { epicAgentStore.set(epicAgents(chats)) }, [chats])

  // openAgentChat() from an epic's marker: show that tab (layout.tsx opens the sidebar)
  useEffect(() => {
    function onOpen(e: Event) {
      const chatId = (e as CustomEvent<{ chatId: string }>).detail?.chatId
      if (chatId) setActiveId((cur) => (chats.some((c) => c.id === chatId) ? chatId : cur))
    }
    window.addEventListener(OPEN_CHAT_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_CHAT_EVENT, onOpen)
  }, [chats])

  // A Claude session belongs to one project
  useEffect(() => {
    for (const ac of abortsRef.current.values()) ac.abort()
    abortsRef.current.clear()
    setChats([])
    setActiveId(null)
  }, [activeProject])

  // Only the visible chat scrolls the panel: patchChat keeps background chats referentially equal
  const activeMessages = active?.messages
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [activeMessages, activeId])

  // askAgent(): into the active chat when it is idle, otherwise into a new tab.
  // No deps on purpose: re-subscribes each render so the handler sees the current `chats`/`send`.
  useEffect(() => {
    function onAsk(e: Event) {
      const { message, newChat } = (e as CustomEvent<AskAgentDetail>).detail ?? {}
      if (!message) return
      // abortsRef is updated synchronously by send(), so it counts asks fired earlier in this same tick
      const route = routeAsk(chats, activeId, { newChat, running: abortsRef.current.size })
      if ("refused" in route) return setNotice(route.refused)
      setNotice(null)
      send("chatId" in route ? route.chatId : openChat(), message)
    }
    window.addEventListener(ASK_AGENT_EVENT, onAsk)
    return () => window.removeEventListener(ASK_AGENT_EVENT, onAsk)
  })

  function openChat() {
    const id = `chat${++nextIdRef.current}`
    setChats((cs) => addChat(cs, id))
    setActiveId(id)
    return id
  }

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

  // `text` is a message built by a card (question answers) or askAgent(); otherwise send what's typed.
  // `chatId` may be a chat openChat() just queued, so a missing chat means a fresh one.
  async function send(chatId: string, text?: string) {
    const message = (text ?? input).trim()
    const chat = chats.find((c) => c.id === chatId)
    if (!message || chat?.busy) return
    if (text === undefined) setInput("")
    const notes = chat?.notes ?? []
    setChats((cs) => patchChat(cs, chatId, (c) => ({
      ...c,
      title: c.messages.length ? c.title : chatTitle(message),
      epicId: epicOf(message) ?? c.epicId,
      busy: true,
      notes: [],
      messages: [...c.messages, blank("user", message), blank("assistant")],
    })))
    const outgoing = notes.length ? `[${notes.join(" ")}]\n\n${message}` : message
    const ac = new AbortController()
    abortsRef.current.set(chatId, ac)
    try {
      const res = await fetch(`/api/chat${rootParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: outgoing, sessionId: chat?.sessionId ?? null, docPath }),
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
    } finally {
      if (abortsRef.current.get(chatId) === ac) abortsRef.current.delete(chatId)
      setChats((cs) => patchChat(cs, chatId, (c) => ({ ...c, busy: false })))
    }
  }

  function closeTab(id: string) {
    const chat = chats.find((c) => c.id === id)
    const n = chat ? pendingReviews(chat) : 0
    if (n && !window.confirm(`Discard ${n} unreviewed proposal${n === 1 ? "" : "s"}?`)) return
    // Aborting the fetch makes /api/chat kill its `claude -p` child
    abortsRef.current.get(id)?.abort()
    abortsRef.current.delete(id)
    // Functional update so a stream chunk queued since this render isn't dropped from the other tabs
    setChats((cs) => closeChat(cs, id, activeId).chats)
    setActiveId(closeChat(chats, id, activeId).activeId)
  }

  function sendTyped() {
    if (!input.trim() || active?.busy) return
    send(activeId ?? openChat())
  }

  // A blank active tab is already a new chat
  function newChat() {
    if (active && !active.messages.length) return
    openChat()
  }

  function mapMessages(chatId: string, fn: (m: ChatMessage) => ChatMessage, note?: string) {
    setChats((cs) => patchChat(cs, chatId, (c) => ({
      ...c,
      notes: note ? [...c.notes, note] : c.notes,
      messages: c.messages.map(fn),
    })))
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

  // Only the latest reply counts: once the user types past a card, it no longer blocks the hint
  const needsYou = chats.filter((c) => c.id !== activeId && ["needs-answer", "review"].includes(chatStatus(c))).length
  const questionsPending = !!active?.messages[active.messages.length - 1]?.questions.some((q) => !q.answers)

  return (
    <aside className="w-[380px] h-full border-l border-border bg-surface flex flex-col">
      <div className="h-10 px-3 flex items-center gap-2 border-b border-border">
        <span className="text-xs font-mono uppercase tracking-widest text-muted" title={needsYou ? `${needsYou} other chat${needsYou === 1 ? "" : "s"} need${needsYou === 1 ? "s" : ""} you` : undefined}>
          Agent{needsYou > 0 && <span className="text-amber"> · {needsYou}</span>}
        </span>
        <div className="flex-1" />
        <button onClick={newChat} className="text-xs text-muted hover:text-txt">New chat</button>
        <button onClick={onClose} className="text-muted hover:text-txt text-lg leading-none" aria-label="Close chat">×</button>
      </div>

      {chats.length > 0 && (
        <div role="tablist" aria-label="Chats" className="flex gap-1 overflow-x-auto border-b border-border px-2 py-1">
          {chats.map((c) => (
            <div
              key={c.id}
              className={cn(
                "shrink-0 flex items-center rounded-sm text-xs",
                c.id === activeId ? "bg-surface2 text-txt" : "text-muted hover:text-txt",
              )}
            >
              <button
                role="tab"
                aria-selected={c.id === activeId}
                onClick={() => setActiveId(c.id)}
                title={c.title}
                className="flex items-center gap-1.5 max-w-[140px] pl-2 py-0.5"
              >
                <StatusMarker status={chatStatus(c)} />
                <span className="truncate">{c.title}</span>
              </button>
              <button
                onClick={() => closeTab(c.id)}
                aria-label={`Close ${c.title}`}
                title="Close chat"
                className="px-1.5 py-0.5 text-muted hover:text-txt leading-none"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 text-sm">
        {!active?.messages.length && (
          <p className="text-muted text-xs">
            Ask the agent to read, write or restructure docs. Runs on your local Claude Code login.
          </p>
        )}
        {/* Every chat stays mounted (hidden when inactive) so card state like unchecked tasks survives a tab switch */}
        {chats.map((c) => (
          <div key={c.id} role="tabpanel" hidden={c.id !== activeId} className="space-y-3">
            {c.messages.map((m, i) => (
              <div key={i} className={cn(m.role === "user" && "ml-8 rounded-lg bg-surface2 px-3 py-2 whitespace-pre-wrap")}>
                {m.role === "user" ? m.text : (
                  <>
                    {m.tools.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {m.tools.map((t, j) => (
                          <span key={j} className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-surface2 border border-border text-accent">{t}</span>
                        ))}
                      </div>
                    )}
                    {m.proposals.map((p) => (
                      <ProposalCard key={p.id} proposal={p} onResolve={(status) => resolveProposal(c.id, p.id, p.path, status)} />
                    ))}
                    {m.plans.map((p) => (
                      <PlanCard key={p.id} proposal={p} onResolve={(status, created, unchecked) => resolvePlan(c.id, p, status, created, unchecked)} />
                    ))}
                    {m.questions.map((q) => (
                      <QuestionCard key={q.id} set={q} disabled={c.busy} onSubmit={(answers) => answerQuestions(c.id, q, answers)} />
                    ))}
                    {m.text && <MarkdownRenderer content={m.text} className="text-sm" />}
                    {!m.text && !m.error && c.busy && i === c.messages.length - 1 && (
                      <span className="text-muted text-xs">Thinking…</span>
                    )}
                    {m.error && <p className="text-red-400 text-xs whitespace-pre-wrap">{m.error}</p>}
                  </>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="border-t border-border p-2">
        {notice && (
          <div role="status" className="flex items-start gap-2 px-1 pb-1.5 text-xs text-amber">
            <span className="flex-1">{notice}</span>
            <button onClick={() => setNotice(null)} aria-label="Dismiss" className="text-muted hover:text-txt leading-none">×</button>
          </div>
        )}
        {docPath && <div className="text-[10px] font-mono text-muted px-1 pb-1 truncate">@ {docPath}</div>}
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              sendTyped()
            }
          }}
          rows={3}
          placeholder={active?.busy ? "Agent is working…" : questionsPending ? "Answer the questions above…" : "Ask the agent… (Enter to send)"}
          className="w-full resize-none rounded-md bg-surface2 border border-border px-2 py-1.5 text-sm text-txt placeholder:text-muted focus:outline-hidden focus:border-accent"
        />
      </div>
    </aside>
  )
}
