"use client"

import { useState, useEffect, useId, useMemo, useRef } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { X, Plus, Loader2, ImagePlus, Bot } from "lucide-react"
import { cn } from "@/lib/utils"
import { useT } from "@/context/LanguageContext"
import { useApp } from "@/context/AppContext"
import { StatusIcon } from "@/components/shared/StatusIcon"
import { PriorityBadge } from "@/components/shared/PriorityBadge"
import { PRIORITIES, type Priority } from "@/lib/doc-priority"
import { displayStatus } from "@/lib/statuses"
import { MAX_IMAGE_BYTES, IMAGE_MIME } from "@/lib/attachments"
import { askAgent, taskDraftPrompt } from "@/lib/ask-agent"
import type { MessageKey } from "@/i18n"
import type { RoadmapItem } from "@/types"

interface NewTaskModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rootParam: string
  onTaskCreated: () => void
}

// The value is written to the task file as is (English, like every **Key:** line); only the label is translated
const SIZE_OPTIONS: { short: string; value: string; label: MessageKey }[] = [
  { short: "XS", value: "XS (< 1 hr)", label: "board.sizeXS" },
  { short: "S", value: "S (1-2 hrs)", label: "board.sizeS" },
  { short: "M", value: "M (3-4 hrs)", label: "board.sizeM" },
  { short: "L", value: "L (5-8 hrs)", label: "board.sizeL" },
  { short: "XL", value: "XL (> 1 day)", label: "board.sizeXL" },
]
const IMAGE_TYPES = new Set(Object.values(IMAGE_MIME))

interface Draft {
  title: string
  epic: string | null
  deps: string[]
  size: string
  priority: Priority | null
  description: string
  images: File[]
}
const EMPTY: Draft = { title: "", epic: null, deps: [], size: "", priority: null, description: "", images: [] }

// "Start with agent" keeps the draft here until the modal opens again (this browser session only), so a cancelled chat loses nothing
let keptDraft: Draft | null = null

const label = "block text-xs font-medium text-muted uppercase tracking-wide"
const field = "w-full px-3 py-2 bg-surface2 border border-border rounded-lg text-sm text-txt placeholder:text-muted focus:outline-hidden focus:border-accent transition-colors"

