import { useSyncExternalStore } from "react"

const subscribe = () => () => {}

/** window.location.origin on the client, "" during server render. */
export function useOrigin() {
  return useSyncExternalStore(subscribe, () => window.location.origin, () => "")
}
