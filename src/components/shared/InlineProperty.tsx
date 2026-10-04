"use client"

import { useState, type ReactNode } from "react"
import { Check } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useApp } from "@/context/AppContext"

// Edit one property where it is shown (R055). Clicks and keys are stopped so a card or row underneath
// doesn't open or drag. Keyboard: the menu takes arrows + Enter, Esc cancels; the date takes Enter / Esc.

const stop = (e: React.SyntheticEvent) => e.stopPropagation()
const trigger = "inline-flex min-w-0 items-center gap-1 rounded-sm px-1 -mx-1 text-left outline-hidden hover:bg-surface2 focus-visible:ring-2 focus-visible:ring-accent/60"

export interface InlineOption { value: string; label: string; node?: ReactNode }

/** Read-only demo (R042): the value, not a control */
const Shown = ({ children, className }: { children: ReactNode; className?: string }) => (
  <span className={cn("inline-flex min-w-0 items-center gap-1", className)}>{children}</span>
)

/** The shown value opens a menu of options; picking one calls onChange (the menu closes). */
export function InlineSelect({ label, value, options, onChange, children, className }: {
  /** What is being edited, for screen readers ("Status of T001") */
  label: string
  value: string
  options: InlineOption[]
  onChange: (value: string) => void
  children: ReactNode
  className?: string
}) {
  const { demo } = useApp()
  if (demo) return <Shown className={className}>{children}</Shown>
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={label} draggable={false} onClick={stop} onKeyDown={stop} onPointerDown={stop} className={cn(trigger, className)}>
          {children}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 w-48 overflow-y-auto" onClick={stop} onKeyDown={stop}>
        {options.map((o) => (
          <DropdownMenuItem key={o.value} onSelect={() => { if (o.value !== value) onChange(o.value) }}>
            {o.node ?? o.label}
            {o.value === value && <Check className="ml-auto size-3.5 text-muted" aria-hidden />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** The shown date turns into a date input: Enter saves, Esc cancels, leaving the field saves a change. */
export function InlineDate({ label, value, onChange, children, className }: {
  label: string
  value: string | null
  onChange: (value: string | null) => void
  children: ReactNode
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? "")
  const { demo } = useApp()
  const commit = () => {
    setEditing(false)
    if ((draft || null) !== value) onChange(draft || null)
  }
  if (demo) return <Shown className={className}>{children}</Shown>
  if (!editing) {
    return (
      <button
        type="button"
        aria-label={label}
        draggable={false}
        onClick={(e) => { stop(e); setDraft(value ?? ""); setEditing(true) }}
        onKeyDown={stop}
        className={cn(trigger, className)}
      >
        {children}
      </button>
    )
  }
  return (
    <input
      type="date"
      autoFocus
      aria-label={label}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onClick={stop}
      onPointerDown={stop}
      onKeyDown={(e) => {
        stop(e)
        if (e.key === "Enter") { e.preventDefault(); commit() }
        if (e.key === "Escape") { e.preventDefault(); setEditing(false) }
      }}
      onBlur={commit}
      className="h-6 rounded-sm border border-accent/60 bg-bg px-1 font-mono text-[11px] text-txt scheme-light outline-hidden dark:scheme-dark"
    />
  )
}

/** The shown text turns into a text input: Enter or leaving saves, Esc cancels. Saving "" passes null. */
export function InlineText({ label, value, onChange, children, className, placeholder, startEditing = false, onCancel }: {
  label: string
  value: string | null
  onChange: (value: string | null) => void
  children: ReactNode
  className?: string
  placeholder?: string
  /** Open as an input right away (a property that was just added) */
  startEditing?: boolean
  onCancel?: () => void
}) {
  const [editing, setEditing] = useState(startEditing)
  const [draft, setDraft] = useState(value ?? "")
  const { demo } = useApp()
  const commit = () => {
    setEditing(false)
    const next = draft.trim() || null
    if (next !== value) onChange(next)
    else if (!next) onCancel?.()
  }
  if (demo) return <Shown className={className}>{children}</Shown>
  if (!editing) {
    return (
      <button
        type="button"
        aria-label={label}
        draggable={false}
        onClick={(e) => { stop(e); setDraft(value ?? ""); setEditing(true) }}
        onKeyDown={stop}
        className={cn(trigger, className)}
      >
        {children}
      </button>
    )
  }
  return (
    <input
      autoFocus
      aria-label={label}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onClick={stop}
      onPointerDown={stop}
      onKeyDown={(e) => {
        stop(e)
        if (e.key === "Enter") { e.preventDefault(); commit() }
        if (e.key === "Escape") { e.preventDefault(); setEditing(false); onCancel?.() }
      }}
      onBlur={commit}
      className="h-7 w-full min-w-0 rounded-sm border border-accent/60 bg-bg px-1.5 text-[13px] text-txt outline-hidden placeholder:text-muted"
    />
  )
}
