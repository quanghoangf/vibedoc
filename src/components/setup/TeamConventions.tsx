"use client"

import { Input } from "@/components/ui/input"
import { TechStackInput } from "./TechStackInput"
import type { ProjectAnswers } from "./ProjectQuestionnaire"
import { cn } from "@/lib/utils"

interface TeamConventionsProps {
  answers: ProjectAnswers
  onChange: (answers: ProjectAnswers) => void
}

const TEAM_SIZES = [
  { value: "solo", label: "Solo" },
  { value: "2-5", label: "2–5" },
  { value: "6-15", label: "6–15" },
  { value: "15+", label: "15+" },
]

const TEST_FRAMEWORKS = [
  { value: "", label: "Not sure / other" },
  { value: "Jest", label: "Jest" },
  { value: "Vitest", label: "Vitest" },
  { value: "pytest", label: "pytest" },
  { value: "RSpec", label: "RSpec" },
  { value: "Mocha", label: "Mocha" },
]

const BRANCH_STRATEGIES = [
  { value: "", label: "Not specified" },
  { value: "trunk-based", label: "Trunk-based" },
  { value: "gitflow", label: "Gitflow" },
  { value: "feature-branch", label: "Feature branches" },
]

const CI_CD_OPTIONS = ["GitHub Actions", "GitLab CI", "CircleCI", "Jenkins", "Buildkite", "Travis CI"]
const LINTING_OPTIONS = ["ESLint", "Prettier", "Biome", "Stylelint", "oxc", "Rome"]
const DEPLOYMENT_OPTIONS = ["Vercel", "AWS", "GCP", "Azure", "Fly.io", "Railway", "Render", "Docker", "Kubernetes", "Heroku"]

export function TeamConventions({ answers, onChange }: TeamConventionsProps) {
  const update = <K extends keyof ProjectAnswers>(key: K, value: ProjectAnswers[K]) => {
    onChange({ ...answers, [key]: value })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-txt mb-2">Team & Conventions</h2>
        <p className="text-muted">Help us tailor documentation to your team. All fields are optional.</p>
      </div>

      <div className="space-y-5">
        {/* Team size */}
        <div>
          <label className="block text-sm font-medium text-txt mb-2">Team Size</label>
          <div className="flex gap-2 flex-wrap">
            {TEAM_SIZES.map(size => (
              <button
                key={size.value}
                type="button"
                onClick={() => update("teamSize", answers.teamSize === size.value ? "" : size.value)}
                className={cn(
                  "px-4 py-2 rounded-lg border text-sm font-medium transition-all",
                  answers.teamSize === size.value
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-txt hover:border-accent/50"
                )}
              >
                {size.label}
              </button>
            ))}
          </div>
        </div>

        {/* Linting */}
        <div>
          <label className="block text-sm font-medium text-txt mb-1.5">Linting & Formatting</label>
          <div className="flex gap-2 flex-wrap mb-2">
            {LINTING_OPTIONS.map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  const next = answers.linting.includes(opt)
                    ? answers.linting.filter(l => l !== opt)
                    : [...answers.linting, opt]
                  update("linting", next)
                }}
                className={cn(
                  "px-3 py-1.5 rounded-md border text-sm transition-all",
                  answers.linting.includes(opt)
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-txt hover:border-accent/50"
                )}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Test framework */}
        <div>
          <label className="block text-sm font-medium text-txt mb-1.5">Test Framework</label>
          <select
            value={answers.testFramework}
            onChange={(e) => update("testFramework", e.target.value)}
            className="w-full h-10 px-3 rounded-md border border-border bg-surface2 text-txt text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
          >
            {TEST_FRAMEWORKS.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>

        {/* CI/CD */}
        <div>
          <label className="block text-sm font-medium text-txt mb-1.5">CI/CD</label>
          <div className="flex gap-2 flex-wrap mb-2">
            {CI_CD_OPTIONS.map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  const next = answers.ciCd.includes(opt)
                    ? answers.ciCd.filter(c => c !== opt)
                    : [...answers.ciCd, opt]
                  update("ciCd", next)
                }}
                className={cn(
                  "px-3 py-1.5 rounded-md border text-sm transition-all",
                  answers.ciCd.includes(opt)
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-txt hover:border-accent/50"
                )}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Branch strategy */}
        <div>
          <label className="block text-sm font-medium text-txt mb-2">Branch Strategy</label>
          <div className="flex gap-2 flex-wrap">
            {BRANCH_STRATEGIES.filter(b => b.value).map(b => (
              <button
                key={b.value}
                type="button"
                onClick={() => update("branchStrategy", answers.branchStrategy === b.value ? "" : b.value)}
                className={cn(
                  "px-4 py-2 rounded-lg border text-sm font-medium transition-all",
                  answers.branchStrategy === b.value
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-txt hover:border-accent/50"
                )}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        {/* Deployment target */}
        <div>
          <label className="block text-sm font-medium text-txt mb-1.5">Deployment Target</label>
          <div className="flex gap-2 flex-wrap">
            {DEPLOYMENT_OPTIONS.map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  const next = answers.deploymentTarget.includes(opt)
                    ? answers.deploymentTarget.filter(d => d !== opt)
                    : [...answers.deploymentTarget, opt]
                  update("deploymentTarget", next)
                }}
                className={cn(
                  "px-3 py-1.5 rounded-md border text-sm transition-all",
                  answers.deploymentTarget.includes(opt)
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-txt hover:border-accent/50"
                )}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Additional conventions */}
        <div>
          <label className="block text-sm font-medium text-txt mb-1.5">
            Additional Conventions <span className="text-muted">(optional)</span>
          </label>
          <Input
            value={answers.conventions}
            onChange={(e) => update("conventions", e.target.value)}
            placeholder="Conventional Commits, semantic versioning, etc."
            className="bg-surface2"
          />
        </div>
      </div>
    </div>
  )
}
