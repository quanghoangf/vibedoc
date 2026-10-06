"use client"

import { useEffect, useId, useRef, useState, type ReactNode } from "react"
import { ArrowDown, ArrowUp, ArrowUpDown, Bookmark, ChevronDown, ListFilter, Plus, Rows3, Search, SlidersHorizontal, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { FilterProp, FilterRule, GroupBy, PropertyKey, SortProp, SortRule, ViewState } from "@/lib/board-views"
import { StatusIcon, useStatusLabel } from "@/components/shared/StatusIcon"
import { useStatusDefs } from "@/components/shared/status-defs"
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useT } from "@/context/LanguageContext"
import type { MessageKey } from "@/i18n"

// ── vocabulary ────────────────────────────────────────────────────────────────

type Op = FilterRule["op"]

// Labels are message keys (R078), read with t() where they render.
const FILTER_PROPS: { prop: FilterProp; label: MessageKey }[] = [
  { prop: "status", label: "board.status" }, { prop: "epic", label: "board.epic" }, { prop: "size", label: "board.size" },
  { prop: "due", label: "board.due" }, { prop: "deps", label: "board.dependsOn" }, { prop: "tests", label: "board.tests" },
  { prop: "agent", label: "board.agent" }, { prop: "ready", label: "board.ready" }, { prop: "owner", label: "board.owner" },
]
const PROP_LABEL = Object.fromEntries(FILTER_PROPS.map(p => [p.prop, p.label])) as Record<FilterProp, MessageKey>

/** Ops offered per prop, with how each reads after the prop name. */
const OPS: Record<FilterProp, Partial<Record<Op, MessageKey>>> = {
  status: { is: "board.opIs", "is-not": "board.opIsNot" },
  epic: { is: "board.opIs", "is-not": "board.opIsNot" },
  size: { is: "board.opIs", "is-not": "board.opIsNot" },
  due: { before: "board.opBefore", after: "board.opAfter", "is-set": "board.opIsSet", "not-set": "board.opNotSet" },
  deps: { "is-set": "board.opAnything", "not-set": "board.opNothing" },
  tests: { "is-set": "board.opReported", "not-set": "board.opNotReported" },
  agent: { "is-set": "board.opActive", "not-set": "board.opNotActive" },
  ready: { "is-set": "board.opYes", "not-set": "board.opNo" },
  owner: { is: "board.opIs", "is-not": "board.opIsNot" },
}
const LIST_PROPS: FilterProp[] = ["status", "epic", "size", "owner"]
const OWNER_LABEL: Record<string, MessageKey> = { human: "board.human", ai: "board.aiAgent", none: "board.noOwner" }
const SIZES = ["XS", "S", "M", "L", "XL"]

const SORT_PROPS: { prop: SortProp; label: MessageKey }[] = [
  { prop: "status", label: "board.status" }, { prop: "id", label: "board.id" }, { prop: "epic", label: "board.epic" },
  { prop: "size", label: "board.size" }, { prop: "due", label: "board.due" }, { prop: "title", label: "board.title" },
]
const GROUPS: { value: GroupBy; label: MessageKey }[] = [
  { value: "status", label: "board.status" }, { value: "epic", label: "board.epic" }, { value: "size", label: "board.size" }, { value: "owner", label: "board.owner" }, { value: "none", label: "board.none" },
]
const LANES: { value: ViewState["subGroup"]; label: MessageKey }[] = [
  { value: "epic", label: "board.epic" }, { value: "size", label: "board.size" }, { value: "none", label: "board.none" },
]
const PROPERTIES: { key: PropertyKey; label: MessageKey }[] = [
  { key: "status", label: "board.status" }, { key: "epic", label: "board.epic" }, { key: "size", label: "board.size" }, { key: "due", label: "board.due" },
  { key: "deps", label: "board.dependsOn" }, { key: "tests", label: "board.tests" }, { key: "agent", label: "board.agent" }, { key: "owner", label: "board.owner" },
]

function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

type EpicOption = { id: string; title: string; open?: boolean }

