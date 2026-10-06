// UI languages (R078). Pure: no React, no fs, so `node src/lib/i18n.check.mts` runs it as is.
// Messages live in src/i18n/<area>.ts; the language is a per-browser cookie read by the root layout.

export const LANGS = ["en", "vi"] as const
export type Lang = (typeof LANGS)[number]
export const DEFAULT_LANG: Lang = "en"
export const LANG_COOKIE = "vibedoc-lang"

/** An area's Vietnamese (or any later language) must have exactly the keys of its English. */
export type Messages<T> = { [K in keyof T]: string }

export function parseLang(value: string | null | undefined): Lang {
  return (LANGS as readonly string[]).includes(value ?? "") ? (value as Lang) : DEFAULT_LANG
}

/** `{name}` → vars.name; an unknown placeholder stays as written so a missing var is visible, not blank. */
export function interpolate(msg: string, vars?: Record<string, string | number>): string {
  if (!vars) return msg
  return msg.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))
}

/** The plural suffix for n: Intl's category when the message has it, else `other` (Vietnamese is always `other`). */
export function pluralSuffix(lang: Lang, n: number, has: (suffix: string) => boolean): string {
  const cat = new Intl.PluralRules(lang).select(n)
  return has(cat) ? cat : "other"
}

export function placeholders(msg: string): string[] {
  return [...new Set([...msg.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort()
}

/** Keys whose translation doesn't use the same {placeholders} as the English. */
export function placeholderMismatches(en: Record<string, string>, other: Record<string, string>): string[] {
  return Object.keys(en).filter((k) => placeholders(en[k]).join() !== placeholders(other[k] ?? "").join())
}

/** The cookie line the client writes when the user picks a language (a year, the whole app). */
export function langCookie(lang: Lang): string {
  return `${LANG_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`
}

// ── Dates and numbers (T216) ──────────────────────────────────────────────────────────────────────────
// English keeps what each call showed before R078: the browser's locale unless the call names one (`en`).
// Vietnamese always formats as Vietnamese.

type When = string | number | Date

/** The Intl locale for `lang`; `en` is the locale an English call used before (undefined = the browser's). */
export function intlLocale(lang: Lang, en?: string): string | undefined {
  return lang === "en" ? en : lang
}

export function formatDate(lang: Lang, value: When, opts: Intl.DateTimeFormatOptions, en?: string): string {
  return new Intl.DateTimeFormat(intlLocale(lang, en), opts).format(new Date(value))
}

/** Date and time, as toLocaleString() did. */
export function formatDateTime(lang: Lang, value: When): string {
  return new Date(value).toLocaleString(intlLocale(lang))
}

/** 24-hour "14:05". */
export function formatClock(lang: Lang, value: When): string {
  return formatDate(lang, value, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
}

export function formatNumber(lang: Lang, n: number): string {
  return n.toLocaleString(intlLocale(lang))
}

const JUST_NOW: Record<Lang, string> = { en: "just now", vi: "vừa xong" }
const NOW_SHORT: Record<Lang, string> = { en: "now", vi: "vừa xong" }

function sinceUnit(ms: number): [number, "minute" | "hour" | "day"] | null {
  const min = Math.floor(Math.max(0, ms) / 60_000)
  if (min < 1) return null
  if (min < 60) return [min, "minute"]
  if (min < 60 * 24) return [Math.floor(min / 60), "hour"]
  return [Math.floor(min / (60 * 24)), "day"]
}

/** "just now", "5m ago", "3h ago", "2d ago" · "vừa xong", "5 phút trước". */
export function timeAgo(lang: Lang, value: When, nowMs = Date.now()): string {
  const u = sinceUnit(nowMs - new Date(value).getTime())
  if (!u) return JUST_NOW[lang]
  return new Intl.RelativeTimeFormat(lang, { style: "narrow", numeric: "always" }).format(-u[0], u[1])
}

/** List rows: "now", "5m", "3h", "2d" · "vừa xong", "5 phút". */
export function agoShort(lang: Lang, value: When, nowMs = Date.now()): string {
  const u = sinceUnit(nowMs - new Date(value).getTime())
  if (!u) return NOW_SHORT[lang]
  return new Intl.NumberFormat(lang, { style: "unit", unit: u[1], unitDisplay: "narrow" }).format(u[0])
}

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** Short month name for month 1–12: "Oct" · "thg 10". */
export function monthName(lang: Lang, m: number): string {
  if (lang === "en") return MONTHS_EN[m - 1]
  return new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", timeZone: "UTC" })
    .formatToParts(Date.UTC(2000, m - 1, 1)).find((p) => p.type === "month")?.value ?? String(m)
}

/** A calendar date "YYYY-MM-DD" (a roadmap Due, no time zone): "15 Oct" · "15 thg 10". Never shifts a day. */
export function formatDay(lang: Lang, ymd: string): string {
  const [, m, d] = ymd.split("-").map(Number)
  return `${d} ${monthName(lang, m)}`
}

/** A day heading in a feed: "Today" / "Yesterday" / "Tue, Oct 6" · "Hôm nay" / "Hôm qua" / "Th 3, 6 thg 10". */
export function dayHeading(lang: Lang, value: When, nowMs = Date.now()): string {
  const d = new Date(value)
  const today = new Date(nowMs)
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const rel = d.toDateString() === today.toDateString() ? 0 : d.toDateString() === yesterday.toDateString() ? -1 : null
  if (rel === null) return formatDate(lang, d, { weekday: "short", month: "short", day: "numeric" })
  const s = new Intl.RelativeTimeFormat(lang, { numeric: "auto" }).format(rel, "day")
  return s.charAt(0).toUpperCase() + s.slice(1)
}
