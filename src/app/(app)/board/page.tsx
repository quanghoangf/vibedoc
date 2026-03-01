"use client"

import { useApp } from "@/context/AppContext"
import { BoardTab } from "@/components/board/BoardTab"

export default function BoardPage() {
  const { board, summary, moveTask, openDoc } = useApp()
  if (!board) return null
  return <BoardTab board={board} summary={summary} onMoveTask={moveTask} onOpenTask={openDoc} />
}
