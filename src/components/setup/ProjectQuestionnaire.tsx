"use client"

import { Input } from "@/components/ui/input"

export interface ProjectAnswers {
  projectName: string
  projectType: string
  techStack: string
  description: string
  keyFeatures: string
  conventions: string
}

interface ProjectQuestionnaireProps {
  answers: ProjectAnswers
  onChange: (answers: ProjectAnswers) => void
}

const PROJECT_TYPES = [
  { value: "web-app", label: "Web Application" },
  { value: "api-backend", label: "API / Backend" },
  { value: "cli-tool", label: "CLI Tool" },
  { value: "library", label: "Library / SDK" },
  { value: "mobile-app", label: "Mobile App" },
  { value: "monorepo", label: "Monorepo" },
]

export function ProjectQuestionnaire({ answers, onChange }: ProjectQuestionnaireProps) {
  const update = (key: keyof ProjectAnswers, value: string) => {
    onChange({ ...answers, [key]: value })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-txt mb-2">Project Information</h2>
        <p className="text-muted">Tell us about your project to customize the documentation.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-txt mb-1.5">
            Project Name <span className="text-red-400">*</span>
          </label>
          <Input
            value={answers.projectName}
            onChange={(e) => update("projectName", e.target.value)}
            placeholder="My Awesome Project"
            className="bg-surface2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-txt mb-1.5">
            Project Type
          </label>
          <select
            value={answers.projectType}
            onChange={(e) => update("projectType", e.target.value)}
            className="w-full h-10 px-3 rounded-md border border-border bg-surface2 text-txt text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
          >
            {PROJECT_TYPES.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-txt mb-1.5">
            Tech Stack
          </label>
          <Input
            value={answers.techStack}
            onChange={(e) => update("techStack", e.target.value)}
            placeholder="Next.js, TypeScript, PostgreSQL, etc."
            className="bg-surface2"
          />
          <p className="text-xs text-muted mt-1">Comma-separated list of main technologies</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-txt mb-1.5">
            Description
          </label>
          <textarea
            value={answers.description}
            onChange={(e) => update("description", e.target.value)}
            placeholder="A brief description of what your project does..."
            rows={3}
            className="w-full px-3 py-2 rounded-md border border-border bg-surface2 text-txt text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-txt mb-1.5">
            Key Features <span className="text-muted">(optional)</span>
          </label>
          <Input
            value={answers.keyFeatures}
            onChange={(e) => update("keyFeatures", e.target.value)}
            placeholder="Auth, payments, real-time sync, etc."
            className="bg-surface2"
          />
          <p className="text-xs text-muted mt-1">Comma-separated list of main features</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-txt mb-1.5">
            Coding Conventions <span className="text-muted">(optional)</span>
          </label>
          <Input
            value={answers.conventions}
            onChange={(e) => update("conventions", e.target.value)}
            placeholder="ESLint, Prettier, Conventional Commits, etc."
            className="bg-surface2"
          />
        </div>
      </div>
    </div>
  )
}
