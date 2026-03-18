export type TemplateCategory =
  | 'ai-agent'
  | 'github'
  | 'process'
  | 'technical'
  // Forward-declared for Phase 2 (new template categories, coming soon):
  | 'infrastructure'
  | 'github-actions'
  | 'code-quality'
  | 'monitoring'

export interface Template {
  id: string
  name: string
  description: string
  defaultPath: string
  content: string
  category: TemplateCategory
}
