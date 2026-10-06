"use client"

import { useState } from "react"
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { useApp } from "@/context/AppContext"
import { toast } from "@/components/ui/toast"
import { STATUS_COLOR_CLASS, STATUS_META, useCategoryLabel } from "@/components/shared/StatusIcon"
import { useT } from "@/context/LanguageContext"
import type { MessageKey } from "@/i18n"
import { BUILTIN_STATUSES, STATUS_COLORS, invalidStatusId, statusDefs, type StatusColor, type StatusDef } from "@/lib/statuses"
import type { AppSettings } from "@/lib/settings"
import type { TaskStatus } from "@/types"

const FIELD = "h-8 rounded-md border border-border bg-bg px-2 text-sm text-txt focus:outline-hidden focus:ring-1 focus:ring-accent disabled:opacity-50"
/** One row = icon · label · id · color · category · actions, in columns from sm up; wraps on a phone */
/** One row = icon · label · id · color · category · actions. On a phone the id / color / category line wraps under the label. */
const ROW = "grid grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[16px_minmax(0,9rem)_minmax(0,6rem)_6rem_minmax(0,1fr)_5.25rem]"
const ICON_BTN = "grid size-7 place-items-center rounded-md text-muted hover:bg-surface2 hover:text-txt disabled:opacity-30 disabled:hover:bg-transparent"
const CATEGORY_HELP: Record<TaskStatus, MessageKey> = {
  todo: "settings.helpTodo", "in-progress": "settings.helpInProgress", review: "settings.helpReview", blocked: "settings.helpBlocked",
  paused: "settings.helpPaused", done: "settings.helpDone", cancelled: "settings.helpCancelled",
}
const COLOR_KEY: Record<StatusColor, MessageKey> = {
  gray: "settings.colorGray", amber: "settings.colorAmber", accent: "settings.colorAccent", red: "settings.colorRed", slate: "settings.colorSlate",
  teal: "settings.colorTeal", blue: "settings.colorBlue", pink: "settings.colorPink", green: "settings.colorGreen", orange: "settings.colorOrange",
}
const slug = (label: string) => label.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)

