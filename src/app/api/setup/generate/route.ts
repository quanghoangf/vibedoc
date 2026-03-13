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
  description: string
  repoUrl: string
  techStackTags: string[]
  keyFeatures: string
  teamSize: string
  linting: string[]
  testFramework: string
  ciCd: string[]
  branchStrategy: string
  deploymentTarget: string[]
  conventions: string
}

function applyPlaceholders(content: string, answers: ProjectAnswers): string {
  const today = new Date().toISOString().split('T')[0]
  const techStack = answers.techStackTags.length > 0 ? answers.techStackTags.join(', ') : 'Not specified'
  const features = answers.keyFeatures
    ? answers.keyFeatures.split(',').map(f => `- ${f.trim()}`).join('\n')
    : ''
  const conventions = buildConventions(answers)

  return content
    .replace(/\{\{PROJECT_NAME\}\}/g, answers.projectName || 'My Project')
    .replace(/\{\{PROJECT_TYPE\}\}/g, answers.projectType || 'web-app')
    .replace(/\{\{TECH_STACK\}\}/g, techStack)
    .replace(/\{\{DESCRIPTION\}\}/g, answers.description || '')
    .replace(/\{\{KEY_FEATURES\}\}/g, features)
    .replace(/\{\{CONVENTIONS\}\}/g, conventions)
    .replace(/\{\{DATE\}\}/g, today)
    .replace(/\{\{REPO_URL\}\}/g, answers.repoUrl || '')
    .replace(/\{\{TEAM_SIZE\}\}/g, answers.teamSize || '')
    .replace(/\{\{TEST_FRAMEWORK\}\}/g, answers.testFramework || 'Jest')
    .replace(/\{\{CI_CD\}\}/g, answers.ciCd.join(', ') || '')
    .replace(/\{\{BRANCH_STRATEGY\}\}/g, answers.branchStrategy || '')
}

function buildConventions(answers: ProjectAnswers): string {
  const parts: string[] = []
  if (answers.linting.length > 0) parts.push(`- Linting: ${answers.linting.join(', ')}`)
  if (answers.testFramework) parts.push(`- Testing: ${answers.testFramework}`)
  if (answers.ciCd.length > 0) parts.push(`- CI/CD: ${answers.ciCd.join(', ')}`)
  if (answers.branchStrategy) parts.push(`- Branch strategy: ${answers.branchStrategy}`)
  if (answers.deploymentTarget.length > 0) parts.push(`- Deployment: ${answers.deploymentTarget.join(', ')}`)
  if (answers.conventions) parts.push(`- ${answers.conventions}`)
  return parts.length > 0 ? parts.join('\n') : '- Follow existing code patterns\n- Write tests for new features'
}

function generateQuickMode(templates: TemplateSelection[], answers: ProjectAnswers, existingPaths: Set<string>) {
  const files: { path: string; content: string; skipped?: boolean; reason?: string }[] = []
  const techStack = answers.techStackTags.length > 0 ? answers.techStackTags.join(', ') : 'Not specified'
  const conventions = buildConventions(answers)

  for (const selection of templates) {
    const template = TEMPLATES.find(t => t.id === selection.id)
    if (!template) continue

    const path = selection.path

    if (existingPaths.has(path)) {
      files.push({ path, content: '', skipped: true, reason: 'already exists' })
      continue
    }

    let content = template.content

    if (selection.id === 'claude-md') {
      content = `# ${answers.projectName} — Agent Instructions

## What this is
${answers.description || 'A software project.'}

## Stack
${techStack}

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
${conventions}

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

## Stack
${techStack}

## Key conventions
${conventions}
`
    } else if (selection.id === 'gemini-md') {
      content = `# ${answers.projectName} — Gemini Agent Instructions

## What this is
${answers.description || 'A software project.'}

## Stack
${techStack}

## Commands
\`\`\`bash
npm install
npm run dev
npm run build
npm test
\`\`\`

## Key conventions
${conventions}

## Non-negotiables
- Follow existing code patterns
- Write tests for new features
- Never commit secrets or credentials
`
    } else if (selection.id === 'cursorrules' || selection.id === 'windsurfrules') {
      content = applyPlaceholders(content, answers)
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
      // For now, fall back to quick mode
      files = generateQuickMode(templates, answers, existingPaths)
    } else {
      files = generateQuickMode(templates, answers, existingPaths)
    }

    return NextResponse.json({ files })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
