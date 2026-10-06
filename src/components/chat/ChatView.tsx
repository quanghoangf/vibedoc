"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { ArrowUp, ArrowUpRight, Maximize2, Square, Trash2 } from "lucide-react"
import { useApp } from "@/context/AppContext"
import { useChats, type ChatMessage, type ChatTab } from "@/context/ChatContext"
import { useT } from "@/context/LanguageContext"
import { MarkdownRenderer } from "@/components/docs/MarkdownRenderer"
import { cn } from "@/lib/utils"
import { chatStatus, suggestions } from "@/lib/chats"
import { useChatText } from "./chat-text"
import { ProposalCard, type ProposalStatus } from "./ProposalCard"
import { PlanCard, type PlanCreated, type PlanProposal, type PlanStatus } from "./PlanCard"
import { QuestionCard, type QuestionSet } from "./QuestionCard"
import { AttachLabel, StatusMarker, attachHref } from "./StatusMarker"

/**
 * One conversation. The chat modal and the /chat page both render this, so they are the same chat UI.
 * Chats shown here before stay mounted (hidden) so card state, e.g. unchecked plan rows, survives switching.
 */
export function ChatView({ chatId, variant, onExpand, onNavigate }: {
  chatId: string
  variant: "modal" | "page"
  /** Modal: open this chat as a page */
  onExpand?: () => void
  /** Called before following a link out of the chat (the modal closes itself) */
  onNavigate?: () => void
}) {
  const { chats, stop, remove, notice, dismissNotice } = useChats()
  const router = useRouter()
  const { t } = useT()
  const text = useChatText()
  const chat = chats.find((c) => c.id === chatId)
  // Adjust-state-during-render: remember every chat this view has shown
  const [mounted, setMounted] = useState<string[]>([chatId])
  if (!mounted.includes(chatId)) setMounted([...mounted, chatId])

  if (!chat) {
    return <div className="grid h-full place-items-center p-8 text-sm text-muted">{t("chat.chatClosed")}</div>
  }

  const status = chatStatus(chat)
  const go = (href: string) => { onNavigate?.(); router.push(href) }

  return (
    <section aria-label={t("chat.chatLabel", { title: chat.title })} className="flex h-full min-h-0 flex-col">
      <header className={cn("flex h-14 shrink-0 items-center gap-3 border-b border-border px-5", variant === "modal" && "pr-14")}>
        <StatusMarker status={status} showIdle />
        <div className="min-w-0 flex-1">
          <h2 data-user-content className="truncate text-sm font-medium text-txt">{text.title(chat.title)}</h2>
          <p className="font-mono text-[10px] text-muted">{text.status(status)}</p>
        </div>
        {chat.attach && (
          <button
            type="button"
            onClick={() => chat.attach && go(attachHref(chat.attach))}
            title={t(chat.attach.kind === "epic" ? "chat.openInRoadmap" : "chat.openInBoard", { id: chat.attach.id })}
            className="rounded-full border border-border px-2 py-1 text-muted transition-colors duration-(--duration-fast) hover:border-accent/50 hover:text-accent"
          >
            <AttachLabel attach={chat.attach} />
          </button>
        )}
        {chat.busy && (
          <button type="button" onClick={() => stop(chat.id)} title={t("chat.stopAgent")} className={ICON_BTN}>
            <Square className="size-3.5 fill-current" />
            <span className="sr-only">{t("chat.stop")}</span>
          </button>
        )}
        {variant === "modal" && onExpand && (
          <button type="button" onClick={onExpand} title={t("chat.openAsPage")} className={ICON_BTN}>
            <Maximize2 className="size-3.5" />
            <span className="sr-only">{t("chat.openAsPage")}</span>
          </button>
        )}
        {variant === "page" && (
          <button type="button" onClick={() => remove(chat.id)} aria-label={t("chat.deleteTitle", { title: chat.title })} title={t("chat.deleteChat")} className={cn(ICON_BTN, "hover:text-danger")}>
            <Trash2 className="size-3.5" />
          </button>
        )}
      </header>

      {mounted.map((id) => {
        const c = chats.find((x) => x.id === id)
        return c ? <Conversation key={id} chat={c} hidden={id !== chatId} wide={variant === "page"} /> : null
      })}

      {notice && (
        <div role="status" className="mx-5 mb-2 flex items-start gap-2 rounded-md border border-amber/30 bg-amber/10 px-3 py-2 text-xs text-amber animate-fade-in">
          <span className="flex-1">{text.notice(notice)}</span>
          <button onClick={dismissNotice} aria-label={t("chat.dismiss")} className="leading-none text-muted hover:text-txt">×</button>
        </div>
      )}
      <Composer key={chat.id} chat={chat} wide={variant === "page"} />
    </section>
  )
}