/** The project's statuses: rename, recolor, reorder, add (mapped onto a built-in category) and delete custom ones. */
export function StatusesSettings({ settings, onSave }: { settings: AppSettings; onSave: (s: AppSettings) => Promise<void> | void }) {
  const { board, rootParam, refresh } = useApp()
  const { t, tn } = useT()
  const categoryLabel = useCategoryLabel()
  const defs = statusDefs(settings.statuses)
  const [label, setLabel] = useState("")
  const [category, setCategory] = useState<TaskStatus>("review")
  const [color, setColor] = useState<StatusColor>("blue")
  const [removing, setRemoving] = useState<string | null>(null)
  const [moveTo, setMoveTo] = useState("todo")

  const save = (next: StatusDef[]) => onSave({ ...settings, statuses: next })
  const patch = (id: string, p: Partial<StatusDef>) => save(defs.map((d) => (d.id === id ? { ...d, ...p } : d)))
  const move = (i: number, by: number) => {
    const next = [...defs]
    const [d] = next.splice(i, 1)
    next.splice(i + by, 0, d)
    save(next)
  }
  const tasksIn = (id: string) => Object.values(board ?? {}).flat().filter((x) => x.customStatus === id)

  const newId = slug(label)
  const idError = !label.trim() ? null : !newId ? t("settings.useLetters") : defs.some((d) => d.id === newId) ? t("settings.alreadyExists") : invalidStatusId(newId) && (invalidStatusId(newId)?.startsWith("use ") ? t("settings.idFormat") : t("settings.idBuiltin", { id: newId }))
  function add() {
    if (!label.trim() || idError) return
    save([...defs, { id: newId, label: label.trim(), color, category }])
    setLabel("")
  }

  async function remove(id: string) {
    const ids = tasksIn(id).map((x) => x.id)
    if (ids.length) {
      const res = await fetch(`/api/tasks/bulk${rootParam}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action: { status: moveTo } }),
      })
      if (!res.ok) return toast((await res.json().catch(() => null))?.error ?? t("settings.couldNotMove"))
    }
    await save(defs.filter((d) => d.id !== id))
    setRemoving(null)
    refresh()
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-1 text-xl font-semibold text-txt">{t("settings.tabStatuses")}</h2>
        <p className="text-sm text-muted">{t("settings.statusesHint")}</p>
      </div>

      <div aria-hidden className={cn(ROW, "hidden px-2.5 font-mono text-[10px] uppercase tracking-[0.06em] text-muted sm:grid")}>
        <span />
        <span>{t("settings.colLabel")}</span>
        <span>{t("settings.colId")}</span>
        <span>{t("settings.colColor")}</span>
        <span>{t("settings.colWorksLike")}</span>
        <span />
      </div>
      <ul className="-mt-6 flex flex-col gap-2">
        {defs.map((d, i) => {
          const builtin = (BUILTIN_STATUSES as string[]).includes(d.id)
          const Icon = STATUS_META[d.category].icon
          const count = builtin ? 0 : tasksIn(d.id).length
          return (
            <li key={d.id} className="rounded-lg border border-border bg-surface p-2.5">
              <div className={ROW}>
                <Icon className={cn("size-4 shrink-0", STATUS_COLOR_CLASS[d.color].text)} aria-hidden />
                <Input
                  aria-label={t("settings.labelFor", { id: d.id })}
                  data-user-content
                  defaultValue={d.label}
                  key={`${d.id}:${d.label}`}
                  onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== d.label) patch(d.id, { label: v }) }}
                  onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
                  className="h-8 w-full border-border bg-bg text-txt"
                />
                <div className="order-last col-span-3 flex min-w-0 items-center gap-2 pl-6 sm:order-none sm:contents">
                <span className="w-20 shrink-0 truncate font-mono text-[11px] text-muted sm:w-auto" title={d.id} data-user-content>{d.id}</span>
                <select aria-label={t("settings.colorFor", { id: d.id })} value={d.color} onChange={(e) => patch(d.id, { color: e.target.value as StatusColor })} className={cn(FIELD, "min-w-0")}>
                  {STATUS_COLORS.map((c) => <option key={c} value={c}>{t(COLOR_KEY[c])}</option>)}
                </select>
                {builtin ? (
                  <span className="px-2 text-xs text-muted" title={t("settings.builtInHint")}>{t("settings.builtIn")}</span>
                ) : (
                  <select
                    aria-label={t("settings.categoryFor", { id: d.id })}
                    value={d.category}
                    title={t(CATEGORY_HELP[d.category])}
                    onChange={(e) => patch(d.id, { category: e.target.value as TaskStatus })}
                    className={cn(FIELD, "min-w-0 flex-1")}
                  >
                    {BUILTIN_STATUSES.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}
                  </select>
                )}
                </div>
                <div className="ml-auto flex items-center justify-end">
                  <button type="button" aria-label={t("settings.moveUp", { id: d.id })} disabled={i === 0} onClick={() => move(i, -1)} className={ICON_BTN}><ArrowUp className="size-3.5" /></button>
                  <button type="button" aria-label={t("settings.moveDown", { id: d.id })} disabled={i === defs.length - 1} onClick={() => move(i, 1)} className={ICON_BTN}><ArrowDown className="size-3.5" /></button>
                  {builtin
                    ? <span className="size-7" aria-hidden />
                    : <button type="button" aria-label={t("settings.deleteId", { id: d.id })} onClick={() => { setRemoving(d.id); setMoveTo(d.category) }} className={cn(ICON_BTN, "hover:text-danger")}><Trash2 className="size-3.5" /></button>}
                </div>
              </div>
              {removing === d.id && (
                <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border pt-2 text-xs text-muted">
                  {count > 0 ? tn("settings.moveTasks", count) : t("settings.noTasksUse")}
                  {count > 0 && (
                    <select aria-label={t("settings.moveTasksTo")} value={moveTo} onChange={(e) => setMoveTo(e.target.value)} className={FIELD}>
                      {defs.filter((x) => x.id !== d.id).map((x) => <option key={x.id} value={x.id} data-user-content>{x.label}</option>)}
                    </select>
                  )}
                  <button type="button" onClick={() => remove(d.id)} className="rounded-md border border-danger/40 px-2 py-1 text-danger hover:bg-danger/10">{t("settings.deleteLabel", { label: d.label })}</button>
                  <button type="button" onClick={() => setRemoving(null)} className="px-1 hover:text-txt">{t("settings.cancel")}</button>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <form onSubmit={(e) => { e.preventDefault(); add() }} className="space-y-2 rounded-lg border border-dashed border-border2 p-3">
        <p className="text-sm font-medium text-txt">{t("settings.addStatus")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Input aria-label={t("settings.newStatusLabel")} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="QA" className="h-8 w-40 border-border bg-bg text-txt" />
          <select aria-label={t("settings.newStatusCategory")} value={category} onChange={(e) => setCategory(e.target.value as TaskStatus)} className={FIELD}>
            {BUILTIN_STATUSES.map((c) => <option key={c} value={c}>{t("settings.worksLikeOption", { category: categoryLabel(c), help: t(CATEGORY_HELP[c]) })}</option>)}
          </select>
          <select aria-label={t("settings.newStatusColor")} value={color} onChange={(e) => setColor(e.target.value as StatusColor)} className={FIELD}>
            {STATUS_COLORS.map((c) => <option key={c} value={c}>{t(COLOR_KEY[c])}</option>)}
          </select>
          <button type="submit" disabled={!label.trim() || !!idError} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-xs font-medium text-accent-fg hover:bg-accent/90 disabled:opacity-40">
            <Plus className="size-3.5" /> {t("settings.add")}
          </button>
        </div>
        {label.trim() && <p className={cn("font-mono text-[11px]", idError ? "text-danger" : "text-muted")}>{idError ?? t("settings.idPreview", { id: newId })}</p>}
      </form>
    </div>
  )
}
