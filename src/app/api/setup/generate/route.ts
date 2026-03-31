import { NextRequest, NextResponse } from 'next/server'
import { TEMPLATES } from '@/lib/templates'
import { getConfiguredRoot, listDocs } from '@/lib/core'

interface TemplateSelection {
  id: string
  name: string
  path: string
}

interface ProjectAnswers {
  projectName: string
  projectType: string
  techStack: string
  description: string
  keyFeatures: string
  conventions: string
}

function applyPlaceholders(content: string, answers: ProjectAnswers): string {
  const today = new Date().toISOString().split('T')[0]
  const features = answers.keyFeatures
    ? answers.keyFeatures.split(',').map(f => `- ${f.trim()}`).join('\n')
    : ''
  
  return content
    .replace(/\{\{PROJECT_NAME\}\}/g, answers.projectName || 'My Project')
    .replace(/\{\{PROJECT_TYPE\}\}/g, answers.projectType || 'web-app')
    .replace(/\{\{TECH_STACK\}\}/g, answers.techStack || 'Not specified')
    .replace(/\{\{DESCRIPTION\}\}/g, answers.description || '')
    .replace(/\{\{KEY_FEATURES\}\}/g, features)
    .replace(/\{\{CONVENTIONS\}\}/g, answers.conventions || '')
    .replace(/\{\{DATE\}\}/g, today)
}

function generateQuickMode(templates: TemplateSelection[], answers: ProjectAnswers, existingPaths: Set<string>) {
  const files: { path: string; content: string; skipped?: boolean; reason?: string }[] = []

  for (const selection of templates) {
    const template = TEMPLATES.find(t => t.id === selection.id)
    if (!template) continue

    const path = selection.path
    
    if (existingPaths.has(path)) {
      files.push({ path, content: '', skipped: true, reason: 'already exists' })
      continue
    }

    // Use enhanced template content with project info
    let content = template.content

    // For CLAUDE.md, create a more detailed template
    if (selection.id === 'claude-md') {
      content = `# ${answers.projectName} — Agent Instructions

## What this is
${answers.description || 'A software project.'}

## Stack
${answers.techStack || 'Not specified'}

## Project type
${answers.projectType.replace(/-/g, ' ')}

## Commands
\`\`\`bash
# Install dependencies
npm install

# Start development
npm run dev

# Build for production
npm run build

# Run tests
npm test
\`\`\`

## Key conventions
${answers.conventions || '- Follow existing code patterns\n- Write tests for new features'}

## Key features
${answers.keyFeatures ? answers.keyFeatures.split(',').map(f => `- ${f.trim()}`).join('\n') : '- Core functionality'}

## Non-negotiables
- Keep code clean and well-documented
- Maintain test coverage
- Follow security best practices
`
    } else if (selection.id === 'agents-md') {
      content = `# ${answers.projectName} — Agent Config

See CLAUDE.md for detailed instructions.
`
    } else {
      content = applyPlaceholders(content, answers)
    }

    files.push({ path, content })
  }

  return files
}

export async function POST(req: NextRequest) {
  try {
    const root = req.nextUrl.searchParams.get('root') || getConfiguredRoot()
    const { templates, answers, mode } = await req.json() as {
      templates: TemplateSelection[]
      answers: ProjectAnswers
      mode: 'quick' | 'ai'
    }

    // Get existing docs to check for conflicts
    const existingDocs = await listDocs(root)
    const existingPaths = new Set(existingDocs.map(d => d.path))

    let files: { path: string; content: string; skipped?: boolean; reason?: string }[]

    if (mode === 'ai') {
      // AI mode would use MCP connection
      // For now, fall back to quick mode with a note
      files = generateQuickMode(templates, answers, existingPaths)
      // TODO: Implement MCP-based AI generation
    } else {
      files = generateQuickMode(templates, answers, existingPaths)
    }

    return NextResponse.json({ files })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
