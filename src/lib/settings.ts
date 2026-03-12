export interface AppSettings {
  theme: 'dark' | 'light' | 'system'
  accentColor: 'blue' | 'purple' | 'green' | 'orange'
  fontSize: 'small' | 'medium' | 'large'
  editor: {
    autoSave: number // 0 = off, otherwise seconds
    wordWrap: boolean
    lineNumbers: boolean
    previewMode: 'split' | 'tab' | 'preview'
  }
  project: {
    autoRefresh: number // 0 = off, otherwise seconds
    showHidden: boolean
  }
  mcp: {
    endpoint: string
  }
}

export interface Skill {
  id: string
  name: string
  description: string
  trigger: string
  prompt: string
  tools: string[]
  icon?: string
}

export interface Agent {
  id: string
  name: string
  icon: string
  description: string
  skills: string[]
  prompt: string
  active: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  accentColor: 'blue',
  fontSize: 'medium',
  editor: {
    autoSave: 10,
    wordWrap: true,
    lineNumbers: true,
    previewMode: 'split',
  },
  project: {
    autoRefresh: 10,
    showHidden: false,
  },
  mcp: {
    endpoint: 'http://localhost:3000/api/mcp',
  },
}

export const DEFAULT_SKILLS: Skill[] = [
  {
    id: 'code-review',
    name: 'Code Review',
    description: 'Analyzes code for quality, security, and performance issues',
    trigger: '/review',
    prompt: 'You are an expert code reviewer. Analyze the provided code for:\n- Code quality and best practices\n- Security vulnerabilities\n- Performance issues\n- Maintainability concerns\n\nProvide actionable feedback.',
    tools: ['vibedoc_read_doc', 'vibedoc_search_docs'],
    icon: '🔧',
  },
  {
    id: 'doc-generator',
    name: 'Documentation Generator',
    description: 'Creates documentation from code and comments',
    trigger: '/docs',
    prompt: 'You are a technical documentation writer. Generate clear, comprehensive documentation for the provided code or feature.',
    tools: ['vibedoc_read_doc', 'vibedoc_write_doc'],
    icon: '📝',
  },
  {
    id: 'test-writer',
    name: 'Test Writer',
    description: 'Generates unit tests for functions and components',
    trigger: '/test',
    prompt: 'You are a testing expert. Write comprehensive unit tests for the provided code, covering edge cases and ensuring good test coverage.',
    tools: ['vibedoc_read_doc', 'vibedoc_search_docs'],
    icon: '🧪',
  },
]

export const DEFAULT_AGENTS: Agent[] = [
  {
    id: 'code-assistant',
    name: 'Code Assistant',
    icon: '🤖',
    description: 'General-purpose coding help',
    skills: ['code-review', 'test-writer'],
    prompt: 'You are a helpful coding assistant. Help the user with their coding tasks.',
    active: true,
  },
  {
    id: 'doc-bot',
    name: 'Documentation Bot',
    icon: '📚',
    description: 'Focused on docs and comments',
    skills: ['doc-generator'],
    prompt: 'You are a documentation specialist. Focus on creating and improving documentation.',
    active: true,
  },
]
