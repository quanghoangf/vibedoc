"use client"

import { Bot, FileText, Building2, Server, BookOpen, AlertTriangle, Calendar, Users, Check, GitBranch, Shield, Database, Code2, Workflow, List } from "lucide-react"
import { cn } from "@/lib/utils"

export interface TemplateSelection {
  id: string
  name: string
  path: string
}

interface TemplateSelectorProps {
  selected: TemplateSelection[]
  onChange: (selected: TemplateSelection[]) => void
}

const TEMPLATES = [
  {
    category: "AI Agent Config",
    items: [
      { id: "claude-md", name: "CLAUDE.md", description: "Claude Code instructions", icon: Bot, path: "CLAUDE.md" },
      { id: "agents-md", name: "AGENTS.md", description: "Multi-agent config", icon: Bot, path: "AGENTS.md" },
      { id: "gemini-md", name: "GEMINI.md", description: "Gemini CLI instructions", icon: Bot, path: "GEMINI.md" },
      { id: "cursorrules", name: ".cursorrules", description: "Cursor IDE rules", icon: Code2, path: ".cursorrules" },
      { id: "windsurfrules", name: ".windsurfrules", description: "Windsurf IDE rules", icon: Code2, path: ".windsurfrules" },
      { id: "copilot-instructions", name: "Copilot Instructions", description: "GitHub Copilot rules", icon: Bot, path: ".github/copilot-instructions.md" },
    ],
  },
  {
    category: "GitHub",
    items: [
      { id: "contributing", name: "CONTRIBUTING.md", description: "Contribution guide", icon: GitBranch, path: "CONTRIBUTING.md" },
      { id: "security", name: "SECURITY.md", description: "Security policy", icon: Shield, path: "SECURITY.md" },
      { id: "pr-template", name: "PR Template", description: "Pull request template", icon: GitBranch, path: ".github/pull_request_template.md" },
      { id: "bug-report", name: "Bug Report", description: "Issue template for bugs", icon: AlertTriangle, path: ".github/ISSUE_TEMPLATE/bug_report.md" },
      { id: "feature-request", name: "Feature Request", description: "Issue template for features", icon: FileText, path: ".github/ISSUE_TEMPLATE/feature_request.md" },
    ],
  },
  {
    category: "Process Docs",
    items: [
      { id: "changelog", name: "CHANGELOG.md", description: "Keep a Changelog format", icon: List, path: "CHANGELOG.md" },
      { id: "deployment", name: "DEPLOYMENT.md", description: "Deployment guide", icon: Workflow, path: "DEPLOYMENT.md" },
      { id: "testing", name: "TESTING.md", description: "Testing strategy", icon: Check, path: "TESTING.md" },
      { id: "glossary", name: "Glossary", description: "Project terminology", icon: BookOpen, path: "docs/glossary.md" },
    ],
  },
  {
    category: "Technical Docs",
    items: [
      { id: "prd", name: "PRD", description: "Product requirements", icon: FileText, path: "docs/prd.md" },
      { id: "architecture-overview", name: "Architecture", description: "System overview", icon: Building2, path: "docs/architecture/overview.md" },
      { id: "api-reference", name: "API Reference", description: "Endpoints docs", icon: Server, path: "docs/api-reference.md" },
      { id: "runbook", name: "Runbook", description: "Operations guide", icon: BookOpen, path: "docs/runbook.md" },
      { id: "adr", name: "ADR", description: "Decision record", icon: AlertTriangle, path: "docs/architecture/decisions/ADR-001.md" },
      { id: "onboarding", name: "Onboarding", description: "Dev onboarding", icon: Users, path: "docs/onboarding.md" },
      { id: "database", name: "Database Docs", description: "Schema & design", icon: Database, path: "docs/DATABASE.md" },
      { id: "openapi", name: "OpenAPI Spec", description: "API spec scaffold", icon: Server, path: "docs/api-spec.yaml" },
      { id: "meeting-notes", name: "Meeting Notes", description: "Meeting template", icon: Calendar, path: "docs/meetings/notes.md" },
    ],
  },
]

export function TemplateSelector({ selected, onChange }: TemplateSelectorProps) {
  const isSelected = (id: string) => selected.some(s => s.id === id)

  const toggle = (item: { id: string; name: string; path: string }) => {
    if (isSelected(item.id)) {
      onChange(selected.filter(s => s.id !== item.id))
    } else {
      onChange([...selected, { id: item.id, name: item.name, path: item.path }])
    }
  }

  const selectAll = (category: string) => {
    const cat = TEMPLATES.find(c => c.category === category)
    if (!cat) return
    const allSelected = cat.items.every(i => isSelected(i.id))
    if (allSelected) {
      onChange(selected.filter(s => !cat.items.some(i => i.id === s.id)))
    } else {
      const newSelected = [...selected]
      cat.items.forEach(item => {
        if (!isSelected(item.id)) {
          newSelected.push({ id: item.id, name: item.name, path: item.path })
        }
      })
      onChange(newSelected)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-txt mb-2">Select Templates</h2>
        <p className="text-muted">Choose which documentation files to generate for your project.</p>
      </div>

      {TEMPLATES.map(category => (
        <div key={category.category} className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted uppercase tracking-wider">
              {category.category}
            </h3>
            <button
              onClick={() => selectAll(category.category)}
              className="text-xs text-accent hover:text-accent/80 transition-colors"
            >
              {category.items.every(i => isSelected(i.id)) ? "Deselect all" : "Select all"}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {category.items.map(item => {
              const Icon = item.icon
              const checked = isSelected(item.id)
              return (
                <button
                  key={item.id}
                  onClick={() => toggle(item)}
                  className={cn(
                    "p-3 rounded-lg border text-left transition-all",
                    checked
                      ? "border-accent bg-accent/10"
                      : "border-border hover:border-accent/50"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                      checked ? "bg-accent/20" : "bg-surface2"
                    )}>
                      <Icon className={cn("w-4 h-4", checked ? "text-accent" : "text-muted")} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm text-txt truncate">{item.name}</div>
                      <div className="text-xs text-muted truncate">{item.description}</div>
                    </div>
                    {checked && (
                      <Check className="w-4 h-4 text-accent shrink-0" />
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ))}

      <div className="text-sm text-muted">
        {selected.length} template{selected.length !== 1 ? "s" : ""} selected
      </div>
    </div>
  )
}
