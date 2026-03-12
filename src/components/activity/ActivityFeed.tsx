import type { ActivityEvent } from "@/types"
import { ActivityEventRow } from "./ActivityEventRow"

interface ActivityFeedProps {
  activity: ActivityEvent[]
}

export function ActivityFeed({ activity }: ActivityFeedProps) {
  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
      <div className="flex flex-col gap-0">
        {activity.map((evt) => (
          <ActivityEventRow key={evt.id} event={evt} />
        ))}
      </div>
    </div>
  )
}
