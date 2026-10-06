// Run player preferences on Test review (R079): playback speed and auto-pause at each step, remembered per browser
// in one cookie (CLAUDE.md bans localStorage). Pure: `node src/lib/player-prefs.check.mts`.

export const PLAYER_COOKIE = "vibedoc-player"
export const PLAYER_SPEEDS = [0.5, 1, 1.5, 2] as const

export interface PlayerPrefs { speed: number; autoPause: boolean }
export const DEFAULT_PLAYER_PREFS: PlayerPrefs = { speed: 1, autoPause: true }

/** The cookie's value ("speed=0.5&pause=1"); anything missing or unknown falls back to the default. */
export function parsePlayerPrefs(value: string | null | undefined): PlayerPrefs {
  const q = new URLSearchParams(value ?? "")
  const speed = Number(q.get("speed"))
  const pause = q.get("pause")
  return {
    speed: (PLAYER_SPEEDS as readonly number[]).includes(speed) ? speed : DEFAULT_PLAYER_PREFS.speed,
    autoPause: pause === null ? DEFAULT_PLAYER_PREFS.autoPause : pause === "1",
  }
}

export function formatPlayerPrefs(p: PlayerPrefs): string {
  return `speed=${p.speed}&pause=${p.autoPause ? 1 : 0}`
}

/** One cookie's value out of `document.cookie`, decoded; null when it isn't set. */
export function readCookie(all: string, name: string): string | null {
  const hit = all.split(/;\s*/).find((c) => c.startsWith(`${name}=`))
  if (!hit) return null
  try {
    return decodeURIComponent(hit.slice(name.length + 1))
  } catch {
    return null
  }
}

/** A `document.cookie` assignment, same lifetime as the language cookie (`langCookie` in i18n.ts). */
export function playerCookie(p: PlayerPrefs): string {
  return `${PLAYER_COOKIE}=${encodeURIComponent(formatPlayerPrefs(p))}; path=/; max-age=31536000; samesite=lax`
}
