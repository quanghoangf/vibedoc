"use client"

import { cn } from "@/lib/utils"

/**
 * The one on/off switch (Settings). Named by its row's label (`labelledBy` = that element's id) or `label`.
 * The off track is `muted`, not `border`: a track must stand out ≥ 3:1 from its surface in both themes.
 */
export function Switch({ checked, onChange, labelledBy, label, disabled, className }: {
  checked: boolean
  onChange: (next: boolean) => void
  labelledBy?: string
  label?: string
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50",
        checked ? "bg-accent" : "bg-muted",
        className,
      )}
    >
      <span aria-hidden className={cn("absolute top-1 h-4 w-4 rounded-full bg-accent-fg shadow-sm transition-[left]", checked ? "left-6" : "left-1")} />
    </button>
  )
}
