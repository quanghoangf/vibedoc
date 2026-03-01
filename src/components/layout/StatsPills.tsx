interface StatsPillsProps {
  board: Record<string, number>
}

export function StatsPills({ board }: StatsPillsProps) {
  return (
    <div className="flex items-center gap-2 text-xs font-mono">
      <span className="px-2 py-0.5 rounded-full bg-surface2 border border-border text-amber">
        🔨 {board["in-progress"] || 0}
      </span>
      <span className="px-2 py-0.5 rounded-full bg-surface2 border border-border text-muted">
        📋 {board.todo || 0}
      </span>
      <span className="px-2 py-0.5 rounded-full bg-surface2 border border-border text-teal">
        ✅ {board.done || 0}
      </span>
    </div>
  )
}
