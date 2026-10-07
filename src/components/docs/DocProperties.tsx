"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { BookOpen, Bot, Calendar, CalendarCheck, CalendarClock, CircleDashed, Clock, Flag, FlaskConical, GitBranch, Hash, ListChecks, Map as MapIcon, Plus, Ruler, Trash2, Type, User } from "lucide-react"
import { PropertyRows, type ItemProperty } from "@/components/shared/ItemPanelHeader"
import { PriorityBadge, PriorityField } from "@/components/shared/PriorityBadge"
import { InlineText } from "@/components/shared/InlineProperty"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useFormat, useT } from "@/context/LanguageContext"
import { toast } from "@/components/ui/toast"
import { useApp } from "@/context/AppContext"
import { PRIORITIES, PROPERTY_KEY, docProperties, parsePriority } from "@/lib/doc-priority"
import { TaskDueField, TaskOwnerField, TaskPriorityField, TaskSizeField, TaskStatusField } from "@/components/board/TaskFields"
import { OwnerChip } from "@/components/shared/OwnerChip"
import { TestsRowValue, useDocTask } from "./DocTests"
import type { MetaBlock } from "@/lib/meta-block"
import type { Task } from "@/types"

// A doc's properties, Notion-style: a task / epic file's `**Key:** Value` meta block (T505), its frontmatter
// keys (priority gets a picker, the rest are text), then what VibeDoc knows about it (last edit, length).
// "Add a property" writes a new frontmatter key.

const addRow = "flex h-7 items-center gap-2 rounded-sm px-1.5 -mx-1.5 text-[13px] text-muted outline-hidden transition-colors hover:bg-surface2 hover:text-txt focus-visible:ring-2 focus-visible:ring-accent/60"

/** "due-date" → "Due date"; the file keeps the key as written */
const labelOf = (key: string) => (key.charAt(0).toUpperCase() + key.slice(1)).replace(/[-_]+/g, " ")

