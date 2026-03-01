import type { ActivityEvent } from "@/types"
import { ActivityFeed } from "./ActivityFeed"
import { EmptyState } from "@/components/shared/EmptyState"

interface ActivityTabProps {
  activity: ActivityEvent[]
  liveIndicator: boolean
}

export function ActivityTab({ activity, liveIndicator }: ActivityTabProps) {
  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-xl">Activity Feed</h1>
        <div className="flex items-center gap-1.5 text-xs font-mono text-teal">
          <div className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse" />
          live
        </div>
      </div>

      {activity.length === 0 ? (
        <EmptyState
          icon="⚡"
          message="No activity yet."
          subMessage="Connect an AI agent to see real-time updates here."
        />
      ) : (
        <ActivityFeed activity={activity} />
      )}
    </div>
  )
}
