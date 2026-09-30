import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ItemProperty {
  label: ReactNode
  /** Row key when the label is not a string */
  id?: string
  icon?: LucideIcon
  /** null / undefined / false = the row is left out */
  value: ReactNode
}

/**
 * Notion-style property rows: icon + name on the left, the value (usually an inline editor) on the right.
 * Task, epic and doc panels all use it, so a property reads the same wherever it shows.
 */
export function PropertyRows({ properties, className, children }: {
  properties: ItemProperty[]
  className?: string
  /** A last full-width row, e.g. "Add a property" */
  children?: ReactNode
}) {
  const shown = properties.filter((p) => p.value !== null && p.value !== undefined && p.value !== false)
  if (shown.length === 0 && !children) return null
  return (
    <dl className={cn("grid grid-cols-[minmax(6.5rem,8.5rem)_minmax(0,1fr)] items-center gap-x-2 text-[13px]", className)}>
      {shown.map((p) => (
        <div key={p.id ?? String(p.label)} className="contents">
          <dt className="flex min-h-8 min-w-0 items-center gap-2 text-muted">
            {p.icon && <p.icon className="size-3.5 shrink-0" aria-hidden />}
            <span className="min-w-0 truncate">{p.label}</span>
          </dt>
          <dd className="flex min-h-8 min-w-0 items-center gap-2 text-txt">{p.value}</dd>
        </div>
      ))}
      {children && <div className="col-span-2 flex min-h-8 items-center">{children}</div>}
    </dl>
  )
}

/**
 * The one header every item panel uses (task, epic, doc): a kicker line (id · kind / breadcrumb) with the
 * ⋯ menu always at its right end, the title, then a properties grid.
 * `title` is a node so a Sheet can pass its SheetTitle.
 */
export function ItemPanelHeader({ kicker, title, menu, properties, className, children }: {
  kicker: ReactNode
  title: ReactNode
  menu?: ReactNode
  properties: ItemProperty[]
  className?: string
  /** Extra header content under the properties (e.g. an epic's progress) */
  children?: ReactNode
}) {
  return (
    <header data-item-header className={cn("flex shrink-0 flex-col gap-2 border-b border-border px-5 pb-4 pt-4", className)}>
      <div className="flex min-h-7 items-center gap-2 pr-8 font-mono text-[11px] text-muted">
        <div className="flex min-w-0 flex-1 items-center gap-1">{kicker}</div>
        {menu}
      </div>
      <div className="text-base font-semibold leading-snug text-txt">{title}</div>
      <PropertyRows properties={properties} className="-my-0.5" />
      {children}
    </header>
  )
}
