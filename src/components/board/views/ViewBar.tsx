"use client"

import { useEffect, useRef, useState } from "react"
import { Bookmark, ChartGantt, ChevronDown, ListTree, Pencil, Plus, RotateCcw, SquareKanban, Table2, Trash2, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SavedView, ViewKind } from "@/lib/board-views"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

const KIND_ICON: Record<ViewKind, LucideIcon> = { board: SquareKanban, table: Table2, epic: ListTree, timeline: ChartGantt }
const BUILT_IN = ["board", "table", "epic", "timeline"]

const focusRing = "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
const tabClass = cn(
  "relative inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-0.5 text-[13px] font-medium",
  "transition-colors duration-(--duration-fast) ease-out-soft",
  focusRing,
)
const kbdClass = "rounded-sm border border-border2 bg-surface2 px-1 py-0.5 font-mono text-[10px] leading-none text-txt"

export interface ViewBarProps {
  views: SavedView[]
  activeId: string
  onSelect: (id: string) => void
  onNew: () => void
  onRename: (id: string, name: string) => void
  /** Returns true when the view was deleted (the user may cancel the confirm). */
  onDelete: (id: string) => boolean
  /** Built-ins with a saved copy that differs from the default; they get a "Restore default" menu. */
  customizedIds: string[]
  onRestore: (id: string) => void
}

export function ViewBar({ views, activeId, onSelect, onNew, onRename, onDelete, customizedIds, onRestore }: ViewBarProps) {
  const ordered = [...views.filter(v => BUILT_IN.includes(v.id)), ...views.filter(v => !BUILT_IN.includes(v.id))]
  const [renaming, setRenaming] = useState<string | null>(null)
  // After rename / delete / restore the focused control unmounts; put focus back on a tab instead of <body>.
  const tabs = useRef(new Map<string, HTMLButtonElement>())
  const pendingFocus = useRef<string | null>(null)
  useEffect(() => {
    const want = pendingFocus.current
    if (!want) return
    const el = tabs.current.get(want)
    if (!el) return
    el.focus()
    pendingFocus.current = null
  })

  return (
    <div role="group" aria-label="Views" className="flex items-center gap-4 overflow-x-auto border-b border-border [scrollbar-width:none]">
      {ordered.map(v => {
        const builtIn = BUILT_IN.includes(v.id)
        const Icon = builtIn ? KIND_ICON[v.kind] : Bookmark
        const active = v.id === activeId
        if (renaming === v.id) {
          return (
            <RenameInput
              key={v.id}
              initial={v.name}
              onDone={(name, byKey) => {
                setRenaming(null)
                if (byKey) pendingFocus.current = v.id
                if (name && name !== v.name) onRename(v.id, name)
              }}
            />
          )
        }
        return (
          <span key={v.id} className="inline-flex shrink-0 items-center">
            <button
              ref={el => { if (el) tabs.current.set(v.id, el); else tabs.current.delete(v.id) }}
              type="button"
              aria-pressed={active}
              title={builtIn ? undefined : `Saved view: ${v.name}`}
              onClick={() => onSelect(v.id)}
              className={cn(tabClass, active ? "text-txt" : "text-muted hover:text-txt")}
            >
              <Icon aria-hidden className={builtIn ? "size-[15px]" : "size-3.5"} />
              {v.name}
              {/* One named underline: it glides to the new tab when the view changes (a View Transition) */}
              {active && <span aria-hidden className="absolute inset-x-0 -bottom-0.5 h-0.5 bg-accent [view-transition-name:board-view-tab]" />}
            </button>
            {active && (!builtIn || customizedIds.includes(v.id)) && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={`View options for ${v.name}`}
                  className={cn("ml-0.5 inline-flex size-6 items-center justify-center rounded-sm text-muted hover:bg-surface2 hover:text-txt", focusRing)}
                >
                  <ChevronDown aria-hidden className="size-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {builtIn ? (
                    <DropdownMenuItem onSelect={() => { pendingFocus.current = v.id; onRestore(v.id) }}>
                      <RotateCcw aria-hidden className="size-3.5" />Restore default
                    </DropdownMenuItem>
                  ) : (
                    <>
                      <DropdownMenuItem onSelect={() => setRenaming(v.id)}>
                        <Pencil aria-hidden className="size-3.5" />Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => { if (onDelete(v.id)) pendingFocus.current = v.kind }}
                        className="text-danger focus:text-danger"
                      >
                        <Trash2 aria-hidden className="size-3.5" />Delete view
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </span>
        )
      })}
      <button
        type="button"
        aria-label="New view"
        title="New view"
        onClick={onNew}
        className={cn(tabClass, "border-transparent text-muted hover:text-txt")}
      >
        <Plus aria-hidden className="size-[15px]" />
      </button>
      <span className="grow" />
      <span className="hidden shrink-0 items-center gap-1.5 pb-1.5 text-[11px] text-muted sm:flex">
        <kbd className={kbdClass}>v</kbd>next view
        <kbd className={cn(kbdClass, "ml-1.5")}>1</kbd>–<kbd className={kbdClass}>4</kbd>
      </span>
    </div>
  )
}

/** `byKey`: finished with Enter / Esc (focus returns to the tab), not by clicking away. */
function RenameInput({ initial, onDone }: { initial: string; onDone: (name: string, byKey: boolean) => void }) {
  const [name, setName] = useState(initial)
  const ref = useRef<HTMLInputElement>(null)
  const done = useRef(false)
  const finish = (value: string, byKey = false) => {
    if (done.current) return
    done.current = true
    onDone(value.trim(), byKey)
  }
  useEffect(() => {
    // After the dropdown closes (it restores focus to its trigger first).
    const t = setTimeout(() => ref.current?.select(), 0)
    return () => clearTimeout(t)
  }, [])
  return (
    <input
      ref={ref}
      aria-label="View name"
      value={name}
      maxLength={60}
      onChange={e => setName(e.target.value)}
      onBlur={() => finish(name)}
      onKeyDown={e => {
        if (e.key === "Enter") finish(name, true)
        if (e.key === "Escape") {
          e.stopPropagation()
          finish(initial, true)
        }
      }}
      className="my-1 h-7 w-40 shrink-0 rounded-md border border-accent bg-bg px-2 text-[13px] text-txt outline-hidden"
    />
  )
}
