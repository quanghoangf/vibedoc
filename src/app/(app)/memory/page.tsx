"use client"

import { useApp } from "@/context/AppContext"
import { MemoryTab } from "@/components/memory/MemoryTab"

export default function MemoryPage() {
  const { summary } = useApp()
  return <MemoryTab memory={summary?.memory ?? null} />
}
