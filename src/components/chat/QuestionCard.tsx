"use client"

import { useState } from "react"
import { useT } from "@/context/LanguageContext"
import { cn } from "@/lib/utils"

export interface QuestionOption { label: string; description?: string }
export interface Question { question: string; header: string; multiSelect: boolean; options: QuestionOption[] }

export interface QuestionSet {
  id: string
  questions: Question[]
  /** Set once submitted: one answer string per question, in the same order */
  answers?: string[]
}

/** Just enough shape to render, checked before the server has validated the tool input. */
export function isRenderableQuestions(v: unknown): v is Question[] {
  const isStr = (x: unknown) => typeof x === "string"
  return Array.isArray(v) && v.length > 0 && v.every((q) =>
    !!q && typeof q === "object" && isStr(q.question) && isStr(q.header) && Array.isArray(q.options) &&
    q.options.every((o: unknown) => !!o && typeof o === "object" && isStr((o as QuestionOption).label)))
}

const OTHER = "\u0000other"

/** Answer message format the agent parses: one line per question, keyed by header, labels verbatim. */
export function formatAnswers(questions: Question[], answers: string[]): string {
  return ["Answers:", ...questions.map((q, i) => `- ${q.header}: ${answers[i]}`)].join("\n")
}

export function QuestionCard({ set, disabled, onSubmit }: {
  set: QuestionSet
  disabled?: boolean
  onSubmit: (answers: string[]) => void
}) {
  const [picked, setPicked] = useState<string[][]>(() => set.questions.map(() => []))
  const [other, setOther] = useState<string[]>(() => set.questions.map(() => ""))
  const done = !!set.answers
  const { t } = useT()

  function toggle(qi: number, value: string, multi: boolean) {
    setPicked((prev) => prev.map((p, i) => {
      if (i !== qi) return p
      if (!multi) return [value]
      return p.includes(value) ? p.filter((v) => v !== value) : [...p, value]
    }))
  }

  // Keep the order the options were offered in, with Other last
  const answers = set.questions.map((q, i) => {
    const labels = q.options.map((o) => o.label).filter((l) => picked[i].includes(l))
    if (picked[i].includes(OTHER) && other[i].trim()) labels.push(`Other: "${other[i].trim()}"`)
    return labels.join(", ")
  })
  const complete = answers.every(Boolean)

  return (
    <div className="my-2 rounded-md border border-border overflow-hidden" data-question-card>
      <div className="flex items-center gap-2 px-2 py-1.5 bg-surface2 border-b border-border">
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted">{t("chat.questions")}</span>
        {done && <span className="ml-auto text-[10px] font-mono text-accent">{t("chat.answered")}</span>}
      </div>
      <div className="p-2 space-y-3">
        {set.questions.map((q, qi) => (
          <fieldset key={qi} disabled={done} className="space-y-1">
            <legend className="mb-1">
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-surface2 border border-border text-accent mr-1.5" data-user-content>{q.header}</span>
              <span data-user-content className="text-xs text-txt">{q.question}</span>
            </legend>
            {done ? (
              <p data-user-content className="text-xs text-txt pl-1">{set.answers?.[qi]}</p>
            ) : (
              <>
                {[...q.options, { label: t("chat.other"), value: OTHER }].map((o) => {
                  const value = "value" in o ? o.value : o.label
                  const checked = picked[qi].includes(value)
                  return (
                    <label key={value} className={cn("flex gap-2 items-start rounded-sm px-1 py-0.5 cursor-pointer hover:bg-surface2", checked && "bg-surface2")}>
                      <input
                        type={q.multiSelect ? "checkbox" : "radio"}
                        name={`${set.id}-${qi}`}
                        checked={checked}
                        onChange={() => toggle(qi, value, q.multiSelect)}
                        className="mt-0.5 accent-accent"
                      />
                      <span className="text-xs" data-user-content={"value" in o ? undefined : true}>
                        <span className="text-txt">{o.label}</span>
                        {"description" in o && o.description && <span className="block text-muted">{o.description}</span>}
                      </span>
                    </label>
                  )
                })}
                {picked[qi].includes(OTHER) && (
                  <input
                    value={other[qi]}
                    onChange={(e) => setOther((prev) => prev.map((v, i) => (i === qi ? e.target.value : v)))}
                    placeholder={t("chat.yourAnswer")}
                    aria-label={t("chat.otherFor", { header: q.header })}
                    className="ml-6 w-[calc(100%-1.5rem)] rounded-sm bg-surface2 border border-border px-2 py-1 text-xs text-txt placeholder:text-muted focus:outline-hidden focus:border-accent"
                  />
                )}
              </>
            )}
          </fieldset>
        ))}
        {!done && (
          <button
            onClick={() => onSubmit(answers)}
            disabled={!complete || disabled}
            className="text-xs px-2 py-0.5 rounded-sm bg-accent/20 text-accent hover:bg-accent/30 disabled:opacity-50"
          >
            {t("chat.submit")}
          </button>
        )}
      </div>
    </div>
  )
}
