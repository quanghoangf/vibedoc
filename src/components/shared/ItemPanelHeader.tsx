import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export interface ItemProperty {
  label: string
  /** null / undefined / false = the row is left out */
  value: ReactNode
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
  const shown = properties.filter((p) => p.value !== null && p.value !== undefined && p.value !== false)
  return (
    <header data-item-header className={cn("flex shrink-0 flex-col gap-2 border-b border-border px-5 pb-4 pt-4", className)}>
      <div className="flex min-h-7 items-center gap-2 pr-8 font-mono text-[11px] text-muted">
        <div className="flex min-w-0 flex-1 items-center gap-1">{kicker}</div>
        {menu}
      </div>
      <div className="text-base font-semibold leading-snug text-txt">{title}</div>
      {shown.length > 0 && (
        <dl className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 text-xs">
          {shown.map((p) => (
            <div key={p.label} className="contents">
              <dt className="text-muted">{p.label}</dt>
              <dd className="flex min-w-0 items-center gap-2 text-txt">{p.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {children}
    </header>
  )
}
