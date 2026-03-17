import { AI_AGENT_TEMPLATES } from './ai-agent'
import { GITHUB_TEMPLATES } from './github'
import { PROCESS_TEMPLATES } from './process'
import { TECHNICAL_TEMPLATES } from './technical'
import { INFRASTRUCTURE_TEMPLATES } from './infrastructure'
import { GITHUB_ACTIONS_TEMPLATES } from './github-actions'
import { CODE_QUALITY_TEMPLATES } from './code-quality'
import { MONITORING_TEMPLATES } from './monitoring'

export * from './types'

export const TEMPLATES = [
  ...AI_AGENT_TEMPLATES,
  ...GITHUB_TEMPLATES,
  ...PROCESS_TEMPLATES,
  ...TECHNICAL_TEMPLATES,
  ...INFRASTRUCTURE_TEMPLATES,
  ...GITHUB_ACTIONS_TEMPLATES,
  ...CODE_QUALITY_TEMPLATES,
  ...MONITORING_TEMPLATES,
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
