import type { ActivityEvent } from "@/types"
import type { EventTarget } from "@/lib/activity"
import { ActivityEventRow } from "./ActivityEventRow"
import { DayLabel } from "./SessionTimeline"
import { useFormat } from "@/context/LanguageContext"

/** Every event, newest first, grouped by day on the same clock gutter as the sessions timeline. */
export function ActivityFeed({ activity, onOpen }: { activity: ActivityEvent[]; onOpen?: (target: EventTarget) => void }) {
  const f = useFormat()
  return (
    <ol className="flex flex-col">
      {activity.map((e, i) => {
        const label = f.dayHeading(e.timestamp)
        return (
          <li key={e.id}>
            {(i === 0 || f.dayHeading(activity[i - 1].timestamp) !== label) && <DayLabel label={label} />}
            <ActivityEventRow event={e} showActor onOpen={onOpen} />
          </li>
        )
      })}
    </ol>
  )
}
