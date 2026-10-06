// node src/lib/player-prefs.check.mts
import assert from "node:assert/strict"
import { DEFAULT_PLAYER_PREFS, PLAYER_COOKIE, formatPlayerPrefs, parsePlayerPrefs, playerCookie, readCookie } from "./player-prefs.ts"

assert.deepEqual(parsePlayerPrefs(null), DEFAULT_PLAYER_PREFS)
assert.deepEqual(parsePlayerPrefs(""), { speed: 1, autoPause: true })
assert.deepEqual(parsePlayerPrefs("speed=0.5&pause=0"), { speed: 0.5, autoPause: false })
assert.deepEqual(parsePlayerPrefs("speed=3&pause=x"), { speed: 1, autoPause: false }, "unknown speed → 1; any pause but 1 → off")
assert.deepEqual(parsePlayerPrefs("speed=abc"), { speed: 1, autoPause: true })
for (const p of [{ speed: 2, autoPause: false }, { speed: 1.5, autoPause: true }]) assert.deepEqual(parsePlayerPrefs(formatPlayerPrefs(p)), p)

const set = playerCookie({ speed: 0.5, autoPause: true })
assert.match(set, /^vibedoc-player=speed%3D0\.5%26pause%3D1; path=\/; max-age=31536000; samesite=lax$/)
const jar = `vibedoc-lang=vi; ${set.split(";")[0]}; other=1`
assert.deepEqual(parsePlayerPrefs(readCookie(jar, PLAYER_COOKIE)), { speed: 0.5, autoPause: true })
assert.equal(readCookie("vibedoc-lang=vi", PLAYER_COOKIE), null)
assert.equal(readCookie("vibedoc-player=%E0%A4%A", PLAYER_COOKIE), null, "a broken value reads as unset")

console.log("player-prefs.check: ok")
