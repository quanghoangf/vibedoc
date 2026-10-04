import type { ActivityEvent } from "@/types"
import type { EventTarget } from "@/lib/activity"
import { ActivityEventRow } from "./ActivityEventRow"
import { DayLabel, dayLabel } from "./SessionTimeline"

/** Every event, newest first, grouped by day on the same clock gutter as the sessions timeline. */
export function ActivityFeed({ activity, onOpen }: { activity: ActivityEvent[]; onOpen?: (target: EventTarget) => void }) {
  return (
    <ol className="flex flex-col">
      {activity.map((e, i) => {
        const label = dayLabel(e.timestamp)
        return (
          <li key={e.id}>
            {(i === 0 || dayLabel(activity[i - 1].timestamp) !== label) && <DayLabel label={label} />}
            <ActivityEventRow event={e} showActor onOpen={onOpen} />
          </li>
        )
      })}
    </ol>
  )
}
