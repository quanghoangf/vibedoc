import { Badge } from "@/components/ui/badge"

interface StatsPillsProps {
  board: Record<string, number>
}

export function StatsPills({ board }: StatsPillsProps) {
  return (
    <div className="flex items-center gap-1.5">
      <Badge variant="secondary" className="gap-1 text-xs font-mono text-amber">
        🔨 {board["in-progress"] || 0}
      </Badge>
      <Badge variant="secondary" className="gap-1 text-xs font-mono text-muted">
        📋 {board.todo || 0}
      </Badge>
      <Badge variant="secondary" className="gap-1 text-xs font-mono text-teal">
        ✅ {board.done || 0}
      </Badge>
    </div>
  )
}
