// Every area's messages under one key space: "<area>.<key>" (R078). Add an area here when you add its file.
import type { Lang } from "../lib/i18n"
import * as shell from "./shell"

export const AREAS = { shell }

type Areas = typeof AREAS
type AreaKey<A extends keyof Areas> = keyof Areas[A]["en"] & string
type Flat = { [A in keyof Areas]: `${A}.${AreaKey<A>}` }[keyof Areas]

/** A plural key without its suffix: "shell.agentsWorking" for shell.agentsWorking_one / _other. */
export type PluralKey = Flat extends infer K ? (K extends `${infer B}_other` ? B : never) : never
export type MessageKey = Exclude<Flat, `${string}_one` | `${string}_other`>

export const MESSAGES: Record<Lang, Record<string, string>> = { en: {}, vi: {} }
for (const [area, m] of Object.entries(AREAS)) {
  for (const lang of ["en", "vi"] as const) {
    for (const [k, v] of Object.entries(m[lang])) MESSAGES[lang][`${area}.${k}`] = v
  }
}