export function NewTaskModal({ open, onOpenChange, rootParam, onTaskCreated }: NewTaskModalProps) {
  const { t } = useT()
  const { board, playground } = useApp()
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [epics, setEpics] = useState<RoadmapItem[]>([])
  const [error, setError] = useState("")
  const [busy, setBusy] = useState<"" | "create" | "agent">("")
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))

  // Each open starts from the kept draft or a blank form (adjusted during render, not in an effect)
  const [wasOpen, setWasOpen] = useState(false)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setDraft(keptDraft ?? EMPTY)
      setError("")
      setBusy("")
    }
  }

  useEffect(() => {
    if (!open) return
    keptDraft = null
    fetch(`/api/roadmap${rootParam}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { items?: RoadmapItem[] } | null) => setEpics((data?.items ?? []).filter((i) => i.parent && i.status !== "done")))
      .catch(() => setEpics([]))
  }, [open, rootParam])

  const tasks = useMemo(() => (board ? Object.values(board).flat() : []).sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true })), [board])
  const previews = useMemo(() => draft.images.map((f) => URL.createObjectURL(f)), [draft.images])
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews])

  function addImages(files: File[]) {
    if (!files.length) return
    if (playground) { setError(t("board.uploadsInDemo")); return }
    const ok: File[] = []
    for (const f of files) {
      if (f.size > MAX_IMAGE_BYTES) setError(t("board.imageTooLarge", { name: f.name || "image" }))
      else if (!IMAGE_TYPES.has(f.type)) setError(t("board.imageType", { name: f.name || "file" }))
      else ok.push(f)
    }
    if (ok.length === files.length) setError("")
    if (ok.length) setDraft((d) => ({ ...d, images: [...d.images, ...ok] }))
  }

  async function apiError(res: Response): Promise<string> {
    const data = await res.json().catch(() => null)
    return typeof data?.error === "string" ? data.error : (data?.error?.message ?? t("board.createFailed"))
  }

  async function create() {
    if (!draft.title.trim()) { setError(t("board.titleRequired")); return }
    setBusy("create")
    setError("")
    const task = {
      title: draft.title.trim(),
      epic: draft.epic ?? undefined,
      size: draft.size || undefined,
      priority: draft.priority ?? undefined,
      description: draft.description.trim() || undefined,
      dependsOn: draft.deps.join(", ") || undefined,
    }
    try {
      let body: BodyInit
      let headers: HeadersInit | undefined
      if (draft.images.length) {
        const form = new FormData()
        form.append("task", JSON.stringify(task))
        for (const f of draft.images) form.append("image", f)
        body = form
      } else {
        body = JSON.stringify(task)
        headers = { "Content-Type": "application/json" }
      }
      const res = await fetch(`/api/tasks/create${rootParam}`, { method: "POST", headers, body })
      if (!res.ok) { setError(await apiError(res)); setBusy(""); return }
      setBusy("")
      setDraft(EMPTY)
      onTaskCreated()
      onOpenChange(false)
    } catch {
      setError(t("board.networkError"))
      setBusy("")
    }
  }

  // The chat agent can't read the browser's files: images go to a draft folder first, then the prompt names them
  async function startWithAgent() {
    setError("")
    let images: string[] = []
    if (draft.images.length) {
      setBusy("agent")
      try {
        const form = new FormData()
        for (const f of draft.images) form.append("image", f)
        const res = await fetch(`/api/tasks/attachments${rootParam}`, { method: "POST", body: form })
        if (!res.ok) { setError(await apiError(res)); setBusy(""); return }
        images = ((await res.json())?.paths as string[] | undefined) ?? []
      } catch {
        setError(t("board.networkError"))
        setBusy("")
        return
      }
    }
    setBusy("")
    keptDraft = draft
    askAgent(taskDraftPrompt({
      title: draft.title.trim(), epic: draft.epic, dependsOn: draft.deps, size: draft.size,
      priority: draft.priority, description: draft.description, images,
    }), { newChat: true, open: true })
    onOpenChange(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-2xl max-h-[calc(100svh-2rem)] flex flex-col bg-surface border border-border rounded-xl shadow-2xl"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <Dialog.Title className="font-semibold text-txt">{t("board.newTaskDialog")}</Dialog.Title>
            <Dialog.Close aria-label={t("board.close")} className="text-muted hover:text-txt transition-colors">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); void create() }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); if (!busy) void create() }
            }}
            className="p-5 space-y-4 overflow-y-auto"
          >
            <div className="space-y-1.5">
              <label htmlFor="new-task-title" className={label}>
                {t("board.title")} <span className="text-danger">*</span>
              </label>
              <input
                id="new-task-title"
                autoFocus
                type="text"
                value={draft.title}
                onChange={(e) => set({ title: e.target.value })}
                placeholder={t("board.titlePlaceholder")}
                className={field}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Combo
                label={t("board.epic")}
                placeholder={t("board.searchEpics")}
                options={[
                  { value: "", text: t("board.noEpic"), node: <span className="text-muted">{t("board.noEpic")}</span> },
                  ...epics.map((e) => ({ value: e.id, text: `${e.id} ${e.title}`, node: <><span className="font-mono text-xs text-muted">{e.id}</span><span className="truncate">{e.title}</span></> })),
                ]}
                selected={draft.epic ? [draft.epic] : []}
                onPick={(v) => set({ epic: v || null })}
                chip={(v) => { const e = epics.find((x) => x.id === v); return <><span className="font-mono text-xs text-muted">{v}</span><span className="truncate">{e?.title}</span></> }}
                onRemove={() => set({ epic: null })}
              />
              <Combo
                label={t("board.dependsOn")}
                placeholder={t("board.searchTasks")}
                multiple
                options={tasks.filter((x) => !draft.deps.includes(x.id)).map((x) => ({
                  value: x.id, text: `${x.id} ${x.title}`,
                  node: <><StatusIcon status={displayStatus(x)} /><span className="font-mono text-xs text-muted">{x.id}</span><span className="truncate">{x.title}</span></>,
                }))}
                selected={draft.deps}
                onPick={(v) => set({ deps: [...draft.deps, v] })}
                chip={(v) => { const x = tasks.find((k) => k.id === v); return <>{x && <StatusIcon status={displayStatus(x)} />}<span className="font-mono text-xs">{v}</span></> }}
                onRemove={(v) => set({ deps: draft.deps.filter((d) => d !== v) })}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Segmented
                label={t("board.size")}
                options={SIZE_OPTIONS.map((o) => ({ value: o.value, node: o.short, title: t(o.label) }))}
                value={draft.size}
                onChange={(v) => set({ size: v })}
              />
              <Segmented
                label={t("board.priority")}
                options={PRIORITIES.map((p) => ({ value: p, node: <PriorityBadge priority={p} className="bg-transparent" />, title: p }))}
                value={draft.priority ?? ""}
                onChange={(v) => set({ priority: (v || null) as Priority | null })}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="new-task-description" className={label}>{t("board.description")}</label>
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="inline-flex items-center gap-1 text-xs text-muted hover:text-txt focus-visible:text-txt transition-colors"
                >
                  <ImagePlus className="size-3.5" aria-hidden />
                  {t("board.attachImage")}
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  accept={[...IMAGE_TYPES].join(",")}
                  multiple
                  hidden
                  aria-label={t("board.attachImage")}
                  onChange={(e) => { addImages(Array.from(e.target.files ?? [])); e.target.value = "" }}
                />
              </div>
              <textarea
                id="new-task-description"
                value={draft.description}
                onChange={(e) => set({ description: e.target.value })}
                onPaste={(e) => {
                  const files = Array.from(e.clipboardData.files)
                  if (files.length) { e.preventDefault(); addImages(files) }
                }}
                onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDragging(true) } }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  if (!e.dataTransfer.files.length) return
                  e.preventDefault()
                  setDragging(false)
                  addImages(Array.from(e.dataTransfer.files))
                }}
                placeholder={t("board.descriptionPlaceholder")}
                aria-describedby="new-task-description-hint"
                rows={7}
                className={cn(field, "resize-y min-h-32", dragging && "border-accent")}
              />
              <p id="new-task-description-hint" className="text-xs text-muted">{t("board.descriptionHint")}</p>
              {draft.images.length > 0 && (
                <ul className="flex flex-wrap gap-2" aria-label={t("board.attachments")}>
                  {draft.images.map((f, i) => (
                    <li key={i} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element -- a local blob preview */}
                      <img src={previews[i]} alt={t("board.attachmentN", { n: i + 1 })} className="size-20 rounded-md border border-border object-cover" />
                      <button
                        type="button"
                        aria-label={t("board.removeImage", { n: i + 1 })}
                        onClick={() => set({ images: draft.images.filter((_, k) => k !== i) })}
                        className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full border border-border bg-surface text-muted hover:text-txt"
                      >
                        <X className="size-3" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {error && <p role="alert" className="text-sm text-danger">{error}</p>}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => void startWithAgent()}
                disabled={!!busy || (!draft.title.trim() && !draft.description.trim())}
                className="mr-auto inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-txt hover:bg-surface2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {busy === "agent" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Bot className="size-4" aria-hidden />}
                {t("board.startWithAgent")}
              </button>
              <Dialog.Close type="button" className="px-4 py-2 text-sm text-muted hover:text-txt transition-colors">
                {t("board.cancel")}
              </Dialog.Close>
              <button
                type="submit"
                disabled={!!busy || !draft.title.trim()}
                title={t("board.createShortcut")}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  "bg-accent text-accent-fg hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {busy === "create" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {busy === "create" ? t("board.creating") : t("board.createTask")}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** Toggle buttons; pressing the current one clears it. */
function Segmented({ label: text, options, value, onChange }: {
  label: string
  options: { value: string; node: React.ReactNode; title: string }[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-1.5" role="group" aria-label={text}>
      <span className={label} aria-hidden>{text}</span>
      <div className="flex rounded-lg border border-border bg-surface2 p-0.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            title={o.title}
            aria-label={o.title}
            aria-pressed={value === o.value}
            onClick={() => onChange(value === o.value ? "" : o.value)}
            className={cn(
              "flex-1 rounded-md px-2 py-1 font-mono text-xs transition-colors focus-visible:outline-2 focus-visible:outline-accent",
              value === o.value ? "bg-surface text-txt shadow-sm" : "text-muted hover:text-txt"
            )}
          >
            {o.node}
          </button>
        ))}
      </div>
    </div>
  )
}

interface ComboOption { value: string; text: string; node: React.ReactNode }

/** A searchable list for the modal: type to filter, ↑↓ to move, Enter to pick, Backspace on an empty search removes the last pick. */
function Combo({ label: text, placeholder, options, selected, multiple = false, onPick, onRemove, chip }: {
  label: string
  placeholder: string
  options: ComboOption[]
  selected: string[]
  multiple?: boolean
  onPick: (value: string) => void
  onRemove: (value: string) => void
  chip: (value: string) => React.ReactNode
}) {
  const { t } = useT()
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const id = `combo${useId().replace(/:/g, "")}`
  const q = query.trim().toLowerCase()
  const shown = (q ? options.filter((o) => o.text.toLowerCase().includes(q)) : options).slice(0, 50)
  const at = Math.min(active, Math.max(shown.length - 1, 0))

  function pick(o: ComboOption | undefined) {
    if (!o) return
    onPick(o.value)
    setQuery("")
    setActive(0)
    if (!multiple) setOpen(false)
  }

  return (
    <div className="relative space-y-1.5">
      <label htmlFor={id} className={label}>{text}</label>
      <div className={cn(field, "flex flex-wrap items-center gap-1 py-1.5 focus-within:border-accent")}>
        {selected.map((v) => (
          <span key={v} className="inline-flex max-w-full items-center gap-1 rounded-sm bg-surface px-1.5 py-0.5 text-xs">
            {chip(v)}
            <button type="button" aria-label={t("board.removeValue", { value: v })} onClick={() => onRemove(v)} className="text-muted hover:text-txt">
              <X className="size-3" aria-hidden />
            </button>
          </span>
        ))}
        {(
          <input
            id={id}
            role="combobox"
            aria-expanded={open}
            aria-controls={`${id}-list`}
            aria-activedescendant={open && shown[at] ? `${id}-${at}` : undefined}
            autoComplete="off"
            value={query}
            placeholder={selected.length ? "" : placeholder}
            onChange={(e) => { setQuery(e.target.value); setActive(0); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((at + 1) % Math.max(shown.length, 1)) }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActive((at - 1 + shown.length) % Math.max(shown.length, 1)) }
              else if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) { e.preventDefault(); if (open) pick(shown[at]) }
              else if (e.key === "Backspace" && !query && selected.length) onRemove(selected[selected.length - 1])
            }}
            className="min-w-24 flex-1 bg-transparent py-0.5 text-sm outline-hidden placeholder:text-muted"
          />
        )}
      </div>
      {open && (
        <ul id={`${id}-list`} role="listbox" aria-label={text} className="absolute inset-x-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-xl">
          {shown.length === 0 && <li className="px-3 py-1.5 text-xs text-muted">{t("board.noMatches")}</li>}
          {shown.map((o, i) => (
            <li
              key={o.value || "none"}
              id={`${id}-${i}`}
              role="option"
              aria-selected={i === at}
              onMouseDown={(e) => { e.preventDefault(); pick(o) }}
              onMouseEnter={() => setActive(i)}
              className={cn("flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm", i === at && "bg-surface2")}
            >
              {o.node}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
