/**
 * src/lib/core.ts
 * All file-system operations. Used by API routes, MCP handler, and SSR.
 * Runs server-side only.
 */

import fs from 'fs/promises'
import path from 'path'
import { glob } from 'glob'

// ─── Types ────────────────────────────────────────────────────────────────────

export type TaskStatus = 'todo' | 'in-progress' | 'blocked' | 'done' | 'cancelled'

export interface Task {
  id: string
  title: string
  status: TaskStatus
  size: string
  phase: string
  dependsOn: string
  file: string
  raw?: string
}

export interface TaskBoard {
  todo: Task[]
  'in-progress': Task[]
  blocked: Task[]
  done: Task[]
  cancelled: Task[]
}

export interface DocFile {
  path: string
  section: string
  name: string
}

export interface DescriptionCache {
  [path: string]: {
    description: string
    source: 'extracted' | 'ai'
    updatedAt: string
  }
}

export interface ExplorerFile {
  path: string
  name: string
  section: string
  description: string
  source: 'extracted' | 'ai'
  updatedAt: string
  mtime: string
}

export interface SearchResult {
  file: string
  hits: { line: number; text: string }[]
  totalHits: number
}

export interface ActivityEvent {
  id: string
  timestamp: string
  type: 'task_updated' | 'decision_logged' | 'memory_updated' | 'doc_read' | 'session_start' | 'doc_created' | 'doc_deleted' | 'doc_renamed' | 'registry_rebuilt'
  actor: 'ai' | 'human'
  title: string
  detail?: string
  taskId?: string
  taskStatus?: TaskStatus
}

