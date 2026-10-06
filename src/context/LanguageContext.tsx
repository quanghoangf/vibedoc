"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import { interpolate, langCookie, pluralSuffix, DEFAULT_LANG, type Lang } from "@/lib/i18n"
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

/** t("shell.board"), t("shell.ago", { time }); tn("shell.agentsWorking", n) picks the _one / _other message. */
export function useT() {
  const { lang } = useContext(LanguageContext)
  return useMemo(() => {
    const dict = MESSAGES[lang]
    const t = (key: MessageKey, vars?: Vars) => interpolate(dict[key] ?? key, vars)
    const tn = (key: PluralKey, n: number, vars?: Vars) => {
      const suffix = pluralSuffix(lang, n, (s) => `${key}_${s}` in dict)
      return interpolate(dict[`${key}_${suffix}`] ?? key, { n, ...vars })
    }
    return { t, tn, lang }
  }, [lang])
}
