import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon: string
  message: string
  subMessage?: string
  bordered?: boolean
}

export function EmptyState({ icon, message, subMessage, bordered }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "text-center py-16 text-muted text-sm",
        bordered && "border border-dashed border-border rounded-xl",
      )}
    >
      <p className="text-3xl mb-3">{icon}</p>
      <p>{message}</p>
      {subMessage && <p className="text-xs mt-1">{subMessage}</p>}
    </div>
  )
}
