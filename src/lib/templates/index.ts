import { AI_AGENT_TEMPLATES } from './ai-agent'
import { GITHUB_TEMPLATES } from './github'
import { PROCESS_TEMPLATES } from './process'
import { TECHNICAL_TEMPLATES } from './technical'

export * from './types'
export { AI_AGENT_TEMPLATES } from './ai-agent'
export { GITHUB_TEMPLATES } from './github'
export { PROCESS_TEMPLATES } from './process'
export { TECHNICAL_TEMPLATES } from './technical'

export const TEMPLATES = [
  ...AI_AGENT_TEMPLATES,
  ...GITHUB_TEMPLATES,
  ...PROCESS_TEMPLATES,
  ...TECHNICAL_TEMPLATES,
]