function newRule(prop: FilterProp, epics: EpicOption[]): FilterRule {
  switch (prop) {
    case "status": return { prop, op: "is-not", value: ["done"] }
    case "epic": return { prop, op: "is", value: [(epics.find(e => e.open) ?? epics[0])?.id ?? "none"] }
    case "size": return { prop, op: "is", value: ["M"] }
    case "due": return { prop, op: "before", value: [localToday()] }
    case "owner": return { prop, op: "is", value: ["ai"] }
    default: return { prop, op: "is-set", value: [] }
  }
}

// ── styles ────────────────────────────────────────────────────────────────────

const focusRing = "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
const btn = cn(
  "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border border-transparent px-2.5 text-xs font-medium text-muted",
  "transition-colors duration-(--duration-fast) ease-out-soft hover:bg-surface2 hover:text-txt",
  focusRing,
)
const btnOn = "border-border2 bg-surface2 text-txt"
const sel = cn("h-7.5 min-w-0 rounded-md border border-border bg-bg px-2 text-[13px] text-txt", focusRing)
const kbdClass = "rounded-sm border border-border2 bg-surface2 px-1 py-0.5 font-mono text-[10px] leading-none text-txt"
const iconBtn = cn("inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-surface2 hover:text-txt disabled:opacity-40 disabled:hover:bg-transparent", focusRing)

// ── popover ───────────────────────────────────────────────────────────────────

/**
 * Non-modal popover: trigger button + absolutely positioned panel. Esc closes and returns focus to the trigger,
 * an outside pointer-down closes. The wrapper is only `relative` from sm up; below that the panel anchors to the
 * nearest positioned ancestor (the toolbar's button row) so it can span the screen.
 */
function Popover({
  open, onOpenChange, label, trigger, triggerClassName, panelClassName, anchorClassName, children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  label: string
  trigger: ReactNode
  triggerClassName?: string
  panelClassName?: string
  anchorClassName?: string
  children: ReactNode
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const onOpenChangeRef = useRef(onOpenChange)
  const id = useId()

  useEffect(() => {
    onOpenChangeRef.current = onOpenChange
  })

  // Deps are [open] only: callers pass inline callbacks, and refocusing on every render would steal focus.
  useEffect(() => {
    if (!open) return
    panelRef.current?.querySelector<HTMLElement>("button, input, select")?.focus()
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) onOpenChangeRef.current(false)
    }
    document.addEventListener("pointerdown", onDown)
    return () => document.removeEventListener("pointerdown", onDown)
  }, [open])

  return (
    <div ref={wrapRef} className={cn("max-sm:flex max-sm:flex-1", anchorClassName ?? "sm:relative")}>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? id : undefined}
        onClick={() => onOpenChange(!open)}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open && (
        <div
          ref={panelRef}
          id={id}
          role="dialog"
          aria-label={label}
          onKeyDown={e => {
            if (e.key !== "Escape") return
            e.stopPropagation()
            onOpenChange(false)
            triggerRef.current?.focus()
          }}
          className={cn(
            "absolute top-full z-30 mt-1 rounded-lg border border-border2 bg-surface p-3 text-txt shadow-lg",
            "origin-top-right animate-in fade-in-0 zoom-in-[0.98] slide-in-from-top-1 duration-(--duration-fast) ease-out-soft",
            panelClassName,
          )}
        >
          {children}
        </div>
      )}
    </div>
  )
}

// ── toolbar ───────────────────────────────────────────────────────────────────

export interface ViewToolbarProps {
  state: ViewState
  onChange: (next: ViewState) => void
  /** `open`: the epic still has open work (a new Epic rule defaults to the first such). */
  epics: EpicOption[]
  dirty: boolean
  activeIsBuiltIn: boolean
  onSave: () => void
  onSaveAs: (name: string) => void
  onReset: () => void
  /** The integrator focuses #id on "/". */
  searchInputId: string
  filterOpen: boolean
  /** "f" key opens it. */
  onFilterOpenChange: (open: boolean) => void
}

