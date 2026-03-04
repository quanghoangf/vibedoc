"use client"

import { useApp } from "@/context/AppContext"
import { ActivityTab } from "@/components/activity/ActivityTab"

export default function ActivityPage() {
  const { activity, liveIndicator } = useApp()
  return <ActivityTab activity={activity} liveIndicator={liveIndicator} />
}
