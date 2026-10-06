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