export function DocProperties({ path, content, meta = [], lastEdit, words, minutes }: {
  path: string
  /** Live doc text, frontmatter included */
  content: string
  /** The `**Key:** Value` lines under the H1 (`parseMetaBlock(content).entries`); shown first, see `useMetaRows` */
  meta?: MetaBlock["entries"]
  lastEdit?: { actor: "ai" | "human"; at: string } | null
  words: number
  minutes: number
}) {
  const { rootParam, demo } = useApp()
  const f = useFormat()
  const { t } = useT()
  // Shown right away; the file write comes back through the editor buffer a moment later
  const [pending, setPending] = useState<Record<string, string | null>>({})
  // A property being named ("Add a property → Text"), then the key whose value input opens on its own
  const [naming, setNaming] = useState(false)
  const [fresh, setFresh] = useState<string | null>(null)

  const fromFile = docProperties(content)
  const props = new Map(fromFile.map((p) => [p.key.toLowerCase(), p]))
  for (const [k, v] of Object.entries(pending)) {
    if (v === null) props.delete(k.toLowerCase())
    else props.set(k.toLowerCase(), { key: props.get(k.toLowerCase())?.key ?? k, value: v })
  }
  const priority = parsePriority(props.get("priority")?.value)

  async function save(key: string, value: string | null) {
    setPending((p) => ({ ...p, [key]: value }))
    const res = await fetch(`/api/docs${rootParam}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, properties: { [key]: value } }),
    }).catch(() => null)
    if (!res?.ok) toast((await res?.json().catch(() => null))?.error ?? t("docs.couldNotSave", { name: labelOf(key).toLowerCase() }))
    setPending((p) => { const next = { ...p }; delete next[key]; return next })
  }

  function addNamed(name: string | null) {
    setNaming(false)
    const key = name?.trim().toLowerCase().replace(/\s+/g, "-")
    if (!key) return
    if (!PROPERTY_KEY.test(key)) return toast(t("docs.badPropertyName"))
    if (props.has(key.toLowerCase())) return toast(t("docs.alreadyProperty", { name: labelOf(key) }))
    setFresh(key)
  }

  const nameMenu = (key: string, label: string) => demo ? <span className="truncate">{label}</span> : (
    <DropdownMenu>
      <DropdownMenuTrigger className="-mx-1.5 flex h-7 min-w-0 items-center rounded-sm px-1.5 text-left outline-hidden transition-colors hover:bg-surface2 hover:text-txt focus-visible:ring-2 focus-visible:ring-accent/60">
        <span className="truncate">{label}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel className="font-mono text-[10px] font-medium text-muted">{key}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => save(key, null)} className="text-danger focus:text-danger"><Trash2 /> {t("docs.removeProperty")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const rows: ItemProperty[] = useMetaRows(path, meta)
  if (priority) {
    rows.push({ id: "priority", icon: Flag, label: nameMenu("priority", t("board.priority")), value: <PriorityField label={t("board.priorityOf", { id: path })} value={priority} onChange={(v) => save("priority", v)} /> })
  }
  for (const p of props.values()) {
    if (p.key.toLowerCase() === "priority") continue
    rows.push({
      id: p.key, icon: Type, label: nameMenu(p.key, labelOf(p.key)),
      value: <InlineText key={p.value} label={t("docs.propertyOf", { name: labelOf(p.key), path })} value={p.value} onChange={(v) => save(p.key, v)} className="w-full py-1"><span className="truncate">{p.value}</span></InlineText>,
    })
  }
  if (fresh && !props.has(fresh.toLowerCase())) {
    rows.push({
      id: `new:${fresh}`, icon: Type, label: labelOf(fresh),
      value: <InlineText startEditing label={t("docs.propertyOf", { name: labelOf(fresh), path })} value={null} placeholder={t("docs.empty")} onChange={(v) => { setFresh(null); if (v) save(fresh, v) }} onCancel={() => setFresh(null)}><span /></InlineText>,
    })
  }
  if (lastEdit) {
    rows.push({
      id: "edited", icon: Clock, label: t("docs.lastEdited"),
      value: (
        <span className="inline-flex min-w-0 items-center gap-1.5" title={f.dateTime(lastEdit.at)}>
          {lastEdit.actor === "ai" ? <Bot className="size-3.5 text-accent" aria-hidden /> : <User className="size-3.5 text-muted" aria-hidden />}
          {lastEdit.actor === "ai" ? "AI" : t("docs.you")}
          <span className="font-mono text-[11px] text-muted">{f.timeAgo(lastEdit.at)}</span>
        </span>
      ),
    })
  }
  rows.push({ id: "length", icon: BookOpen, label: t("docs.length"), value: <span className="font-mono text-[11px] text-muted">{t("docs.wordsRead", { words: f.number(words), minutes })}</span> })

  return (
    <PropertyRows properties={rows}>
      {demo ? null : naming ? (
        <div className="flex w-full items-center gap-2">
          <Type className="size-3.5 shrink-0 text-muted" aria-hidden />
          <div className="w-40"><InlineText startEditing label={t("docs.newPropertyName")} value={null} placeholder={t("docs.propertyName")} onChange={addNamed} onCancel={() => setNaming(false)}><span /></InlineText></div>
        </div>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger className={addRow}>
            <Plus className="size-3.5" aria-hidden /> {t("docs.addProperty")}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            {!priority && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger><Flag /> {t("board.priority")}</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {PRIORITIES.map((p) => <DropdownMenuItem key={p} onSelect={() => save("priority", p)}><PriorityBadge priority={p} /></DropdownMenuItem>)}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
            <DropdownMenuItem onSelect={() => setNaming(true)}><Type /> {t("docs.text")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </PropertyRows>
  )
}

const EPIC_FILE = /^plans\/roadmap\/(R\d+)[^/]*\.md$/i
const ITEM_ID = /\b[TR]\d+\b/g
const YMD = /^\d{4}-\d{2}-\d{2}$/

/** Task and epic ids in a meta value as chips opening the item: T → /board?task=, R → /roadmap?item= */
function IdChips({ value }: { value: string }) {
  const { t } = useT()
  const ids = value.match(ITEM_ID) ?? []
  if (ids.length === 0) return <span data-user-content className="truncate">{value}</span>
  // "R095 — UI enhancements": one id, keep its name beside the chip
  const rest = ids.length === 1 ? value.replace(ids[0], "").replace(/^\s*[—–:-]\s*/, "").trim() : ""
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1">
      {ids.map((id, i) => (
        <Link key={`${id}-${i}`} href={id.startsWith("T") ? `/board?task=${id}` : `/roadmap?item=${id}`} title={t("docs.openItem", { id })}
          className="rounded-sm border border-border bg-surface2 px-1.5 font-mono text-[11px] leading-5 text-txt transition-colors hover:border-accent/60 hover:text-accent focus-visible:ring-2 focus-visible:ring-accent/60 outline-hidden">
          {id}
        </Link>
      ))}
      {rest && <span data-user-content className="min-w-0 truncate text-muted">{rest}</span>}
    </span>
  )
}

/**
 * Rows for a task / epic file's meta block, in file order. On a task file (found in AppContext `board` by id)
 * Status, Owner, Size, Priority and Due are the board's own editable fields and always show; ids become chips,
 * Started / Done local dates, anything else plain text. An epic's rows are read-only.
 */
function useMetaRows(path: string, meta: MetaBlock["entries"]): ItemProperty[] {
  const { t } = useT()
  const f = useFormat()
  const task = useDocTask(path)
  if (meta.length === 0 && !task) return []

  const known: Record<string, { label: string; icon: typeof Type }> = {
    status: { label: t("docs.metaStatus"), icon: CircleDashed },
    phase: { label: t("docs.metaPhase"), icon: MapIcon },
    parent: { label: t("docs.metaParent"), icon: MapIcon },
    "depends on": { label: t("docs.metaDependsOn"), icon: GitBranch },
    tasks: { label: t("docs.metaTasks"), icon: ListChecks },
    owner: { label: t("docs.metaOwner"), icon: User },
    size: { label: t("docs.metaSize"), icon: Ruler },
    priority: { label: t("docs.metaPriority"), icon: Flag },
    due: { label: t("docs.metaDue"), icon: Calendar },
    started: { label: t("docs.metaStarted"), icon: CalendarClock },
    done: { label: t("docs.metaDone"), icon: CalendarCheck },
    covers: { label: t("docs.metaCovers"), icon: ListChecks },
    order: { label: t("docs.metaOrder"), icon: Hash },
    specs: { label: t("docs.metaSpecs"), icon: BookOpen },
    "spec merged": { label: t("docs.metaSpecMerged"), icon: CalendarCheck },
  }
  const editable: Record<string, (task: Task) => ReactNode> = {
    status: (x) => <TaskStatusField task={x} chip />,
    owner: (x) => <TaskOwnerField task={x} />,
    size: (x) => <TaskSizeField task={x} />,
    priority: (x) => <TaskPriorityField task={x} />,
    due: (x) => <TaskDueField task={x} />,
  }

  const rows: ItemProperty[] = []
  const seen = new Set<string>()
  const row = (key: string, value: ReactNode, label = key) => {
    const k = known[key]
    seen.add(key)
    rows.push({ id: `meta:${key}`, icon: k?.icon ?? Type, label: k?.label ?? label, value })
  }
  for (const { key, value } of meta) {
    const k = key.toLowerCase()
    if (seen.has(k)) continue
    if (task && editable[k]) row(k, editable[k](task))
    else if (k === "phase" || k === "parent" || k === "depends on" || k === "tasks") row(k, <IdChips value={value} />)
    else if ((k === "started" || k === "done" || k === "spec merged") && YMD.test(value)) row(k, <span className="font-mono text-xs" title={value}>{f.day(value)}</span>)
    else if (k === "owner" && value) row(k, <OwnerChip owner={value} className="text-xs" />)
    else row(k, <span data-user-content className="truncate">{value || "—"}</span>, key)
  }
  // a task always offers the board's editable fields, even when the file doesn't name them yet
  if (task) for (const k of Object.keys(editable)) if (!seen.has(k)) row(k, editable[k](task))
  // T507: the checklist's state, one click from Test review; "No manual tests yet" when the file has none
  if (task) rows.push({ id: "manual-tests", icon: FlaskConical, label: t("shell.manualTests"), value: <TestsRowValue task={task} /> })
  return rows
}
