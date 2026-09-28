"use client"

import { RoadmapTab } from "@/components/roadmap/RoadmapTab"

export default function RoadmapPage() {
  // main has no fixed height; the canvas needs one (viewport minus the h-12 AppHeader)
  return (
    <div className="flex flex-col h-[calc(100svh-3rem)]">
      <RoadmapTab />
    </div>
  )
}
