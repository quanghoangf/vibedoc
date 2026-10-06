"use client"

import { useT } from "@/context/LanguageContext"
import type { MessageKey } from "@/i18n"
import type { TemplatePreset } from "@/lib/presets"

// Presets and tech categories are data in src/lib (presets.ts, tech-stacks.ts); their UI text is mapped here by id / label.
const PRESET_DESC: Record<string, MessageKey> = {
  "nextjs-production": "chat.presetNextjs",
  "api-backend": "chat.presetApi",
  "library-sdk": "chat.presetLibrary",
  "cli-tool": "chat.presetCli",
  monorepo: "chat.presetMonorepo",
  "ai-first": "chat.presetAiFirst",
  minimal: "chat.presetMinimal",
}
const PRESET_NAME: Record<string, MessageKey> = {
  "library-sdk": "chat.typeLibrary",
  "cli-tool": "chat.typeCli",
  minimal: "chat.presetMinimalName",
}
const TECH_CATEGORY: Record<string, MessageKey> = {
  Language: "chat.techLanguage",
  Testing: "chat.techTesting",
  Tools: "chat.techTools",
}

export function useSetupText() {
  const { t } = useT()
  return {
    presetName: (p: Pick<TemplatePreset, "id" | "name">) => (PRESET_NAME[p.id] ? t(PRESET_NAME[p.id]) : p.name),
    presetDescription: (p: Pick<TemplatePreset, "id" | "description">) => (PRESET_DESC[p.id] ? t(PRESET_DESC[p.id]) : p.description),
    techCategory: (label: string) => (TECH_CATEGORY[label] ? t(TECH_CATEGORY[label]) : label),
    /** A template's name / description from src/i18n/templates.ts (as in NewDocModal), else its own English. */
    template: (id: string, field: "name" | "description", fallback: string) => {
      const key = (field === "name" ? `templates.${id}:name` : `templates.${id}`) as MessageKey
      const text = t(key)
      return text === key ? fallback : text
    },
  }
}
