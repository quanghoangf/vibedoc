"use client"

import { Input } from "@/components/ui/input"
import { useT } from "@/context/LanguageContext"
import type { MessageKey } from "@/i18n"
import type { ProjectAnswers } from "./ProjectQuestionnaire"

interface BasicInfoProps {
  answers: ProjectAnswers
  onChange: (answers: ProjectAnswers) => void
}

const PROJECT_TYPES: { value: string; label: MessageKey }[] = [
  { value: "web-app", label: "chat.typeWeb" },
  { value: "api-backend", label: "chat.typeApi" },
  { value: "cli-tool", label: "chat.typeCli" },
  { value: "library", label: "chat.typeLibrary" },
  { value: "mobile-app", label: "chat.typeMobile" },
  { value: "monorepo", label: "chat.typeMonorepo" },
]

export function BasicInfo({ answers, onChange }: BasicInfoProps) {
  const { t } = useT()
  const update = (key: keyof ProjectAnswers, value: string) => {
    onChange({ ...answers, [key]: value })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-txt mb-2">{t("chat.basicInfo")}</h2>
        <p className="text-muted">{t("chat.basicHint")}</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-txt mb-1.5">
            {t("chat.projectName")} <span className="text-red-400">*</span>
          </label>
          <Input
            value={answers.projectName}
            onChange={(e) => update("projectName", e.target.value)}
            placeholder={t("chat.projectNamePlaceholder")}
            className="bg-surface2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-txt mb-1.5">
            {t("chat.projectType")}
          </label>
          <select
            value={answers.projectType}
            onChange={(e) => update("projectType", e.target.value)}
            className="w-full h-10 px-3 rounded-md border border-border bg-surface2 text-txt text-sm focus:outline-hidden focus:ring-2 focus:ring-accent/50"
          >
            {PROJECT_TYPES.map(type => (
              <option key={type.value} value={type.value}>{t(type.label)}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-txt mb-1.5">
            {t("chat.repoUrl")} <span className="text-muted">{t("chat.optional")}</span>
          </label>
          <Input
            value={answers.repoUrl}
            onChange={(e) => update("repoUrl", e.target.value)}
            placeholder="https://github.com/org/repo"
            className="bg-surface2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-txt mb-1.5">
            {t("chat.description")}
          </label>
          <textarea
            value={answers.description}
            onChange={(e) => update("description", e.target.value)}
            placeholder={t("chat.descriptionPlaceholder")}
            rows={3}
            className="w-full px-3 py-2 rounded-md border border-border bg-surface2 text-txt text-sm resize-none focus:outline-hidden focus:ring-2 focus:ring-accent/50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-txt mb-1.5">
            {t("chat.keyFeatures")} <span className="text-muted">{t("chat.optional")}</span>
          </label>
          <Input
            value={answers.keyFeatures}
            onChange={(e) => update("keyFeatures", e.target.value)}
            placeholder={t("chat.featuresPlaceholder")}
            className="bg-surface2"
          />
          <p className="text-xs text-muted mt-1">{t("chat.featuresHint")}</p>
        </div>
      </div>
    </div>
  )
}
