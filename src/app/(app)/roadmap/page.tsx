"use client"

import { Suspense } from "react"
import { RoadmapTab } from "@/components/roadmap/RoadmapTab"
import { GroupRoadmap } from "@/components/roadmap/GroupRoadmap"
import { useApp } from "@/context/AppContext"

export default function RoadmapPage() {
  // R102: a group shows every member's epics on one Timeline; a project its own map
  const { activeGroup } = useApp()
  // main has no fixed height; the canvas needs one (viewport minus the h-12 AppHeader)
  return (
    <div className="flex flex-col h-[calc(100svh-3rem)]">
      <Suspense>
        {activeGroup ? <GroupRoadmap group={activeGroup} /> : <RoadmapTab />}
      </Suspense>
    </div>
  )
}
