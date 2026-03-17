"use client"

import { useState } from "react"
import { Bot, FileText, Building2, Server, BookOpen, AlertTriangle, Calendar, Users, Check, GitBranch, Shield, Database, Code2, Workflow, List, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { TEMPLATES, type Template, type TemplateCategory } from "@/lib/templates"
import { PRESETS } from "@/lib/presets"

export interface TemplateSelection {
  id: string
  name: string
  path: string
}

interface TemplateSelectorProps {
  selected: TemplateSelection[]
  onChange: (selected: TemplateSelection[]) => void
  projectType?: string
}

const CATEGORY_DISPLAY_NAMES: Record<TemplateCategory, string> = {
  'ai-agent': 'AI Agent Config',
  'github': 'GitHub',
  'process': 'Process Docs',
  'technical': 'Technical Docs',
  'infrastructure': 'Infrastructure',
  'github-actions': 'GitHub Actions',
  'code-quality': 'Code Quality',
  'monitoring': 'Monitoring',
}

const CATEGORY_ICONS: Record<TemplateCategory, LucideIcon> = {
  'ai-agent': Bot,
  'github': GitBranch,
  'process': Workflow,
  'technical': FileText,
  'infrastructure': Server,
  'github-actions': Workflow,
  'code-quality': Check,
  'monitoring': AlertTriangle,
}

const TEMPLATE_ICONS: Partial<Record<string, LucideIcon>> = {
  'claude-md': Bot,
  'agents-md': Bot,
  'gemini-md': Bot,
  'cursorrules': Code2,
  'windsurfrules': Code2,
  'copilot-instructions': Bot,
  'contributing': GitBranch,
  'security': Shield,
  'pr-template': GitBranch,
  'bug-report': AlertTriangle,
  'feature-request': FileText,
  'changelog': List,
  'deployment': Workflow,
  'testing': Check,
  'glossary': BookOpen,
  'prd': FileText,
  'architecture-overview': Building2,
  'api-reference': Server,
  'runbook': BookOpen,
  'adr': AlertTriangle,
  'onboarding': Users,
  'database': Database,
  'openapi': Server,
  'meeting-notes': Calendar,
  'blank': FileText,
}

// Group templates by category, preserving order of first appearance
function groupByCategory(templates: Template[]): { category: TemplateCategory; displayName: string; items: Template[] }[] {
  const order: TemplateCategory[] = []
  const map = new Map<TemplateCategory, Template[]>()

  for (const t of templates) {
    if (!map.has(t.category)) {
      order.push(t.category)
      map.set(t.category, [])
    }
    map.get(t.category)!.push(t)
  }

  return order.map(cat => ({
    category: cat,
    displayName: CATEGORY_DISPLAY_NAMES[cat] ?? cat,
    items: map.get(cat)!,
  }))
}

const GROUPED_TEMPLATES = groupByCategory(TEMPLATES)

type Tab = 'recommended' | TemplateCategory

export function TemplateSelector({ selected, onChange, projectType }: TemplateSelectorProps) {
  const [activeTab, setActiveTab] = useState<Tab>('recommended')

  const isSelected = (id: string) => selected.some(s => s.id === id)

  const toggle = (item: Template) => {
    if (isSelected(item.id)) {
      onChange(selected.filter(s => s.id !== item.id))
    } else {
      onChange([...selected, { id: item.id, name: item.name, path: item.defaultPath }])
    }
  }

  const selectAll = (category: TemplateCategory) => {
    const group = GROUPED_TEMPLATES.find(g => g.category === category)
    if (!group) return
    const allSelected = group.items.every(i => isSelected(i.id))
    if (allSelected) {
      onChange(selected.filter(s => !group.items.some(i => i.id === s.id)))
    } else {
      const newSelected = [...selected]
      group.items.forEach(item => {
        if (!isSelected(item.id)) {
          newSelected.push({ id: item.id, name: item.name, path: item.defaultPath })
        }
      })
      onChange(newSelected)
    }
  }

  const matchingPresets = PRESETS.filter(p =>
    p.projectTypes.length === 0 || p.projectTypes.includes(projectType ?? '')
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-txt mb-2">Select Templates</h2>
        <p className="text-muted">Choose which documentation files to generate for your project.</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto pb-2 border-b border-border">
        <button
          onClick={() => setActiveTab('recommended')}
          className={cn(
            "px-3 py-1.5 text-sm rounded-md whitespace-nowrap transition-colors",
            activeTab === 'recommended' ? "bg-accent text-white" : "text-muted hover:text-txt"
          )}
        >
          ⭐ Recommended
        </button>
        {GROUPED_TEMPLATES.map(group => (
          <button
            key={group.category}
            onClick={() => setActiveTab(group.category)}
            className={cn(
              "px-3 py-1.5 text-sm rounded-md whitespace-nowrap transition-colors",
              activeTab === group.category ? "bg-accent text-white" : "text-muted hover:text-txt"
            )}
          >
            {group.displayName}
          </button>
        ))}
      </div>

      {/* Recommended tab content */}
      {activeTab === 'recommended' && (
        <div className="space-y-4">
          {matchingPresets.length === 0 && (
            <p className="text-muted text-sm">No presets match your project type. Select templates manually from the tabs above.</p>
          )}
          {matchingPresets.map(preset => {
            const presetSelected = preset.templateIds.every(id => isSelected(id))
            return (
              <div key={preset.id} className="p-4 rounded-lg border border-border hover:border-accent/50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-txt">{preset.name}</div>
                    <div className="text-sm text-muted mt-1">{preset.description}</div>
                    <div className="text-xs text-accent/70 mt-1">{preset.templateIds.length} templates</div>
                  </div>
                  <button
                    onClick={() => {
                      const selections = preset.templateIds
                        .map(id => TEMPLATES.find(t => t.id === id))
                        .filter((t): t is Template => t !== undefined)
                        .map(t => ({ id: t.id, name: t.name, path: t.defaultPath }))
                      onChange(selections)
                    }}
                    className={cn(
                      "shrink-0 px-3 py-1.5 text-sm rounded-lg border transition-colors",
                      presetSelected
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border hover:border-accent text-txt"
                    )}
                  >
                    {presetSelected ? "✓ Selected" : "Select bundle"}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Category tab content */}
      {activeTab !== 'recommended' && (
        (() => {
          const group = GROUPED_TEMPLATES.find(g => g.category === activeTab)
          if (!group) return null
          return (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-muted uppercase tracking-wider">
                  {group.displayName}
                </h3>
                <button
                  onClick={() => selectAll(group.category)}
                  className="text-xs text-accent hover:text-accent/80 transition-colors"
                >
                  {group.items.every(i => isSelected(i.id)) ? "Deselect all" : "Select all"}
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {group.items.map(item => {
                  const Icon = TEMPLATE_ICONS[item.id] ?? CATEGORY_ICONS[item.category]
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
          )
        })()
      )}

      <div className="text-sm text-muted">
        {selected.length} template{selected.length !== 1 ? "s" : ""} selected
      </div>
    </div>
  )
}
