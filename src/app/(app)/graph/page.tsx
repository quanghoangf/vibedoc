"use client"

import { Suspense } from "react"
import { DocGraph } from "@/components/graph/DocGraph"

export default function GraphPage() {
  // main has no fixed height; the canvas needs one (viewport minus the h-12 AppHeader)
  return (
    <div className="flex h-[calc(100svh-3rem)] flex-col">
      <Suspense>
        <DocGraph />
      </Suspense>
    </div>
  )
}