const ICON_BTN = "grid size-8 shrink-0 place-items-center rounded-md text-muted transition-colors duration-(--duration-fast) hover:bg-surface2 hover:text-txt"

function Conversation({ chat, hidden, wide }: { chat: ChatTab; hidden: boolean; wide: boolean }) {
  const { send, resolveProposal, resolvePlan, answerQuestions } = useChats()
  const scrollRef = useRef<HTMLDivElement>(null)
  const messages = chat.messages

  // Follow the stream while visible
  useEffect(() => {
    const el = scrollRef.current
    if (el && !hidden) el.scrollTop = el.scrollHeight
  }, [messages, hidden])

  return (
    <div ref={scrollRef} hidden={hidden} role="log" aria-live="polite" className="min-h-0 flex-1 overflow-y-auto">
      <div className={cn("mx-auto flex flex-col gap-5 px-5 py-6 text-sm", wide ? "max-w-3xl" : "max-w-none")}>
        {messages.length === 0 && <EmptyChat chat={chat} onPick={(s) => send(chat.id, s)} />}
        {messages.map((m, i) => (
          <Message
            key={i}
            m={m}
            thinking={chat.busy && i === messages.length - 1}
            busy={chat.busy}
            onProposal={(id, path, status) => resolveProposal(chat.id, id, path, status)}
            onPlan={(p, status, created, unchecked) => resolvePlan(chat.id, p, status, created, unchecked)}
            onAnswers={(set, answers) => answerQuestions(chat.id, set, answers)}
          />
        ))}
      </div>
    </div>
  )
}

function Message({ m, thinking, busy, onProposal, onPlan, onAnswers }: {
  m: ChatMessage
  thinking: boolean
  busy: boolean
  onProposal: (id: string, path: string, status: ProposalStatus) => void
  onPlan: (p: PlanProposal, status: PlanStatus, created: PlanCreated[], unchecked: string[]) => void
  onAnswers: (set: QuestionSet, answers: string[]) => void
}) {
  const chatText = useChatText()
  if (m.role === "user") {
    return (
      <div className="flex justify-end animate-fade-in">
        <div data-user-content className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md border border-accent/20 bg-accent/10 px-3.5 py-2 text-txt">
          {m.text}
        </div>
      </div>
    )
  }
  return (
    <div className="flex gap-3 animate-fade-in">
      <div className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-linear-to-br from-accent to-teal text-[10px] text-white" aria-hidden>⬡</div>
      <div className="min-w-0 flex-1 space-y-2">
        {m.tools.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {m.tools.map((tool, j) => (
              <span key={j} data-user-content className="rounded-sm border border-border bg-surface2 px-1.5 py-0.5 font-mono text-[10px] text-muted animate-slide-in">{tool}</span>
            ))}
          </div>
        )}
        {m.proposals.map((p) => (
          <ProposalCard key={p.id} proposal={p} onResolve={(status) => onProposal(p.id, p.path, status)} />
        ))}
        {m.plans.map((p) => (
          <PlanCard key={p.id} proposal={p} onResolve={(status, created, unchecked) => onPlan(p, status, created, unchecked)} />
        ))}
        {m.questions.map((q) => (
          <QuestionCard key={q.id} set={q} disabled={busy} onSubmit={(answers) => onAnswers(q, answers)} />
        ))}
        {m.text && <div data-user-content><MarkdownRenderer content={m.text} className="text-sm" /></div>}
        {thinking && !m.text && !m.error && <Thinking />}
        {m.error && <p data-user-content className="whitespace-pre-wrap text-xs text-danger">{chatText.error(m.error)}</p>}
      </div>
    </div>
  )
}

