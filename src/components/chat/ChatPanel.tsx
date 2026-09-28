"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { useApp } from "@/context/AppContext"
import { MarkdownRenderer } from "@/components/docs/MarkdownRenderer"
import { cn } from "@/lib/utils"
import { ProposalCard, type Proposal, type ProposalStatus } from "./ProposalCard"
import { PlanCard, type PlanCreated, type PlanProposal, type PlanStatus } from "./PlanCard"
import { QuestionCard, formatAnswers, isRenderableQuestions, type Question, type QuestionSet } from "./QuestionCard"
import { asRenderablePlan, planTarget } from "@/lib/plan"
import type { TextEdit } from "@/lib/diff"
import { ASK_AGENT_EVENT } from "@/lib/ask-agent"

interface ChatMessage {
  role: "user" | "assistant"
  text: string
  tools: string[]
  proposals: Proposal[]
  plans: PlanProposal[]
  questions: QuestionSet[]
  error?: string
}

export function ChatPanel({ onClose }: { onClose: () => void }) {
  const { rootParam, activeProject, selectedDoc } = useApp()
  const pathname = usePathname()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const sessionRef = useRef<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  // Accept/reject outcomes the agent hasn't heard about yet; sent with the next message
  const notesRef = useRef<string[]>([])

  const docPath = pathname === "/docs" ? selectedDoc?.path : undefined

  // A Claude session belongs to one project
  useEffect(() => {
    abortRef.current?.abort()
    sessionRef.current = null
    notesRef.current = []
    setMessages([])
  }, [activeProject])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  // askAgent() from the roadmap: send it now, or refuse while a turn runs (no queue).
  // No deps on purpose: re-subscribes each render so the handler sees the current `busy`/`send`.
  useEffect(() => {
    function onAsk(e: Event) {
      const message = (e as CustomEvent<{ message: string }>).detail?.message
      if (!message) return
      if (busy) setNotice("Agent is busy. Try again when this turn finishes.")
      else send(message)
    }
    window.addEventListener(ASK_AGENT_EVENT, onAsk)
    return () => window.removeEventListener(ASK_AGENT_EVENT, onAsk)
  })

  function patchLast(fn: (m: ChatMessage) => ChatMessage) {
    setMessages((prev) => [...prev.slice(0, -1), fn(prev[prev.length - 1])])
  }

  // Handles one line of `claude -p --output-format stream-json`
  function handleEvent(ev: any) {
    if (ev.session_id) sessionRef.current = ev.session_id
    if (ev.type === "stream_event") {
      const e = ev.event
      if (e?.type === "message_start") {
        patchLast((m) => (m.text && !m.text.endsWith("\n\n") ? { ...m, text: m.text + "\n\n" } : m))
      } else if (e?.type === "content_block_delta" && e.delta?.type === "text_delta") {
        patchLast((m) => ({ ...m, text: m.text + e.delta.text }))
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
        patchLast((m) => ({
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
        patchLast((m) => ({
          ...m,
          proposals: m.proposals.filter((p) => !failed.has(p.id)),
          plans: m.plans.filter((p) => !failed.has(p.id)),
          questions: m.questions.filter((q) => !failed.has(q.id)),
        }))
      }
    } else if (ev.type === "result" && ev.is_error) {
      patchLast((m) => ({ ...m, error: ev.result ?? ev.subtype ?? "Agent error" }))
    } else if (ev.type === "error") {
      patchLast((m) => ({ ...m, error: ev.message }))
    }
  }

  // `text` is a message built by a card (question answers); otherwise send what's typed
  async function send(text?: string) {
    const message = (text ?? input).trim()
    if (!message || busy) return
    if (text === undefined) setInput("")
    setNotice(null)
    setBusy(true)
    setMessages((prev) => [
      ...prev,
      { role: "user", text: message, tools: [], proposals: [], plans: [], questions: [] },
      { role: "assistant", text: "", tools: [], proposals: [], plans: [], questions: [] },
    ])
    const notes = notesRef.current.splice(0)
    const outgoing = notes.length ? `[${notes.join(" ")}]\n\n${message}` : message
    const ac = new AbortController()
    abortRef.current = ac
    try {
      const res = await fetch(`/api/chat${rootParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: outgoing, sessionId: sessionRef.current, docPath }),
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
          try { handleEvent(JSON.parse(line)) } catch { /* partial or non-JSON line */ }
        }
      }
    } catch (e) {
      if (!ac.signal.aborted) patchLast((m) => ({ ...m, error: (e as Error).message }))
    } finally {
      setBusy(false)
    }
  }

  function newChat() {
    abortRef.current?.abort()
    sessionRef.current = null
    notesRef.current = []
    setMessages([])
  }

  function resolveProposal(id: string, path: string, status: ProposalStatus) {
    notesRef.current.push(`User ${status} your proposed edit to ${path}.`)
    setMessages((prev) => prev.map((m) => ({
      ...m,
      proposals: m.proposals.map((p) => (p.id === id ? { ...p, status } : p)),
    })))
  }

  function resolvePlan(p: PlanProposal, status: PlanStatus, created: PlanCreated[], unchecked: string[]) {
    const epic = p.plan.kind === "breakdown" ? planTarget(p.plan) : "the roadmap"
    notesRef.current.push(status === "accepted"
      ? `User accepted plan for ${epic}: created ${created.map((c) => c.id).join(", ")}${unchecked.length ? ` (unchecked: ${unchecked.join(", ")})` : ""}.`
      : `User rejected the plan for ${epic}.`)
    setMessages((prev) => prev.map((m) => ({
      ...m,
      plans: m.plans.map((x) => (x.id === p.id ? { ...x, status, created } : x)),
    })))
  }

  function answerQuestions(set: QuestionSet, answers: string[]) {
    if (busy) return
    setMessages((prev) => prev.map((m) => ({
      ...m,
      questions: m.questions.map((q) => (q.id === set.id ? { ...q, answers } : q)),
    })))
    send(formatAnswers(set.questions, answers))
  }

  // Only the latest reply counts: once the user types past a card, it no longer blocks the hint
  const questionsPending = !!messages[messages.length - 1]?.questions.some((q) => !q.answers)

  return (
    <aside className="w-[380px] h-full border-l border-border bg-surface flex flex-col">
      <div className="h-10 px-3 flex items-center gap-2 border-b border-border">
        <span className="text-xs font-mono uppercase tracking-widest text-muted">Agent</span>
        <div className="flex-1" />
        <button onClick={newChat} className="text-xs text-muted hover:text-txt">New chat</button>
        <button onClick={onClose} className="text-muted hover:text-txt text-lg leading-none" aria-label="Close chat">×</button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 text-sm">
        {messages.length === 0 && (
          <p className="text-muted text-xs">
            Ask the agent to read, write or restructure docs. Runs on your local Claude Code login.
          </p>
        )}
        {messages.map((m, i) => (
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
                  <ProposalCard key={p.id} proposal={p} onResolve={(status) => resolveProposal(p.id, p.path, status)} />
                ))}
                {m.plans.map((p) => (
                  <PlanCard key={p.id} proposal={p} onResolve={(status, created, unchecked) => resolvePlan(p, status, created, unchecked)} />
                ))}
                {m.questions.map((q) => (
                  <QuestionCard key={q.id} set={q} disabled={busy} onSubmit={(answers) => answerQuestions(q, answers)} />
                ))}
                {m.text && <MarkdownRenderer content={m.text} className="text-sm" />}
                {!m.text && !m.error && busy && i === messages.length - 1 && (
                  <span className="text-muted text-xs">Thinking…</span>
                )}
                {m.error && <p className="text-red-400 text-xs whitespace-pre-wrap">{m.error}</p>}
              </>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-border p-2">
        {notice && <div className="text-[11px] text-amber px-1 pb-1">{notice}</div>}
        {docPath && <div className="text-[10px] font-mono text-muted px-1 pb-1 truncate">@ {docPath}</div>}
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              send()
            }
          }}
          rows={3}
          placeholder={busy ? "Agent is working…" : questionsPending ? "Answer the questions above…" : "Ask the agent… (Enter to send)"}
          className="w-full resize-none rounded-md bg-surface2 border border-border px-2 py-1.5 text-sm text-txt placeholder:text-muted focus:outline-hidden focus:border-accent"
        />
      </div>
    </aside>
  )
}
