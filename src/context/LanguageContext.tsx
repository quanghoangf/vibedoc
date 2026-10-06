"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import {
  agoShort, dayHeading, formatClock, formatDuration, formatDate, formatDateTime, formatDay, formatNumber, interpolate, langCookie, monthName,
  parseLang, pluralSuffix, timeAgo, DEFAULT_LANG, type Lang,
} from "@/lib/i18n"
import { MESSAGES, type MessageKey, type PluralKey } from "@/i18n"

type Vars = Record<string, string | number>

interface LanguageValue {
  lang: Lang
  setLang: (lang: Lang) => void
}

const LanguageContext = createContext<LanguageValue>({ lang: DEFAULT_LANG, setLang: () => {} })

/** The UI language (R078). `initial` comes from the cookie the root layout read, so the first paint is already right. */
export function LanguageProvider({ initial, children }: { initial: Lang; children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initial)
  const setLang = useCallback((next: Lang) => {
    document.cookie = langCookie(next)
    document.documentElement.lang = next
    setLangState(next)
  }, [])
  const value = useMemo(() => ({ lang, setLang }), [lang, setLang])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLang(): LanguageValue {
  return useContext(LanguageContext)
}

function translate(lang: Lang, key: MessageKey, vars?: Vars): string {
  return interpolate(MESSAGES[lang][key] ?? key, vars)
}

function translatePlural(lang: Lang, key: PluralKey, n: number, vars?: Vars): string {
  const dict = MESSAGES[lang]
  const suffix = pluralSuffix(lang, n, (s) => `${key}_${s}` in dict)
  return interpolate(dict[`${key}_${suffix}`] ?? key, { n, ...vars })
}

/**
 * For code outside React (a toast from a fetch helper): the language the page shows now, from <html lang>.
 * Components use useT(), which re-renders when the language changes.
 */
export function tNow(key: MessageKey, vars?: Vars): string {
  return translate(parseLang(typeof document === "undefined" ? null : document.documentElement.lang), key, vars)
}

export function tnNow(key: PluralKey, n: number, vars?: Vars): string {
  return translatePlural(parseLang(typeof document === "undefined" ? null : document.documentElement.lang), key, n, vars)
}

/** t("shell.board"), t("board.dueOn", { date }); tn("shell.agentsWorking", n) picks the _one / _other message. */
export function useT() {
  const { lang } = useContext(LanguageContext)
  return useMemo(() => {
    const t = (key: MessageKey, vars?: Vars) => translate(lang, key, vars)
    const tn = (key: PluralKey, n: number, vars?: Vars) => translatePlural(lang, key, n, vars)
    return { t, tn, lang }
  }, [lang])
}

type When = string | number | Date

export type Format = ReturnType<typeof useFormat>

/** The date/number formatters of src/lib/i18n.ts bound to the current language (T216). */
export function useFormat() {
  const { lang } = useContext(LanguageContext)
  return useMemo(() => ({
    lang,
    timeAgo: (v: When, now?: number) => timeAgo(lang, v, now),
    agoShort: (v: When, now?: number) => agoShort(lang, v, now),
    clock: (v: When) => formatClock(lang, v),
    dateTime: (v: When) => formatDateTime(lang, v),
    date: (v: When, opts: Intl.DateTimeFormatOptions, en?: string) => formatDate(lang, v, opts, en),
    number: (n: number) => formatNumber(lang, n),
    day: (ymd: string) => formatDay(lang, ymd),
    month: (m: number) => monthName(lang, m),
    dayHeading: (v: When) => dayHeading(lang, v),
    duration: (minutes: number) => formatDuration(lang, minutes),
  }), [lang])
}