export interface Project {
  id: string
  name: string
  root: string
  hasVibedoc: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const STATUS_ICONS: Record<TaskStatus, string> = {
  'todo': '📋',
  'in-progress': '🔨',
  'blocked': '🚫',
  'done': '✅',
  'cancelled': '❌',
}

const STATUS_ALIASES: Record<string, TaskStatus> = {
  ready: 'todo', planned: 'todo', 'not started': 'todo',
  wip: 'in-progress', doing: 'in-progress', active: 'in-progress', start: 'in-progress', started: 'in-progress',
  complete: 'done', completed: 'done', finished: 'done', finish: 'done',
  block: 'blocked',
  cancel: 'cancelled', skip: 'cancelled',
}

export function normalizeStatus(raw: string): TaskStatus {
  const s = raw.toLowerCase().trim().replace(/[📋🔨✅🚫❌\s]+$/, '').trim()
  return (STATUS_ALIASES[s] || s) as TaskStatus
}

// ─── Project detection ────────────────────────────────────────────────────────

export async function findRoot(startDir = process.cwd()): Promise<string> {
  let dir = path.resolve(startDir)
  for (let i = 0; i < 12; i++) {
    for (const marker of ['CLAUDE.md', 'AGENTS.md', 'docs/architecture', '.vibedoc']) {
      try { await fs.access(path.join(dir, marker)); return dir } catch {}
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return path.resolve(startDir)
}

export function getConfiguredRoot(): string {
  return process.env.VIBEDOC_ROOT || process.cwd()
}

// ─── Multi-project: scan parent directories ───────────────────────────────────

export async function discoverProjects(searchBase?: string): Promise<Project[]> {
  const base = searchBase || path.dirname(getConfiguredRoot())
  const projects: Project[] = []

  try {
    const entries = await fs.readdir(base, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const dir = path.join(base, entry.name)
      let hasVibedoc = false
      for (const marker of ['CLAUDE.md', 'AGENTS.md', 'docs/architecture', '.vibedoc']) {
        try { await fs.access(path.join(dir, marker)); hasVibedoc = true; break } catch {}
      }
      if (hasVibedoc) {
        projects.push({ id: entry.name, name: entry.name, root: dir, hasVibedoc: true })
      }
    }
  } catch {}

  // Always ensure configured root is first
  const root = getConfiguredRoot()
  const name = path.basename(root)
  const existingIdx = projects.findIndex(p => p.root === root)
  if (existingIdx > 0) {
    const [existing] = projects.splice(existingIdx, 1)
    projects.unshift(existing)
  } else if (existingIdx === -1) {
    projects.unshift({ id: name, name, root, hasVibedoc: true })
  }

  return projects
}

// ─── Docs ─────────────────────────────────────────────────────────────────────

export async function listDocs(root: string): Promise<DocFile[]> {
  const files = await glob('**/*.md', {
    cwd: root,
    ignore: ['node_modules/**', '.git/**', '.next/**'],
    nodir: true,
  })

  return files.sort().map(f => ({
    path: f,
    section: inferSection(f),
    name: path.basename(f, '.md'),
  }))
}

function inferSection(f: string): string {
  if (!f.includes('/')) return 'root'
  if (f.startsWith('memory/')) return 'memory'
  if (f.startsWith('plans/')) return 'plans'
  if (f.includes('01-overview')) return 'overview'
  if (f.includes('02-high-level') || f.includes('high-level-design')) return 'high-level-design'
  if (f.includes('03-services') || f.includes('/services/')) return 'services'
  if (f.includes('04-data') || f.includes('/data/')) return 'data'
  if (f.includes('05-infra') || f.includes('/infrastructure/')) return 'infrastructure'
  if (f.includes('06-security') || f.includes('/security/')) return 'security'
  if (f.includes('07-observ') || f.includes('/observability/')) return 'observability'
  if (f.includes('08-resil') || f.includes('/resilience/')) return 'resilience'
  if (f.includes('decisions/') || f.includes('ADR')) return 'decisions'
  return 'other'
}

export async function readDoc(query: string, root: string): Promise<{ path: string; content: string }> {
  const candidates = [
    path.join(root, query),
    path.join(root, `${query}.md`),
    path.join(root, 'docs', query),
    path.join(root, 'docs', `${query}.md`),
    path.join(root, 'docs', 'architecture', query),
    path.join(root, 'docs', 'architecture', `${query}.md`),
    path.join(root, 'memory', query),
    path.join(root, 'memory', `${query}.md`),
    path.join(root, 'plans', query),
    path.join(root, 'plans', `${query}.md`),
  ]

  for (const c of candidates) {
    try {
      const content = await fs.readFile(c, 'utf8')
      return { path: path.relative(root, c), content }
    } catch {}
  }

  // Glob fallback
  for (const pattern of [`**/${query}.md`, `**/${query}*.md`, `**/*${query}*.md`]) {
    const matches = await glob(pattern, {
      cwd: root,
      ignore: ['node_modules/**', '.git/**', '.next/**'],
      nodir: true,
      nocase: true,
    })
    if (matches.length > 0) {
      const content = await fs.readFile(path.join(root, matches[0]), 'utf8')
      return { path: matches[0], content }
    }
  }

  throw new Error(`Doc not found: "${query}"`)
}

export async function writeDoc(docPath: string, content: string, root: string): Promise<void> {
  const resolvedRoot = path.resolve(root)
  const fullPath = path.resolve(root, docPath)
  if (!fullPath.startsWith(resolvedRoot + path.sep) && fullPath !== resolvedRoot) {
    throw new Error('Path outside root')
  }
  await fs.mkdir(path.dirname(fullPath), { recursive: true })
  await fs.writeFile(fullPath, content, 'utf8')
}

export async function getContext(paths: string[], root: string): Promise<string> {
  const parts: string[] = []
  for (const p of paths) {
    try {
      const { content } = await readDoc(p, root)
      parts.push(`--- FILE: ${p} ---\n\n${content.trim()}`)
    } catch {
      // skip missing or unreadable files
    }
  }
  return parts.join('\n\n---\n\n')
}

export async function createDoc(docPath: string, content: string, root: string): Promise<void> {
  const resolvedRoot = path.resolve(root)
  const fullPath = path.resolve(root, docPath)
  if (!fullPath.startsWith(resolvedRoot + path.sep) && fullPath !== resolvedRoot) {
    throw new Error('Path outside root')
  }
  try {
    await fs.access(fullPath)
    const err = new Error(`File already exists: ${docPath}`) as NodeJS.ErrnoException
    err.code = 'EEXIST'
    throw err
  } catch (e) {
    const nodeErr = e as NodeJS.ErrnoException
    if (nodeErr.code !== 'ENOENT') throw e
  }
  await fs.mkdir(path.dirname(fullPath), { recursive: true })
  await fs.writeFile(fullPath, content, 'utf8')
  await appendActivity(root, { type: 'doc_created', actor: 'human', title: `Created: ${docPath}`, detail: docPath })
  try { const { exists } = await readRegistry(root); if (exists) await rebuildRegistry(root) } catch {}
}

export async function searchDocs(query: string, root: string): Promise<SearchResult[]> {
  const files = await glob('**/*.md', {
    cwd: root,
    ignore: ['node_modules/**', '.git/**', '.next/**'],
    nodir: true,
  })
  const qLower = query.toLowerCase()
  const results: SearchResult[] = []

  for (const f of files) {
    try {
      const content = await fs.readFile(path.join(root, f), 'utf8')
      const lines = content.split('\n')
      const hits = lines
        .map((line, i) => ({ line: i + 1, text: line.trim().slice(0, 120) }))
        .filter(h => h.text.toLowerCase().includes(qLower))
      if (hits.length > 0) results.push({ file: f, hits: hits.slice(0, 4), totalHits: hits.length })
    } catch {}
  }

  return results.sort((a, b) => b.totalHits - a.totalHits).slice(0, 20)
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

function parseTaskFile(filePath: string, content: string): Task {
  const lines = content.split('\n')
  const filename = path.basename(filePath, '.md')
  const titleLine = lines.find(l => l.startsWith('# '))
  const title = (titleLine || '').replace(/^#+\s*/, '').replace(/^T\d+:\s*/i, '').trim() || filename

  const meta: Record<string, string> = {}
  for (const line of lines.slice(0, 30)) {
    const m = line.match(/\*\*([^*]+):\*\*\s*(.+)/)
    if (m) meta[m[1].toLowerCase().trim()] = m[2].trim()
  }

  const rawStatus = (meta['status'] || 'todo').replace(/[📋🔨✅🚫❌]/g, '').trim()
  const status = normalizeStatus(rawStatus)
  const idM = filename.match(/^(T\d+)/i)
  const id = idM ? idM[1].toUpperCase() : filename.toUpperCase()

  return { id, title, status, size: meta['size'] || '', phase: meta['phase'] || '', dependsOn: meta['depends on'] || '', file: filePath, raw: content }
}

export async function listTasks(root: string): Promise<{ tasks: Task[]; board: TaskBoard }> {
  let files = await glob('plans/tasks/T*.md', { cwd: root, nodir: true })
  if (files.length === 0) files = await glob('plans/T*.md', { cwd: root, nodir: true })

  const tasks: Task[] = []
  for (const f of files.sort()) {
    try {
      const content = await fs.readFile(path.join(root, f), 'utf8')
      tasks.push(parseTaskFile(f, content))
    } catch {}
  }

  const board: TaskBoard = { todo: [], 'in-progress': [], blocked: [], done: [], cancelled: [] }
  for (const t of tasks) {
    const col = (board[t.status] ? t.status : 'todo') as TaskStatus
    board[col].push(t)
  }
  return { tasks, board }
}

export async function getTask(taskId: string, root: string): Promise<Task> {
  const id = taskId.toUpperCase().startsWith('T') ? taskId.toUpperCase() : `T${taskId}`
  for (const pattern of [`plans/tasks/${id}*.md`, `plans/${id}*.md`]) {
    const matches = await glob(pattern, { cwd: root, nodir: true })
    if (matches.length > 0) {
      const content = await fs.readFile(path.join(root, matches[0]), 'utf8')
      return parseTaskFile(matches[0], content)
    }
  }
  throw new Error(`Task not found: ${taskId}`)
}

export async function updateTaskStatus(
  taskId: string, newStatus: TaskStatus, root: string, actor: 'ai' | 'human' = 'human'
): Promise<{ task: Task; previousStatus: TaskStatus }> {
  const task = await getTask(taskId, root)
  const previousStatus = task.status
  const icon = STATUS_ICONS[newStatus]

  let content = task.raw!
  const statusPattern = /(\*\*Status:\*\*\s*).+/
  if (statusPattern.test(content)) {
    content = content.replace(statusPattern, `$1${icon} ${capitalize(newStatus)}`)
  } else {
    content = content.replace(/^(#[^\n]+\n)/, `$1**Status:** ${icon} ${capitalize(newStatus)}\n`)
  }

  await fs.writeFile(path.join(root, task.file), content, 'utf8')

  // Append to activity log
  await appendActivity(root, {
    type: 'task_updated', actor,
    title: `${task.id} moved to ${newStatus}`,
    detail: task.title,
    taskId: task.id,
    taskStatus: newStatus,
  })

  return { task: { ...task, status: newStatus }, previousStatus }
}

export interface CreateTaskParams {
  title: string
  phase?: string
  size?: string
  description?: string
  dependsOn?: string
}

export async function createTask(params: CreateTaskParams, root: string): Promise<Task> {
  const { tasks } = await listTasks(root)

  const ids = tasks
    .map(t => parseInt(t.id.replace(/^T/i, ''), 10))
    .filter(n => !isNaN(n))
  const nextNum = ids.length > 0 ? Math.max(...ids) + 1 : 1
  const id = `T${String(nextNum).padStart(3, '0')}`

  const slug = params.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)

  const filename = `${id}-${slug}.md`
  const tasksDir = path.join(root, 'plans', 'tasks')
  await fs.mkdir(tasksDir, { recursive: true })
  const filePath = path.join(tasksDir, filename)

  const content = `# ${id}: ${params.title}
**Status:** 📋 Ready
**Phase:** ${params.phase || '—'}
**Size:** ${params.size || '—'}
**Depends on:** ${params.dependsOn || '—'}

## What to build
${params.description || '—'}

## Scope
- [ ]

## Acceptance criteria
- [ ]

## Definition of done
—
`

  await fs.writeFile(filePath, content, { flag: 'wx', encoding: 'utf8' })
  return getTask(id, root)
}

function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }

// ─── Decisions (ADRs) ─────────────────────────────────────────────────────────

export interface ADRParams {
  title: string
  context: string
  decision: string
  rationale?: string
  alternatives?: { option: string; reason: string }[]
  consequences?: string
}

export async function logDecision(params: ADRParams, root: string, actor: 'ai' | 'human' = 'human'): Promise<{ adrNumber: string; path: string }> {
  const { title, context, decision, rationale, alternatives = [], consequences } = params
  const existing = await glob('docs/architecture/decisions/ADR-*.md', { cwd: root, nodir: true })
  const nums = existing.map(f => parseInt(path.basename(f).match(/ADR-(\d+)/)?.[1] || '0')).filter(n => !isNaN(n))
  const nextNum = nums.length > 0 ? Math.max(...nums) + 1 : 1
  const numStr = String(nextNum).padStart(3, '0')
  const slug = title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').slice(0, 50)
  const filename = `ADR-${numStr}-${slug}.md`
  const today = new Date().toISOString().split('T')[0]
  const altsTable = alternatives.length > 0
    ? alternatives.map(a => `| ${a.option} | ${a.reason} |`).join('\n')
    : '| (none) | — |'

  const content = `# ADR-${numStr}: ${title}\n\n**Status:** ✅ Accepted\n**Date:** ${today}\n\n## Context\n${context}\n\n## Decision\n${decision}\n\n## Rationale\n${rationale || ''}\n\n## Alternatives considered\n| Option | Why rejected |\n|--------|-------------|\n${altsTable}\n\n## Consequences\n${consequences || ''}\n`

  const filePath = path.join(root, 'docs/architecture/decisions', filename)
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, content, 'utf8')

  // Update index
  const indexPath = path.join(root, 'docs/architecture/decisions/_INDEX.md')
  try {
    let idx = await fs.readFile(indexPath, 'utf8')
    idx = idx.trimEnd() + `\n| ADR-${numStr} | ${title} | ✅ Accepted | ${today} |\n`
    await fs.writeFile(indexPath, idx, 'utf8')
  } catch {
    await fs.writeFile(indexPath, `# ADR Index\n\n| ADR | Title | Status | Date |\n|-----|-------|--------|------|\n| ADR-${numStr} | ${title} | ✅ Accepted | ${today} |\n`, 'utf8')
  }

  await appendActivity(root, {
    type: 'decision_logged', actor,
    title: `ADR-${numStr}: ${title}`,
    detail: decision.slice(0, 100),
  })

  return { adrNumber: `ADR-${numStr}`, path: `docs/architecture/decisions/${filename}` }
}

// ─── Memory ───────────────────────────────────────────────────────────────────

export interface MemoryParams {
  currentState: string
  justCompleted?: string[]
  workingOn?: string
  upNext?: string[]
  issues?: (string | { issue: string; severity?: string; status?: string })[]
  decisions?: string[]
  techDebt?: string[]
  handoff: string
}

export async function readMemory(root: string): Promise<{ content: string; exists: boolean }> {
  try {
    const content = await fs.readFile(path.join(root, 'memory', 'MEMORY.md'), 'utf8')
    return { content, exists: true }
  } catch {
    return { content: '*(No MEMORY.md found — AI will create one at end of session)*', exists: false }
  }
}

export async function updateMemory(params: MemoryParams, root: string, actor: 'ai' | 'human' = 'human'): Promise<void> {
  const { currentState, justCompleted = [], workingOn = '', upNext = [], issues = [], decisions = [], techDebt = [], handoff } = params
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  const content = `# Project Memory\n**Last updated:** ${today} at ${time}\n\n## Current state\n${currentState}\n\n## Just completed\n${justCompleted.map(i => `- ${i}`).join('\n') || '- (nothing this session)'}\n\n## Working on now\n${workingOn || '(nothing active)'}\n\n## Up next\n${upNext.map((item, i) => `${i + 1}. ${item}`).join('\n') || '1. (define next steps)'}\n\n## Active issues\n| Issue | Severity | Status |\n|-------|----------|--------|\n${issues.map(i => typeof i === 'string' ? `| ${i} | medium | open |` : `| ${i.issue} | ${i.severity || 'medium'} | ${i.status || 'open'} |`).join('\n') || '| None | — | — |'}\n\n## Recent decisions\n${decisions.map(d => `- ${d}`).join('\n') || '- (none this session)'}\n\n## Tech debt\n${techDebt.map(d => `- ${d}`).join('\n') || '- (none noted)'}\n\n## Handoff for next session\n${handoff}\n`

  await fs.mkdir(path.join(root, 'memory'), { recursive: true })
  await fs.writeFile(path.join(root, 'memory', 'MEMORY.md'), content, 'utf8')

  await appendActivity(root, {
    type: 'memory_updated', actor,
    title: 'Session memory updated',
    detail: handoff.slice(0, 120),
  })
}

// ─── Activity log ─────────────────────────────────────────────────────────────

const ACTIVITY_FILE = '.vibedoc-activity.json'

// ─── Description cache ────────────────────────────────────────────────────────

const DESCRIPTIONS_FILE = '.vibedoc-descriptions.json'

export async function readDescriptions(root: string): Promise<DescriptionCache> {
  try {
    const raw = await fs.readFile(path.join(root, DESCRIPTIONS_FILE), 'utf8')
    return JSON.parse(raw) as DescriptionCache
  } catch {
    return {}
  }
}

export async function writeDescriptions(root: string, cache: DescriptionCache): Promise<void> {
  const filePath = path.join(root, DESCRIPTIONS_FILE)
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(cache, null, 2), 'utf8')
}

export async function writeDescriptionEntry(
  root: string,
  filePath: string,
  entry: DescriptionCache[string]
): Promise<void> {
  const normalizedKey = path.normalize(filePath).replace(/\\/g, '/')
  const cache = await readDescriptions(root)
  cache[normalizedKey] = entry
  await writeDescriptions(root, cache)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _anthropic: any = null

async function getAnthropicClient(): Promise<any> {
  if (!_anthropic) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return _anthropic
}

export function extractDescription(content: string): string {
  const lines = content.split('\n')
  let heading = ''

  for (const line of lines) {
    const m = line.match(/^#{1,3}\s+(.+)/)
    if (m && !heading) {
      heading = m[1].trim().slice(0, 120)
      continue
    }
    const t = line.trim()
    if (
      t &&
      !t.startsWith('#') &&
      !t.startsWith('```') &&
      !t.startsWith('|') &&
      !t.startsWith('-') &&
      !t.startsWith('*') &&
      t.length > 20
    ) {
      return t.slice(0, 120)
    }
  }
  return heading
}

export async function enrichDescription(filePath: string, root: string): Promise<string> {
  const resolvedRoot = path.resolve(root)
  const fullPath = path.resolve(root, filePath)
  if (!fullPath.startsWith(resolvedRoot + path.sep) && fullPath !== resolvedRoot) {
    throw new Error('Path outside root')
  }

  const client = await getAnthropicClient()
  const content = await fs.readFile(fullPath, 'utf8')

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 100,
    messages: [{
      role: 'user',
      content: `Write a single sentence (max 120 characters) describing what this file is about. Output ONLY the sentence, nothing else.\n\n${content.slice(0, 2000)}`,
    }],
  })

  const textBlock = message.content.find((b: { type: string }) => b.type === 'text') as { type: 'text'; text: string } | undefined
  if (!textBlock) throw new Error('No text block in Anthropic response')
  const description = textBlock.text.trim().slice(0, 120)

  await writeDescriptionEntry(root, filePath, { description, source: 'ai', updatedAt: new Date().toISOString() })

  return description
}

export async function listExplorerFiles(root: string): Promise<ExplorerFile[]> {
  const docs = await listDocs(root)
  const cache = await readDescriptions(root)

  return Promise.all(docs.map(async (doc) => {
    const cached = cache[doc.path]
    let description = cached?.description ?? ''
    const source: 'extracted' | 'ai' = cached?.source ?? 'extracted'

    // Get mtime first so we can use it as updatedAt fallback
    let mtime = new Date().toISOString()
    try {
      const stat = await fs.stat(path.join(root, doc.path))
      mtime = stat.mtime.toISOString()
    } catch { /* ignore */ }

    const updatedAt = cached?.updatedAt ?? mtime

    if (!cached) {
      try {
        const content = await fs.readFile(path.join(root, doc.path), 'utf8')
        description = extractDescription(content)
      } catch { /* ignore */ }
    }

    return { path: doc.path, name: doc.name, section: doc.section, description, source, updatedAt, mtime }
  }))
}

async function appendActivity(root: string, event: Omit<ActivityEvent, 'id' | 'timestamp'>): Promise<void> {
  const full: ActivityEvent = {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...event,
  }

  const file = path.join(root, ACTIVITY_FILE)
  let events: ActivityEvent[] = []
  try {
    const raw = await fs.readFile(file, 'utf8')
    events = JSON.parse(raw)
  } catch {}

  events.unshift(full)
  if (events.length > 500) events = events.slice(0, 500)
  await fs.writeFile(file, JSON.stringify(events, null, 2), 'utf8')
}

export async function readActivity(root: string, limit = 50): Promise<ActivityEvent[]> {
  try {
    const raw = await fs.readFile(path.join(root, ACTIVITY_FILE), 'utf8')
    const events: ActivityEvent[] = JSON.parse(raw)
    return events.slice(0, limit)
  } catch {
    return []
  }
}

export async function logSessionStart(root: string, actor: 'ai' | 'human' = 'ai'): Promise<void> {
  await appendActivity(root, { type: 'session_start', actor, title: 'Session started', detail: 'Agent connected' })
}

// ─── Status summary ───────────────────────────────────────────────────────────

// ─── Doc operations (append, rename, delete) ──────────────────────────────────

export async function appendDoc(docPath: string, content: string, root: string): Promise<void> {
  const resolvedRoot = path.resolve(root)
  const fullPath = path.resolve(root, docPath)
  if (!fullPath.startsWith(resolvedRoot + path.sep) && fullPath !== resolvedRoot) {
    throw new Error('Path outside root')
  }
  let existing: string
  try {
    existing = await fs.readFile(fullPath, 'utf8')
  } catch {
    throw new Error(`Doc not found: ${docPath}`)
  }
  await fs.writeFile(fullPath, existing.trimEnd() + '\n\n' + content, 'utf8')
}

export async function renameDoc(oldPath: string, newPath: string, root: string): Promise<void> {
  const resolvedRoot = path.resolve(root)
  const fullOld = path.resolve(root, oldPath)
  const fullNew = path.resolve(root, newPath)
  if (!fullOld.startsWith(resolvedRoot + path.sep) && fullOld !== resolvedRoot) {
    throw new Error('Path outside root')
  }
  if (!fullNew.startsWith(resolvedRoot + path.sep) && fullNew !== resolvedRoot) {
    throw new Error('Path outside root')
  }
  await fs.mkdir(path.dirname(fullNew), { recursive: true })
  try {
    await fs.rename(fullOld, fullNew)
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'EXDEV') {
      await fs.copyFile(fullOld, fullNew)
      await fs.unlink(fullOld)
    } else throw e
  }
  await appendActivity(root, { type: 'doc_renamed', actor: 'human', title: `Renamed ${oldPath} → ${newPath}` })
  try { const { exists } = await readRegistry(root); if (exists) await rebuildRegistry(root) } catch {}
}

export async function deleteDoc(docPath: string, root: string): Promise<void> {
  const resolvedRoot = path.resolve(root)
  const fullPath = path.resolve(root, docPath)
  if (!fullPath.startsWith(resolvedRoot + path.sep) && fullPath !== resolvedRoot) {
    throw new Error('Path outside root')
  }
  await fs.unlink(fullPath)
  await appendActivity(root, { type: 'doc_deleted', actor: 'human', title: `Deleted ${docPath}` })
  try { const { exists } = await readRegistry(root); if (exists) await rebuildRegistry(root) } catch {}
}

// ─── Document Registry ────────────────────────────────────────────────────────

const REGISTRY_PATH = 'docs/REGISTRY.md'
const ANNOTATIONS_START = '<!-- REGISTRY_ANNOTATIONS_START -->'
const ANNOTATIONS_END = '<!-- REGISTRY_ANNOTATIONS_END -->'

function buildDocTree(files: string[]): string {
  // Build a map of directories and files
  const tree: Map<string, string[]> = new Map()
  for (const f of files) {
    const dir = path.dirname(f)
    if (!tree.has(dir)) tree.set(dir, [])
    tree.get(dir)!.push(path.basename(f))
  }

  const lines: string[] = []
  const dirs = Array.from(tree.keys()).sort()

  // Build indented tree
  const rendered = new Set<string>()
  function renderDir(dir: string, indent: number) {
    if (rendered.has(dir)) return
    rendered.add(dir)
    const prefix = '  '.repeat(indent)
    if (dir !== '.') {
      const parts = dir.split('/')
      lines.push(`${prefix}${parts[parts.length - 1]}/`)
    }
    const childIndent = dir === '.' ? 0 : indent + 1
    const childPrefix = '  '.repeat(childIndent)
    // Files directly in this dir
    const dirFiles = tree.get(dir) || []
    for (const f of dirFiles.sort()) {
      lines.push(`${childPrefix}${f}`)
    }
    // Subdirs
    for (const d of dirs) {
      if (d !== dir && path.dirname(d) === dir) {
        renderDir(d, childIndent)
      }
    }
  }

  renderDir('.', 0)
  return lines.join('\n')
}

function parseAnnotations(content: string): Map<string, { description: string; keywords: string }> {
  const map = new Map<string, { description: string; keywords: string }>()
  const start = content.indexOf(ANNOTATIONS_START)
  const end = content.indexOf(ANNOTATIONS_END)
  if (start === -1 || end === -1) return map

  const section = content.slice(start + ANNOTATIONS_START.length, end)
  const rows = section.split('\n').filter(l => l.startsWith('|') && !l.includes('---') && !l.includes('Path'))
  for (const row of rows) {
    const cols = row.split('|').map(c => c.trim()).filter(Boolean)
    if (cols.length >= 3) {
      map.set(cols[0], { description: cols[1], keywords: cols[2] })
    }
  }
  return map
}

export async function readRegistry(root: string): Promise<{ content: string; exists: boolean }> {
  try {
    const content = await fs.readFile(path.join(root, REGISTRY_PATH), 'utf8')
    return { content, exists: true }
  } catch {
    return { content: '*(No REGISTRY.md found — call vibedoc_rebuild_registry to generate it)*', exists: false }
  }
}

export async function rebuildRegistry(root: string, actor: 'ai' | 'human' = 'human'): Promise<{ path: string; totalFiles: number }> {
  const docs = await listDocs(root)
  const files = docs.map(d => d.path)

  // Parse existing annotations
  let existing = ''
  try {
    existing = await fs.readFile(path.join(root, REGISTRY_PATH), 'utf8')
  } catch {}
  const savedAnnotations = parseAnnotations(existing)

  // Build tree
  const tree = buildDocTree(files)

  // Build annotations table — preserve existing, stub new files
  const rows: string[] = []
  for (const f of files) {
    const saved = savedAnnotations.get(f)
    rows.push(`| ${f} | ${saved?.description ?? ''} | ${saved?.keywords ?? ''} |`)
  }

  const now = new Date().toISOString()
  const content = [
    `# Document Registry`,
    `**Generated:** ${now}  **Total:** ${files.length} files`,
    ``,
    `> Edit the Annotations table — it survives rebuilds.`,
    `> Run \`vibedoc_rebuild_registry\` after adding/removing docs.`,
    ``,
    `## File Tree`,
    `\`\`\``,
    tree,
    `\`\`\``,
    ``,
    `## Annotations`,
    ``,
    ANNOTATIONS_START,
    `| Path | Description | Keywords |`,
    `|------|-------------|----------|`,
    ...rows,
    ANNOTATIONS_END,
    ``,
  ].join('\n')

  await writeDoc(REGISTRY_PATH, content, root)
  await appendActivity(root, {
    type: 'registry_rebuilt',
    actor,
    title: 'Document registry rebuilt',
    detail: `${files.length} files indexed`,
  })

  return { path: REGISTRY_PATH, totalFiles: files.length }
}

export async function updateRegistryAnnotation(
  docPath: string, description: string, keywords: string, root: string
): Promise<void> {
  const { content, exists } = await readRegistry(root)
  if (!exists) throw new Error('Registry not found — call vibedoc_rebuild_registry first')

  const annotations = parseAnnotations(content)
  annotations.set(docPath, { description, keywords })

  // Rebuild the annotations block with updated data
  const start = content.indexOf(ANNOTATIONS_START)
  const end = content.indexOf(ANNOTATIONS_END)
  if (start === -1 || end === -1) throw new Error('Registry format invalid — rebuild first')

  const rows = Array.from(annotations.entries())
    .map(([p, a]) => `| ${p} | ${a.description} | ${a.keywords} |`)

  const newAnnotationsBlock = [
    ANNOTATIONS_START,
    `| Path | Description | Keywords |`,
    `|------|-------------|----------|`,
    ...rows,
    ANNOTATIONS_END,
  ].join('\n')

  const newContent = content.slice(0, start) + newAnnotationsBlock + content.slice(end + ANNOTATIONS_END.length)
  await writeDoc(REGISTRY_PATH, newContent, root)
}

// ─── Backlinks ─────────────────────────────────────────────────────────────────

export async function findBacklinks(
  targetPath: string,
  root: string
): Promise<{ file: string; line: number; text: string }[]> {
  const files = await glob('**/*.md', {
    cwd: root,
    ignore: ['node_modules/**', '.git/**', '.next/**'],
    nodir: true,
  })
  const normalTarget = targetPath.replace(/\\/g, '/')
  const basename = path.basename(normalTarget)
  const results: { file: string; line: number; text: string }[] = []

  for (const f of files) {
    if (f.replace(/\\/g, '/') === normalTarget) continue
    try {
      const content = await fs.readFile(path.join(root, f), 'utf8')
      const lines = content.split('\n')
      lines.forEach((line, i) => {
        if (/\[.*\]\(.*\)/.test(line) &&
            (line.includes(basename) || line.includes(normalTarget))) {
          results.push({ file: f, line: i + 1, text: line.trim().slice(0, 120) })
        }
      })
    } catch { /* skip unreadable */ }
  }
  return results
}

// ─── Status summary ───────────────────────────────────────────────────────────

export async function getProjectSummary(root: string) {
  const [{ tasks, board }, docs, memory, activity] = await Promise.all([
    listTasks(root),
    listDocs(root),
    readMemory(root),
    readActivity(root, 10),
  ])

  return {
    root,
    name: path.basename(root),
    tasks: {
      total: tasks.length,
      board: { todo: board.todo.length, 'in-progress': board['in-progress'].length, blocked: board.blocked.length, done: board.done.length, cancelled: board.cancelled.length },
      active: board['in-progress'],
      blocked: board.blocked,
    },
    docs: { total: docs.length },
    memory,
    activity,
  }
}

