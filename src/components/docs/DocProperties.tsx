"use client"

import { useState } from "react"
import { BookOpen, Bot, Clock, Flag, Plus, Trash2, Type, User } from "lucide-react"
import { PropertyRows, type ItemProperty } from "@/components/shared/ItemPanelHeader"
import { PriorityBadge, PriorityField } from "@/components/shared/PriorityBadge"
import { InlineText } from "@/components/shared/InlineProperty"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { timeAgo } from "@/components/activity/ActivityEventRow"
import { toast } from "@/components/ui/toast"
import { useApp } from "@/context/AppContext"
import { PRIORITIES, PROPERTY_KEY, docProperties, parsePriority } from "@/lib/doc-priority"

// A doc's properties, Notion-style: its frontmatter keys (priority gets a picker, the rest are text),
// then what VibeDoc knows about it (last edit, length). "Add a property" writes a new frontmatter key.

const addRow = "flex h-7 items-center gap-2 rounded-sm px-1.5 -mx-1.5 text-[13px] text-muted outline-hidden transition-colors hover:bg-surface2 hover:text-txt focus-visible:ring-2 focus-visible:ring-accent/60"

/** "due-date" → "Due date"; the file keeps the key as written */
const labelOf = (key: string) => (key.charAt(0).toUpperCase() + key.slice(1)).replace(/[-_]+/g, " ")

export function DocProperties({ path, content, lastEdit, words, minutes }: {
  path: string
  /** Live doc text, frontmatter included */
  content: string
  lastEdit?: { actor: "ai" | "human"; at: string } | null
  words: number
  minutes: number
}) {
  const { rootParam, demo } = useApp()
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
    if (!res?.ok) toast((await res?.json().catch(() => null))?.error ?? `Could not save ${labelOf(key).toLowerCase()}`)
    setPending((p) => { const next = { ...p }; delete next[key]; return next })
  }

  function addNamed(name: string | null) {
    setNaming(false)
    const key = name?.trim().toLowerCase().replace(/\s+/g, "-")
    if (!key) return
    if (!PROPERTY_KEY.test(key)) return toast("Property names use letters, digits, - and _, and start with a letter")
    if (props.has(key.toLowerCase())) return toast(`${labelOf(key)} is already a property`)
    setFresh(key)
  }

  const nameMenu = (key: string, label: string) => demo ? <span className="truncate">{label}</span> : (
    <DropdownMenu>
      <DropdownMenuTrigger className="-mx-1.5 flex h-7 min-w-0 items-center rounded-sm px-1.5 text-left outline-hidden transition-colors hover:bg-surface2 hover:text-txt focus-visible:ring-2 focus-visible:ring-accent/60">
        <span className="truncate">{label}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel className="font-mono text-[10px] font-medium text-muted">{key}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => save(key, null)} className="text-danger focus:text-danger"><Trash2 /> Remove property</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const rows: ItemProperty[] = []
  if (priority) {
    rows.push({ id: "priority", icon: Flag, label: nameMenu("priority", "Priority"), value: <PriorityField label={`Priority of ${path}`} value={priority} onChange={(v) => save("priority", v)} /> })
  }
  for (const p of props.values()) {
    if (p.key.toLowerCase() === "priority") continue
    rows.push({
      id: p.key, icon: Type, label: nameMenu(p.key, labelOf(p.key)),
      value: <InlineText key={p.value} label={`${labelOf(p.key)} of ${path}`} value={p.value} onChange={(v) => save(p.key, v)} className="w-full py-1"><span className="truncate">{p.value}</span></InlineText>,
    })
  }
  if (fresh && !props.has(fresh.toLowerCase())) {
    rows.push({
      id: `new:${fresh}`, icon: Type, label: labelOf(fresh),
      value: <InlineText startEditing label={`${labelOf(fresh)} of ${path}`} value={null} placeholder="Empty" onChange={(v) => { setFresh(null); if (v) save(fresh, v) }} onCancel={() => setFresh(null)}><span /></InlineText>,
    })
  }
  if (lastEdit) {
    rows.push({
      id: "edited", icon: Clock, label: "Last edited",
      value: (
        <span className="inline-flex min-w-0 items-center gap-1.5" title={new Date(lastEdit.at).toLocaleString()}>
          {lastEdit.actor === "ai" ? <Bot className="size-3.5 text-accent" aria-hidden /> : <User className="size-3.5 text-muted" aria-hidden />}
          {lastEdit.actor === "ai" ? "AI" : "You"}
          <span className="font-mono text-[11px] text-muted">{timeAgo(lastEdit.at)}</span>
        </span>
      ),
    })
  }
  rows.push({ id: "length", icon: BookOpen, label: "Length", value: <span className="font-mono text-[11px] text-muted">{words.toLocaleString()} words · {minutes} min read</span> })

  return (
    <PropertyRows properties={rows}>
      {demo ? null : naming ? (
        <div className="flex w-full items-center gap-2">
          <Type className="size-3.5 shrink-0 text-muted" aria-hidden />
          <div className="w-40"><InlineText startEditing label="New property name" value={null} placeholder="Property name" onChange={addNamed} onCancel={() => setNaming(false)}><span /></InlineText></div>
        </div>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger className={addRow}>
            <Plus className="size-3.5" aria-hidden /> Add a property
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            {!priority && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger><Flag /> Priority</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {PRIORITIES.map((p) => <DropdownMenuItem key={p} onSelect={() => save("priority", p)}><PriorityBadge priority={p} /></DropdownMenuItem>)}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
            <DropdownMenuItem onSelect={() => setNaming(true)}><Type /> Text…</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </PropertyRows>
  )
}
