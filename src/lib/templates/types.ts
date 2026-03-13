export type TemplateCategory =
  | 'ai-agent'
  | 'github'
  | 'process'
  | 'technical'
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

// dedent removes common leading whitespace from template literals
export function dedent(str: string): string {
  const lines = str.split('\n')
  // Skip empty leading lines
  const nonEmpty = lines.filter(l => l.trim().length > 0)
  if (nonEmpty.length === 0) return str
  const indent = Math.min(...nonEmpty.map(l => l.match(/^(\s*)/)?.[1].length ?? 0))
  if (indent === 0) return str
  return lines.map(l => l.slice(indent)).join('\n')
}
