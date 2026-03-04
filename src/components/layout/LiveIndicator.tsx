import { cn } from "@/lib/utils"

interface LiveIndicatorProps {
  active: boolean
}

export function LiveIndicator({ active }: LiveIndicatorProps) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-mono text-muted">
      <div
        className={cn(
          "w-1.5 h-1.5 rounded-full transition-colors duration-500",
          active ? "bg-teal shadow-[0_0_6px_#4fd8b4]" : "bg-border2",
        )}
      />
      <span>{active ? "live update" : "connected"}</span>
    </div>
  )
}