function Thinking() {
  const { t } = useT()
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted">
      <span className="inline-flex gap-1" aria-hidden>
        {[0, 150, 300].map((d) => (
          <span key={d} className="size-1.5 rounded-full bg-accent animate-pulse-dot" style={{ animationDelay: `${d}ms` }} />
        ))}
      </span>
      {t("chat.thinking")}
    </span>
  )
}

function EmptyChat({ chat, onPick }: { chat: ChatTab; onPick: (s: string) => void }) {
  const a = chat.attach
  const { t } = useT()
  const text = useChatText()
  return (
    <div className="flex flex-col items-start gap-4 py-6 animate-fade-in">
      <div className="grid size-9 place-items-center rounded-lg bg-linear-to-br from-accent to-teal text-sm text-white" aria-hidden>⬡</div>
      <div>
        <h3 className="text-lg font-semibold text-txt">{a ? t("chat.askAbout", { id: a.id }) : t("chat.askAgent")}</h3>
        <p className="mt-1 max-w-md text-sm text-muted">
          {t(a ? (a.kind === "epic" ? "chat.readsEpic" : "chat.readsTask") : "chat.readsAll")}
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        {suggestions(a).map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            style={{ animationDelay: `${60 * i}ms` }}
            className="group flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-left text-sm text-txt/90 transition-colors duration-(--duration-fast) animate-slide-in [animation-fill-mode:both] hover:border-accent/50 hover:bg-accent/5"
          >
            <ArrowUpRight className="size-3.5 text-muted transition-transform duration-(--duration-fast) group-hover:-translate-y-px group-hover:translate-x-px group-hover:text-accent" />
            {text.suggestion(s)}
          </button>
        ))}
      </div>
    </div>
  )
}

function Composer({ chat, wide }: { chat: ChatTab; wide: boolean }) {
  const { send, stop, queue } = useChats()
  const { selectedDoc } = useApp()
  const { t } = useT()
  const pathname = usePathname()
  const [input, setInput] = useState("")
  const docPath = pathname === "/docs" ? selectedDoc?.path : undefined
  const last = chat.messages[chat.messages.length - 1]
  const questionsPending = !!last?.questions.some((q) => !q.answers)
  const rows = Math.min(8, Math.max(1, input.split("\n").length))

  function submit() {
    if (!input.trim() || chat.busy) return
    send(chat.id, input)
    setInput("")
  }

  return (
    <div className="shrink-0 px-5 pb-4 pt-1">
      <div className={cn("mx-auto rounded-xl border border-border bg-surface2 transition-[border-color,box-shadow] duration-(--duration-base) focus-within:border-accent/60 focus-within:shadow-[0_0_0_3px_rgb(var(--rgb-accent)/0.12)]", wide ? "max-w-3xl" : "max-w-none")}>
        <textarea
          // Not for a queued chat, so a second `c` walks the queue instead of typing into the composer
          autoFocus={!queue.some((q) => q.id === chat.id)}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit()
            }
          }}
          rows={rows}
          placeholder={t(chat.busy ? "chat.agentIsWorking" : questionsPending ? "chat.answerAbove" : "chat.askPlaceholder")}
          className="block w-full resize-none bg-transparent px-3.5 pt-3 text-sm text-txt placeholder:text-muted focus:outline-hidden"
        />
        <div className="flex items-center gap-2 px-2.5 pb-2 pt-1">
          <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-muted">
            {docPath ? `@ ${docPath}` : t("chat.newLineHint")}
          </span>
          {chat.busy ? (
            <button type="button" onClick={() => stop(chat.id)} title={t("chat.stopAgent")} className="grid size-7 place-items-center rounded-full border border-border text-muted transition-colors hover:text-txt">
              <Square className="size-3 fill-current" />
              <span className="sr-only">{t("chat.stop")}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!input.trim()}
              title={t("chat.sendKey")}
              className="grid size-7 place-items-center rounded-full bg-accent text-accent-fg transition-[opacity,transform] duration-(--duration-fast) enabled:hover:scale-105 disabled:opacity-30"
            >
              <ArrowUp className="size-3.5" />
              <span className="sr-only">{t("chat.send")}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
