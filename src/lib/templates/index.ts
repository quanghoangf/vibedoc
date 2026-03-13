import { AI_AGENT_TEMPLATES } from './ai-agent'
import { GITHUB_TEMPLATES } from './github'
import { PROCESS_TEMPLATES } from './process'
import { TECHNICAL_TEMPLATES } from './technical'

export * from './types'

export const TEMPLATES = [
  ...AI_AGENT_TEMPLATES,
  ...GITHUB_TEMPLATES,
  ...PROCESS_TEMPLATES,
  ...TECHNICAL_TEMPLATES,
]

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
