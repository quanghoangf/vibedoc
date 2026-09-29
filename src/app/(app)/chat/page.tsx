"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Plus, Search, X } from "lucide-react"
import { useChats, type ChatTab } from "@/context/ChatContext"
import { ChatView } from "@/components/chat/ChatView"
import { ChatContextRail } from "@/components/chat/ChatContextRail"
import { AttachLabel, StatusMarker } from "@/components/chat/StatusMarker"
import { ago, chatStatus, defaultChat, groupChats, suggestions } from "@/lib/chats"
import { useMinute } from "@/hooks/use-minute"
import { cn } from "@/lib/utils"

export default function ChatPage() {
  // main has no fixed height; the columns need one (viewport minus the h-12 AppHeader)
  return (
    <div className="flex h-[calc(100svh-3rem)] min-h-0">
      <Suspense>
        <ChatPageInner />
      </Suspense>
    </div>
  )
}

function ChatPageInner() {
  const { chats, loaded, create, show, send } = useChats()
  const router = useRouter()
  const param = useSearchParams().get("id")
  const selected = chats.find((c) => c.id === param) ?? (param ? undefined : defaultChat(chats))

  function startWith(text?: string) {
    const id = create()
    show(id)
    if (text) send(id, text)
  }

  return (
    <>
      <ChatList selectedId={selected?.id ?? null} onNew={() => startWith()} />

      <section className="flex min-w-0 flex-1 flex-col border-r border-border bg-bg">
        {selected ? (
          <div key={selected.id} className="flex min-h-0 flex-1 flex-col animate-fade-in">
            <ChatView chatId={selected.id} variant="page" />
          </div>
        ) : loaded ? (
          <NoChat
            missing={!!param}
            onStart={startWith}
            onBack={() => router.replace("/chat")}
          />
        ) : null}
      </section>

      <aside className="hidden w-80 shrink-0 bg-surface xl:block" aria-label="Chat context">
        <ChatContextRail attach={selected?.attach ?? null} />
      </aside>
    </>
  )
}

function ChatList({ selectedId, onNew }: { selectedId: string | null; onNew: () => void }) {
  const { chats } = useChats()
  const [query, setQuery] = useState("")
  const q = query.trim().toLowerCase()
  const shown = q ? chats.filter((c) => c.title.toLowerCase().includes(q) || c.attach?.id.toLowerCase().includes(q)) : chats
  const g = groupChats(shown)
  const sections = [
    { label: "Needs you", items: g.needsYou, tone: "text-amber" },
    { label: "Running", items: g.running, tone: "text-accent" },
    { label: "Recent", items: g.recent, tone: "text-muted" },
  ]

  return (
    <aside className="hidden w-72 shrink-0 flex-col border-r border-border bg-surface md:flex" aria-label="All chats">
      <div className="flex items-center gap-2 px-4 pb-3 pt-4">
        <h1 className="flex-1 text-sm font-semibold text-txt">Agents</h1>
        <button
          type="button"
          onClick={onNew}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1.5 text-xs font-medium text-white transition-[filter,transform] duration-(--duration-fast) hover:brightness-110 active:scale-[0.97]"
        >
          <Plus className="size-3.5" /> New chat
        </button>
      </div>
      {chats.length > 3 && (
        <label className="mx-3 mb-2 flex items-center gap-2 rounded-md border border-border bg-bg px-2.5 py-1.5 text-xs focus-within:border-accent/50">
          <Search className="size-3.5 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by title or R/T id"
            className="min-w-0 flex-1 bg-transparent text-txt placeholder:text-muted focus:outline-hidden"
          />
        </label>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {chats.length === 0 && <p className="px-2 py-6 text-xs text-muted">No chats yet.</p>}
        {sections.map((s) => s.items.length > 0 && (
          <div key={s.label} className="mt-3 first:mt-1">
            <p className={cn("px-2 pb-1 font-mono text-[10px] uppercase tracking-widest", s.tone)}>
              {s.label} · {s.items.length}
            </p>
            <ul className="flex flex-col gap-px">
              {s.items.map((c) => <ChatRow key={c.id} chat={c} active={c.id === selectedId} />)}
            </ul>
          </div>
        ))}
        {q && shown.length === 0 && <p className="px-2 py-6 text-xs text-muted">No chat matches “{query}”.</p>}
      </div>
    </aside>
  )
}

function ChatRow({ chat, active }: { chat: ChatTab; active: boolean }) {
  const { show, remove } = useChats()
  const now = useMinute()
  const status = chatStatus(chat)
  const lastText = [...chat.messages].reverse().find((m) => m.text)?.text.replace(/\s+/g, " ").trim()
  return (
    <li className="group relative animate-slide-in">
      <button
        type="button"
        onClick={() => show(chat.id)}
        aria-current={active ? "true" : undefined}
        className={cn(
          "flex w-full flex-col gap-1 rounded-lg px-2.5 py-2 text-left transition-colors duration-(--duration-fast)",
          active ? "bg-surface2 shadow-[inset_2px_0_0_rgb(var(--rgb-accent))]" : "hover:bg-surface2/60",
        )}
      >
        <span className="flex items-center gap-2 pr-5">
          <StatusMarker status={status} showIdle />
          <span className={cn("min-w-0 flex-1 truncate text-[13px]", status === "idle" && !active ? "text-txt/80" : "text-txt")}>{chat.title}</span>
          {now > 0 && <span className="shrink-0 font-mono text-[10px] text-muted group-hover:opacity-0">{ago(chat.updatedAt, now)}</span>}
        </span>
        {(chat.attach || lastText) && (
          <span className="flex items-center gap-2 pl-5 text-[11px] text-muted">
            {chat.attach && <AttachLabel attach={chat.attach} className="shrink-0" />}
            {lastText && <span className="min-w-0 truncate">{lastText}</span>}
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={() => remove(chat.id)}
        aria-label={`Close ${chat.title}`}
        title={chat.busy ? "Stop and delete chat" : "Delete chat"}
        className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-md text-muted opacity-0 transition-opacity duration-(--duration-fast) hover:bg-surface hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
      >
        <X className="size-3.5" />
      </button>
    </li>
  )
}

function NoChat({ missing, onStart, onBack }: { missing: boolean; onStart: (text?: string) => void; onBack: () => void }) {
  return (
    <div className="grid flex-1 place-items-center p-8">
      <div className="flex max-w-md flex-col items-start gap-4 animate-fade-in">
        <div className="grid size-10 place-items-center rounded-xl bg-linear-to-br from-accent to-teal text-white" aria-hidden>⬡</div>
        {missing ? (
          <>
            <h2 className="text-lg font-semibold text-txt">This chat was deleted</h2>
            <button type="button" onClick={onBack} className="text-sm text-accent hover:underline">Back to all chats</button>
          </>
        ) : (
          <>
            <div>
              <h2 className="text-lg font-semibold text-txt">Run agents side by side</h2>
              <p className="mt-1 text-sm text-muted">
                Each chat is its own Claude Code session, up to 4 at once. Start one here, or from an epic on the roadmap or a task on the board.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              {suggestions(null).map((s) => (
                <button key={s} type="button" onClick={() => onStart(s)} className="rounded-lg border border-border px-3 py-2 text-left text-sm text-txt/90 transition-colors hover:border-accent/50 hover:bg-accent/5">
                  {s}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