export function ViewToolbar({
  state, onChange, epics, dirty, activeIsBuiltIn, onSave, onSaveAs, onReset, searchInputId, filterOpen, onFilterOpenChange,
}: ViewToolbarProps) {
  const [sortOpen, setSortOpen] = useState(false)
  const { t } = useT()
  const set = (patch: Partial<ViewState>) => onChange({ ...state, ...patch })

  // The input owns its value: the URL (state.q) syncs a tick late, which would jump the caret.
  // Adopt state.q only when it changes from outside (Reset, view switch), not while our own writes catch up.
  const [q, setQ] = useState(state.q)
  const [seenQ, setSeenQ] = useState(state.q)
  const [pendingQ, setPendingQ] = useState<string | null>(null)
  if (state.q !== seenQ) {
    setSeenQ(state.q)
    if (state.q === pendingQ) setPendingQ(null)
    else if (pendingQ === null) setQ(state.q)
  }
  const typeQ = (value: string) => {
    setQ(value)
    setPendingQ(value === state.q ? null : value)
    set({ q: value })
  }
  const timeline = state.kind === "timeline"
  const board = state.kind === "board"
  const groups = timeline ? GROUPS.filter(g => g.value === "epic" || g.value === "none") : GROUPS
  const groupLabel = t(GROUPS.find(g => g.value === state.group)?.label ?? "board.none")
  const laneLabel = t(LANES.find(l => l.value === state.subGroup)?.label ?? "board.none")
  const mobileBtn = "max-sm:h-9 max-sm:flex-1 max-sm:justify-center max-sm:border-border"

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-1">
        <label className="flex h-8 w-full items-center gap-2 rounded-md border border-border bg-bg px-2.5 text-[13px] text-muted focus-within:border-accent sm:w-65 max-sm:h-9">
          <Search aria-hidden className="size-3.5 shrink-0" />
          <span className="sr-only">{t("board.filterByTitle")}</span>
          <input
            id={searchInputId}
            type="search"
            value={q}
            placeholder={t("board.filterPlaceholder")}
            onChange={e => typeQ(e.target.value)}
            onKeyDown={e => {
              if (e.key !== "Escape") return
              if (q) typeQ("")
              else e.currentTarget.blur()
            }}
            className="min-w-0 grow bg-transparent text-txt outline-hidden placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
          />
          <kbd className={cn(kbdClass, "max-sm:hidden")}>/</kbd>
        </label>
        <span className="grow max-sm:hidden" />

        <div className="relative flex gap-1.5 max-sm:w-full sm:static sm:gap-1">
          <Popover
            open={filterOpen}
            onOpenChange={onFilterOpenChange}
            label={t("board.filter")}
            triggerClassName={cn(btn, mobileBtn, (filterOpen || state.filters.length > 0) && btnOn)}
            panelClassName="inset-x-0 sm:left-auto sm:right-0 sm:w-140"
            trigger={<>
              <ListFilter aria-hidden className="size-3.5" />{t("board.filter")}
              {state.filters.length > 0 && <span className="font-mono text-txt">{state.filters.length}</span>}
              <kbd className={cn(kbdClass, "ml-0.5 max-sm:hidden")}>f</kbd>
            </>}
          >
            <FilterBuilder filters={state.filters} epics={epics} onChange={filters => set({ filters })} />
          </Popover>

          <Popover
            open={sortOpen}
            onOpenChange={setSortOpen}
            label={t("board.sort")}
            triggerClassName={cn(btn, mobileBtn, (sortOpen || state.sorts.length > 0) && btnOn)}
            panelClassName="inset-x-0 sm:left-auto sm:right-0 sm:w-95"
            trigger={<>
              <ArrowUpDown aria-hidden className="size-3.5" />{t("board.sort")}
              {state.sorts.length > 0 && <span className="font-mono text-txt">{state.sorts.length}</span>}
            </>}
          >
            <SortBuilder sorts={state.sorts} onChange={sorts => set({ sorts })} />
          </Popover>

          <DropdownMenu>
            {/* The phone board stacks status sections (no swimlanes), so the control would do nothing there. */}
            <DropdownMenuTrigger className={cn(btn, mobileBtn, board && "max-md:hidden")}>
              <Rows3 aria-hidden className="size-3.5" />
              <span className="max-sm:hidden">{t("board.group")}</span>
              {board ? (
                <span className="text-txt">{t("board.status")}{state.subGroup !== "none" && <><span className="px-1 text-muted">›</span>{laneLabel}</>}</span>
              ) : (
                <span className="text-txt">{groupLabel}</span>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {board ? (
                <>
                  <DropdownMenuLabel className="text-xs text-muted">{t("board.swimlanes")}</DropdownMenuLabel>
                  <DropdownMenuRadioGroup value={state.subGroup} onValueChange={v => set({ subGroup: v as ViewState["subGroup"] })}>
                    {LANES.map(l => <DropdownMenuRadioItem key={l.value} value={l.value}>{t(l.label)}</DropdownMenuRadioItem>)}
                  </DropdownMenuRadioGroup>
                </>
              ) : (
                <>
                  <DropdownMenuLabel className="text-xs text-muted">{t("board.groupBy")}</DropdownMenuLabel>
                  <DropdownMenuRadioGroup value={state.group} onValueChange={v => set({ group: v as GroupBy })}>
                    {groups.map(g => <DropdownMenuRadioItem key={g.value} value={g.value}>{t(g.label)}</DropdownMenuRadioItem>)}
                  </DropdownMenuRadioGroup>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {!timeline && (
            <DropdownMenu>
              <DropdownMenuTrigger className={cn(btn, "max-sm:hidden")}>
                <SlidersHorizontal aria-hidden className="size-3.5" />{t("board.properties")}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="text-xs text-muted">{t("board.show")}</DropdownMenuLabel>
                {PROPERTIES.map(p => (
                  <DropdownMenuCheckboxItem
                    key={p.key}
                    checked={state.properties.includes(p.key)}
                    onSelect={e => e.preventDefault()}
                    onCheckedChange={on => set({
                      properties: PROPERTIES.map(x => x.key).filter(k => (k === p.key ? on === true : state.properties.includes(k))),
                    })}
                  >
                    {t(p.label)}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {state.filters.map((rule, i) => (
          <FilterChip key={i} rule={rule} onRemove={() => set({ filters: state.filters.filter((_, j) => j !== i) })} />
        ))}
        <button type="button" onClick={() => onFilterOpenChange(true)} className={cn(btn, "h-6.5 px-2")}>
          <Plus aria-hidden className="size-3.25" />{t("board.addFilter")}
        </button>
        <span className="grow" />
        {dirty && (
          <SaveArea activeIsBuiltIn={activeIsBuiltIn} onSave={onSave} onSaveAs={onSaveAs} onReset={onReset} />
        )}
      </div>
    </div>
  )
}

// ── chips ─────────────────────────────────────────────────────────────────────

type T = (key: MessageKey) => string

function valueText(rule: FilterRule, label: (key: string) => string, t: T): { text: string; mono: boolean } {
  if (rule.prop === "status") return { text: rule.value.map(label).join(", "), mono: false }
  if (rule.prop === "epic") return { text: rule.value.map(v => (v === "none" ? t("board.noEpic") : v)).join(", "), mono: !rule.value.includes("none") }
  if (rule.prop === "owner") return { text: rule.value.map(v => (OWNER_LABEL[v] ? t(OWNER_LABEL[v]) : v)).join(", "), mono: false }
  return { text: rule.value.join(", "), mono: true }
}

function opText(rule: FilterRule, t: T): string {
  if (rule.op === "is" && rule.value.length > 1) return t("board.opIsAnyOf")
  const key = OPS[rule.prop][rule.op]
  return key ? t(key) : rule.op
}

function FilterChip({ rule, onRemove }: { rule: FilterRule; onRemove: () => void }) {
  const { t } = useT()
  const hasValue = !(rule.op === "is-set" || rule.op === "not-set")
  const v = valueText(rule, useStatusLabel(), t)
  const text = `${t(PROP_LABEL[rule.prop])} ${opText(rule, t)}${hasValue ? ` ${v.text}` : ""}`
  return (
    <span className="inline-flex h-6.5 max-w-full items-center gap-1.5 rounded-sm border border-border2 bg-surface pl-2.25 pr-1 text-xs text-txt">
      <span className="truncate">
        <b className="font-medium text-muted">{t(PROP_LABEL[rule.prop])}</b> {opText(rule, t)}
        {hasValue && <> <span className={cn("text-txt", v.mono && "font-mono text-[11px]")}>{v.text || "—"}</span></>}
      </span>
      <button type="button" aria-label={t("board.removeFilter", { text })} onClick={onRemove} className={cn("inline-flex rounded-xs p-0.75 text-muted hover:text-txt", focusRing)}>
        <X aria-hidden className="size-3" />
      </button>
    </span>
  )
}

function SaveArea({ activeIsBuiltIn, onSave, onSaveAs, onReset }: { activeIsBuiltIn: boolean; onSave: () => void; onSaveAs: (name: string) => void; onReset: () => void }) {
  const { t } = useT()
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState("")
  const submit = () => {
    const n = name.trim()
    if (!n) return
    onSaveAs(n)
    setNaming(false)
    setName("")
  }
  if (naming) {
    return (
      <form className="flex items-center gap-1.5" onSubmit={e => { e.preventDefault(); submit() }}>
        <input
          autoFocus
          aria-label={t("board.newViewNameLabel")}
          placeholder={t("board.viewName")}
          value={name}
          maxLength={60}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === "Escape") { e.stopPropagation(); setNaming(false) } }}
          className="h-7 w-44 rounded-md border border-accent bg-bg px-2 text-[13px] text-txt outline-hidden placeholder:text-muted"
        />
        <button type="submit" disabled={!name.trim()} className={cn(btn, btnOn, "h-7 disabled:opacity-40")}>{t("board.save")}</button>
        <button type="button" onClick={() => setNaming(false)} className={cn(btn, "h-7")}>{t("board.cancel")}</button>
      </form>
    )
  }
  return (
    <div className="flex items-center gap-1">
      <span className="mr-1 text-xs text-muted">{t("board.unsaved")}</span>
      <button type="button" onClick={onReset} className={cn(btn, "text-txt")}>{t("board.reset")}</button>
      <button type="button" onClick={() => setNaming(true)} className={cn(btn, "text-txt")}>
        {activeIsBuiltIn ? t("board.saveAsNewView") : t("board.saveAsNew")}
      </button>
      <button type="button" onClick={onSave} className={cn(btn, btnOn)}>
        <Bookmark aria-hidden className="size-3.25" />{t("board.saveView")}
      </button>
    </div>
  )
}

// ── filter builder ────────────────────────────────────────────────────────────

function FilterBuilder({ filters, epics, onChange }: { filters: FilterRule[]; epics: EpicOption[]; onChange: (f: FilterRule[]) => void }) {
  const update = (i: number, rule: FilterRule) => onChange(filters.map((r, j) => (j === i ? rule : r)))
  const labelId = useId()
  const { t } = useT()
  return (
    <div>
      <p id={labelId} className="mb-2.5 ml-0.5 text-xs font-semibold">{t("board.showTasksWhere")}</p>
      {filters.length === 0 && <p className="mb-1 ml-0.5 text-xs text-muted">{t("board.noFilters")}</p>}
      <ul aria-labelledby={labelId} className="flex flex-col gap-1.5">
        {filters.map((rule, i) => {
          const ops = Object.entries(OPS[rule.prop]) as [Op, MessageKey][]
          const n = i + 1
          return (
            <li key={i} className="flex flex-wrap items-center gap-1.5 text-xs text-muted sm:grid sm:grid-cols-[48px_120px_100px_minmax(0,1fr)_28px]">
              <span className="w-10 pl-1 sm:w-auto">{i === 0 ? t("board.where") : t("board.and")}</span>
              <select
                aria-label={t("board.ruleProperty", { n })}
                value={rule.prop}
                onChange={e => update(i, newRule(e.target.value as FilterProp, epics))}
                className={cn(sel, "w-32.5 sm:w-auto")}
              >
                {FILTER_PROPS.map(p => <option key={p.prop} value={p.prop}>{t(p.label)}</option>)}
              </select>
              <select
                aria-label={t("board.ruleCondition", { n })}
                value={rule.op}
                onChange={e => {
                  const op = e.target.value as Op
                  const value = op === "is-set" || op === "not-set" ? [] : rule.value.length ? rule.value : newRule(rule.prop, epics).value
                  update(i, { ...rule, op, value })
                }}
                className={cn(sel, "w-27.5 sm:w-auto")}
              >
                {ops.map(([op, label]) => <option key={op} value={op}>{t(label)}</option>)}
              </select>
              <span className="min-w-0 grow basis-40 sm:basis-auto">
                <ValueControl rule={rule} n={n} epics={epics} onChange={value => update(i, { ...rule, value })} />
              </span>
              <button type="button" aria-label={t("board.removeRule", { n })} onClick={() => onChange(filters.filter((_, j) => j !== i))} className={iconBtn}>
                <X aria-hidden className="size-3.5" />
              </button>
            </li>
          )
        })}
      </ul>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-border pt-2.5">
        <button type="button" onClick={() => onChange([...filters, newRule("status", epics)])} className={btn}>
          <Plus aria-hidden className="size-3.5" />{t("board.addRule")}
        </button>
        <span className="grow" />
        <span className="text-[11px] text-muted max-sm:hidden">{t("board.rulesCombine")}</span>
      </div>
    </div>
  )
}

function ValueControl({ rule, n, epics, onChange }: { rule: FilterRule; n: number; epics: EpicOption[]; onChange: (v: string[]) => void }) {
  const { t } = useT()
  if (rule.op === "is-set" || rule.op === "not-set") return null
  if (rule.prop === "due") {
    return (
      <input
        type="date"
        aria-label={t("board.ruleDate", { n })}
        value={rule.value[0] ?? ""}
        onChange={e => onChange(e.target.value ? [e.target.value] : [])}
        className={cn(sel, "w-full scheme-dark")}
      />
    )
  }
  if (!LIST_PROPS.includes(rule.prop)) return null
  return <MultiSelect rule={rule} n={n} epics={epics} onChange={onChange} />
}

function MultiSelect({ rule, n, epics, onChange }: { rule: FilterRule; n: number; epics: EpicOption[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const defs = useStatusDefs()
  const label = useStatusLabel()
  const { t } = useT()
  const options: { value: string; node: ReactNode }[] =
    rule.prop === "status"
      ? defs.map(d => ({ value: d.id, node: <><StatusIcon status={d.id} />{label(d.id)}</> }))
      : rule.prop === "epic"
        ? [
            { value: "none", node: <span className="text-muted">{t("board.noEpic")}</span> },
            ...epics.map(e => ({ value: e.id, node: <><span className="font-mono text-[11px] text-muted">{e.id}</span><span className="truncate">{e.title}</span></> })),
          ]
        : rule.prop === "owner"
          ? Object.entries(OWNER_LABEL).map(([value, key]) => ({ value, node: <span>{t(key)}</span> }))
          : SIZES.map(s => ({ value: s, node: <span className="font-mono">{s}</span> }))
  const first = rule.value[0]
  const summary =
    !first ? <span className="text-muted">{t("board.choose")}</span>
    : rule.prop === "status" ? <><StatusIcon status={first} /><span className="truncate">{label(first)}</span></>
    : rule.prop === "owner" ? <span className="truncate">{OWNER_LABEL[first] ? t(OWNER_LABEL[first]) : first}</span>
    : rule.prop === "epic" && first !== "none" ? <><span className="font-mono text-[11px] text-muted">{first}</span><span className="truncate">{epics.find(e => e.id === first)?.title ?? ""}</span></>
    : <span className={cn("truncate", rule.prop === "size" && "font-mono")}>{first === "none" ? t("board.noEpic") : first}</span>

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      label={t("board.propValues", { prop: t(PROP_LABEL[rule.prop]) })}
      anchorClassName="relative"
      triggerClassName={cn(sel, "flex w-full items-center gap-1.5 text-left")}
      panelClassName="left-0 z-40 max-h-64 w-64 overflow-y-auto p-1"
      trigger={<>
        <span className="sr-only">{t("board.ruleValues", { n })} </span>
        {summary}
        {rule.value.length > 1 && <span className="font-mono text-[11px] text-muted">+{rule.value.length - 1}</span>}
        <span className="grow" />
        <ChevronDown aria-hidden className="size-3.5 shrink-0 text-muted" />
      </>}
    >
      <ul className="flex flex-col">
        {options.map(o => (
          <li key={o.value}>
            <label className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-[13px] text-txt hover:bg-surface2">
              <input
                type="checkbox"
                checked={rule.value.includes(o.value)}
                onChange={e => onChange(e.target.checked ? [...rule.value, o.value] : rule.value.filter(v => v !== o.value))}
                className="size-3.5 accent-accent"
              />
              <span className="flex min-w-0 items-center gap-1.5">{o.node}</span>
            </label>
          </li>
        ))}
      </ul>
    </Popover>
  )
}

// ── sort builder ──────────────────────────────────────────────────────────────

function SortBuilder({ sorts, onChange }: { sorts: SortRule[]; onChange: (s: SortRule[]) => void }) {
  const update = (i: number, rule: SortRule) => onChange(sorts.map((r, j) => (j === i ? rule : r)))
  const move = (i: number, d: -1 | 1) => {
    const next = [...sorts]
    ;[next[i], next[i + d]] = [next[i + d], next[i]]
    onChange(next)
  }
  const unused = SORT_PROPS.filter(p => !sorts.some(s => s.prop === p.prop))
  const { t } = useT()
  const statusLabel = useStatusLabel()
  return (
    <div>
      <p className="mb-2.5 ml-0.5 text-xs font-semibold">{t("board.sortBy")}</p>
      {sorts.length === 0 && <p className="mb-1 ml-0.5 text-xs text-muted">{t("board.defaultOrder")}</p>}
      <ol className="flex flex-col gap-1.5">
        {sorts.map((rule, i) => {
          const n = i + 1
          const key = SORT_PROPS.find(p => p.prop === rule.prop)?.label
          const label = key ? t(key) : rule.prop
          return (
            <li key={rule.prop} className="flex items-center gap-1">
              <button type="button" aria-label={t("board.moveSortUp", { name: label })} disabled={i === 0} onClick={() => move(i, -1)} className={iconBtn}>
                <ArrowUp aria-hidden className="size-3.5" />
              </button>
              <button type="button" aria-label={t("board.moveSortDown", { name: label })} disabled={i === sorts.length - 1} onClick={() => move(i, 1)} className={iconBtn}>
                <ArrowDown aria-hidden className="size-3.5" />
              </button>
              <select
                aria-label={t("board.sortProperty", { n })}
                value={rule.prop}
                onChange={e => update(i, { ...rule, prop: e.target.value as SortProp })}
                className={cn(sel, "ml-0.5 grow")}
              >
                {SORT_PROPS.filter(p => p.prop === rule.prop || !sorts.some(s => s.prop === p.prop)).map(p => (
                  <option key={p.prop} value={p.prop}>{t(p.label)}</option>
                ))}
              </select>
              <select
                aria-label={t("board.sortDirection", { n })}
                value={rule.dir}
                onChange={e => update(i, { ...rule, dir: e.target.value as SortRule["dir"] })}
                className={cn(sel, "w-37.5")}
              >
                <option value="asc">{rule.prop === "status" ? t("board.workflowOrder") : t("board.ascending")}</option>
                <option value="desc">{rule.prop === "status" ? t("board.reverseWorkflow") : t("board.descending")}</option>
              </select>
              <button type="button" aria-label={t("board.removeSort", { name: label })} onClick={() => onChange(sorts.filter((_, j) => j !== i))} className={iconBtn}>
                <X aria-hidden className="size-3.5" />
              </button>
            </li>
          )
        })}
      </ol>
      <div className="mt-2.5 border-t border-border pt-2.5">
        <button type="button" disabled={!unused.length} onClick={() => onChange([...sorts, { prop: unused[0].prop, dir: "asc" }])} className={cn(btn, "disabled:opacity-40")}>
          <Plus aria-hidden className="size-3.5" />{t("board.addSort")}
        </button>
      </div>
      <p className="mx-0.5 mt-2 text-[11px] leading-normal text-muted">{t("board.workflowHint", { order: ["in-progress", "review", "todo", "blocked", "done"].map(statusLabel).join(" → ") })}</p>
    </div>
  )
}
