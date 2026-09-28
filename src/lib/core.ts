/**
 * src/lib/core.ts
 * All file-system operations. Used by API routes, MCP handler, and SSR.
 * Runs server-side only.
 */

import fs from 'fs/promises'
import path from 'path'
import { glob } from 'glob'
import { roadmapFromMarkdown, roadmapFromTasks, starterRoadmap, type RoadmapDraft, type RoadmapSource } from './roadmap-import'

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
  type: 'task_updated' | 'decision_logged' | 'memory_updated' | 'doc_read' | 'session_start' | 'doc_created' | 'doc_deleted' | 'doc_renamed' | 'registry_rebuilt' | 'roadmap_updated'
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


// ─── Roadmap ──────────────────────────────────────────────────────────────────
// Items: plans/roadmap/R*.md (content + Parent/Status/Order/Tasks).
// Positions: plans/roadmap/layout.json (presentation only, never in R*.md).

export type RoadmapStatus = 'planned' | 'in-progress' | 'done'

export interface RoadmapItem {
  id: string            // "R004"
  title: string
  parent: string | null // null = horizon on the spine
  status: RoadmapStatus
  order: number
  tasks: string[]       // ["T001", "T012"]
  due: string | null    // "2026-10-15" — a calendar date, not an instant; compare as strings
  body: string          // markdown after the metadata block
  file: string          // path relative to root
}

export type RoadmapLayout = Record<string, { x: number; y: number }>

export interface CreateRoadmapItemParams {
  title: string
  parent?: string | null
  status?: RoadmapStatus
  order?: number
  tasks?: string[]
  due?: string | null
  body?: string
}

export type UpdateRoadmapItemPatch = Partial<Omit<CreateRoadmapItemParams, 'title'> & { title: string }>


/** Validation / not-found error from the roadmap API. `status` maps straight to an HTTP code. */
export class RoadmapError extends Error {
  constructor(message: string, public status: 400 | 404 = 400) {
    super(message)
    this.name = 'RoadmapError'
  }
}

const ROADMAP_DIR = path.join('plans', 'roadmap')
const ROADMAP_LAYOUT = path.join(ROADMAP_DIR, 'layout.json')
const ROADMAP_STATUSES: RoadmapStatus[] = ['planned', 'in-progress', 'done']
const META_LINE = /^\*\*([^*]+):\*\*/

function normalizeRoadmapId(id: unknown): string {
  const s = String(id ?? '').trim().toUpperCase()
  if (!/^R\d+$/.test(s)) throw new RoadmapError(`Invalid roadmap id: ${String(id)}`)
  return s
}

function roadmapIdOf(file: string): string | null {
  const m = path.basename(file).match(/^(R\d+)(?:-|\.md$)/i)
  return m ? m[1].toUpperCase() : null
}

function parseRoadmapStatus(raw: unknown): RoadmapStatus {
  const s = String(raw ?? '').toLowerCase().trim().replace(/\s+/g, '-')
  if (!ROADMAP_STATUSES.includes(s as RoadmapStatus)) {
    throw new RoadmapError(`Invalid status "${String(raw)}" (expected ${ROADMAP_STATUSES.join(' | ')})`)
  }
  return s as RoadmapStatus
}

function parseTaskIds(tasks: unknown): string[] {
  if (!Array.isArray(tasks)) throw new RoadmapError('tasks must be an array of task ids')
  return tasks.map(t => {
    const s = String(t).trim().toUpperCase()
    if (!/^T\d+$/.test(s)) throw new RoadmapError(`Invalid task id: ${String(t)}`)
    return s
  })
}

function cleanTitle(title: unknown): string {
  const t = String(title ?? '').replace(/\s+/g, ' ').trim()
  if (!t) throw new RoadmapError('Title is required')
  return t
}

/** A real calendar date "YYYY-MM-DD" (rejects 2026-02-30), else null. */
function parseDue(raw: string): string | null {
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  return d.toISOString().slice(0, 10) === raw ? raw : null
}

function cleanDue(due: unknown): string | null {
  if (due === null || due === '') return null
  const d = typeof due === 'string' ? parseDue(due.trim()) : null
  if (!d) throw new RoadmapError(`due must be a date YYYY-MM-DD (got ${JSON.stringify(due)})`)
  return d
}

function cleanOrder(order: unknown): number {
  const n = Number(order)
  if (typeof order !== 'number' || !Number.isFinite(n)) throw new RoadmapError('order must be a finite number')
  return n
}

/** Index of the first line after the H1 + contiguous `**Key:** Value` block. */
function roadmapMetaEnd(lines: string[]): number {
  let i = lines.findIndex(l => l.startsWith('# '))
  i = i < 0 ? 0 : i + 1
  // Tolerate blank lines between the H1 and the meta block (common in hand-written files).
  let j = i
  while (j < lines.length && lines[j].trim() === '') j++
  if (j < lines.length && META_LINE.test(lines[j])) i = j
  while (i < lines.length && META_LINE.test(lines[i])) i++
  return i
}

function parseRoadmapFile(file: string, content: string): RoadmapItem {
  const lines = content.split('\n')
  const titleLine = lines.find(l => l.startsWith('# '))
  const id = roadmapIdOf(file) ?? path.basename(file, '.md').toUpperCase()
  const title = (titleLine || '').replace(/^#+\s*/, '').replace(/^R\d+:\s*/i, '').trim() || id

  // Only the head block counts, so a `**Status:**` inside the body can't override the item's meta.
  const metaEnd = roadmapMetaEnd(lines)
  const meta: Record<string, string> = {}
  for (const line of lines.slice(0, Math.min(metaEnd, 30))) {
    const m = line.match(/\*\*([^*]+):\*\*\s*(.+)/)
    if (m) meta[m[1].toLowerCase().trim()] = m[2].trim()
  }

  const rawParent = (meta['parent'] || '').toUpperCase()
  let status: RoadmapStatus = 'planned'
  try { status = parseRoadmapStatus((meta['status'] || '').replace(/[^a-z\s-]/gi, '')) } catch {}
  const order = parseFloat(meta['order'] || '')

  return {
    id,
    title,
    parent: /^R\d+$/.test(rawParent) ? rawParent : null,
    status,
    order: Number.isFinite(order) ? order : 0,
    tasks: (meta['tasks'] || '').split(/[,\s]+/).map(t => t.toUpperCase()).filter(t => /^T\d+$/.test(t)),
    due: parseDue(meta['due'] || ''),
    body: lines.slice(metaEnd).join('\n').trim(),
    file,
  }
}

async function readRoadmapFiles(root: string): Promise<{ item: RoadmapItem; raw: string }[]> {
  const files = await glob('plans/roadmap/R*.md', { cwd: root, nodir: true })
  const out: { item: RoadmapItem; raw: string }[] = []
  for (const f of files) {
    if (!roadmapIdOf(f)) continue
    try {
      const raw = await fs.readFile(path.join(root, f), 'utf8')
      out.push({ item: parseRoadmapFile(f, raw), raw })
    } catch {}
  }
  return out
}

async function findRoadmapFile(id: string, root: string): Promise<{ item: RoadmapItem; raw: string }> {
  const rid = normalizeRoadmapId(id)
  const matches = (await glob(`plans/roadmap/${rid}*.md`, { cwd: root, nodir: true }))
    .filter(f => roadmapIdOf(f) === rid)
    .sort()
  if (matches.length === 0) throw new RoadmapError(`Roadmap item not found: ${rid}`, 404)
  const raw = await fs.readFile(path.join(root, matches[0]), 'utf8')
  return { item: parseRoadmapFile(matches[0], raw), raw }
}

function sortRoadmap(items: RoadmapItem[]): RoadmapItem[] {
  const num = (id: string) => parseInt(id.slice(1), 10)
  return items.sort((a, b) => a.order - b.order || num(a.id) - num(b.id))
}

/** A parent must be an existing horizon (parent null) and not the item itself. */
function validateParent(parent: string, selfId: string | null, items: RoadmapItem[]): void {
  if (parent === selfId) throw new RoadmapError('An item cannot be its own parent')
  const p = items.find(i => i.id === parent)
  if (!p) throw new RoadmapError(`Parent not found: ${parent}`)
  if (p.parent !== null) throw new RoadmapError(`Parent ${parent} is not a horizon (max depth is 2)`)
}

function cleanBody(body: unknown): string {
  if (typeof body !== 'string') throw new RoadmapError('body must be a string')
  return body.trim()
}

// ponytail: in-process mutex serialising all roadmap writes (id allocation, layout merge).
// Doesn't cover a second VibeDoc process on the same root; add a lockfile if that ever matters.
let roadmapLock: Promise<unknown> = Promise.resolve()
function withRoadmapLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = roadmapLock.then(fn, fn)
  roadmapLock = run.catch(() => {})
  return run
}

function formatTasks(tasks: string[]): string {
  return tasks.length > 0 ? tasks.join(', ') : '—'
}

export async function listRoadmap(root: string): Promise<{ items: RoadmapItem[]; layout: RoadmapLayout }> {
  const [files, layout] = await Promise.all([readRoadmapFiles(root), readRoadmapLayout(root)])
  return { items: sortRoadmap(files.map(f => f.item)), layout }
}

export async function getRoadmapItem(id: string, root: string): Promise<RoadmapItem> {
  return (await findRoadmapFile(id, root)).item
}

export function createRoadmapItem(
  params: CreateRoadmapItemParams, root: string, actor: 'ai' | 'human' = 'human'
): Promise<RoadmapItem> {
  return withRoadmapLock(() => createRoadmapItemUnlocked(params ?? ({} as CreateRoadmapItemParams), root, actor))
}

const roadmapId = (n: number) => `R${String(n).padStart(3, '0')}`

/** Write a new R*.md (flag 'wx': never overwrites). Callers validate fields and mkdir first. */
async function writeRoadmapFile(root: string, f: Omit<RoadmapItem, 'file'>): Promise<void> {
  const slug = f.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
  const filename = slug ? `${f.id}-${slug}.md` : `${f.id}.md`
  const lines = [
    `# ${f.id}: ${f.title}`,
    ...(f.parent ? [`**Parent:** ${f.parent}`] : []),
    `**Status:** ${f.status}`,
    `**Order:** ${f.order}`,
    `**Tasks:** ${formatTasks(f.tasks)}`,
    ...(f.due ? [`**Due:** ${f.due}`] : []),
    '',
  ]
  const content = lines.join('\n') + (f.body ? `\n${f.body}\n` : '')
  await fs.writeFile(path.join(root, ROADMAP_DIR, filename), content, { flag: 'wx', encoding: 'utf8' })
}

/** Where "Generate roadmap" would take its content from: ROADMAP.md, then tasks, then a starter. */
export async function detectRoadmapSource(root: string): Promise<RoadmapSource> {
  return (await roadmapDrafts(root)).source
}

async function roadmapDrafts(root: string): Promise<{ source: RoadmapSource; drafts: RoadmapDraft[] }> {
  try {
    const drafts = roadmapFromMarkdown(await fs.readFile(path.join(root, 'ROADMAP.md'), 'utf8'))
    if (drafts.length > 0) return { source: 'roadmap-md', drafts }
  } catch {
    // no ROADMAP.md — fall through
  }
  const { tasks } = await listTasks(root)
  const fromTasks = roadmapFromTasks(tasks)
  if (fromTasks.length > 0) return { source: 'tasks', drafts: fromTasks }
  return { source: 'starter', drafts: starterRoadmap() }
}

/**
 * Build plans/roadmap/ for a project that has none. Never touches ROADMAP.md or tasks.
 * Refuses when any R*.md exists. One activity entry for the whole generation.
 */
export function generateRoadmap(
  root: string, actor: 'ai' | 'human' = 'human'
): Promise<{ items: RoadmapItem[]; source: RoadmapSource }> {
  return withRoadmapLock(async () => {
    if ((await readRoadmapFiles(root)).length > 0) throw new RoadmapError('Roadmap already exists')
    const { source, drafts } = await roadmapDrafts(root)

    const ids = new Map(drafts.map((d, i) => [d.key, roadmapId(i + 1)]))
    const siblingCount = new Map<string | null, number>()
    await fs.mkdir(path.join(root, ROADMAP_DIR), { recursive: true })
    for (const d of drafts) {
      const n = (siblingCount.get(d.parent) ?? 0) + 1
      siblingCount.set(d.parent, n)
      await writeRoadmapFile(root, {
        id: ids.get(d.key) as string,
        title: d.title,
        parent: d.parent === null ? null : (ids.get(d.parent) ?? null),
        status: d.status,
        order: n * 10,
        tasks: d.tasks,
        due: null,
        body: d.body,
      })
    }

    await appendActivity(root, {
      type: 'roadmap_updated', actor,
      title: `Roadmap generated (${drafts.length} items)`,
      detail: `from ${source}`,
    })
    const { items } = await listRoadmap(root)
    return { items, source }
  })
}

async function createRoadmapItemUnlocked(
  params: CreateRoadmapItemParams, root: string, actor: 'ai' | 'human'
): Promise<RoadmapItem> {
  const title = cleanTitle(params.title)
  const status = params.status === undefined ? 'planned' : parseRoadmapStatus(params.status)
  const tasks = params.tasks === undefined ? [] : parseTaskIds(params.tasks)
  const body = params.body === undefined ? '' : cleanBody(params.body)
  const due = params.due === undefined ? null : cleanDue(params.due)
  const items = (await readRoadmapFiles(root)).map(f => f.item)

  const parent = params.parent == null || params.parent === '' ? null : normalizeRoadmapId(params.parent)
  if (parent) validateParent(parent, null, items)

  const siblingOrders = items.filter(i => i.parent === parent).map(i => i.order)
  const order = params.order === undefined
    ? (siblingOrders.length > 0 ? Math.max(...siblingOrders) : 0) + 10
    : cleanOrder(params.order)

  const nums = items.map(i => parseInt(i.id.slice(1), 10)).filter(n => !isNaN(n))
  const id = roadmapId(nums.length > 0 ? Math.max(...nums) + 1 : 1)

  await fs.mkdir(path.join(root, ROADMAP_DIR), { recursive: true })
  await writeRoadmapFile(root, { id, title, parent, status, order, tasks, due, body })

  await appendActivity(root, { type: 'roadmap_updated', actor, title: `${id} created`, detail: title })
  return getRoadmapItem(id, root)
}

export function updateRoadmapItem(
  id: string, patch: UpdateRoadmapItemPatch, root: string, actor: 'ai' | 'human' = 'human'
): Promise<RoadmapItem> {
  return withRoadmapLock(() => updateRoadmapItemUnlocked(id, patch, root, actor))
}

async function updateRoadmapItemUnlocked(
  id: string, patch: UpdateRoadmapItemPatch, root: string, actor: 'ai' | 'human'
): Promise<RoadmapItem> {
  const { item, raw } = await findRoadmapFile(id, root)
  const p = patch ?? {}

  // Validate everything before touching the file.
  const title = p.title === undefined ? undefined : cleanTitle(p.title)
  const status = p.status === undefined ? undefined : parseRoadmapStatus(p.status)
  const order = p.order === undefined ? undefined : cleanOrder(p.order)
  const tasks = p.tasks === undefined ? undefined : parseTaskIds(p.tasks)
  const body = p.body === undefined ? undefined : cleanBody(p.body)
  const due = p.due === undefined ? undefined : cleanDue(p.due)
  let parent: string | null | undefined
  if (p.parent !== undefined) {
    parent = p.parent === null || p.parent === '' ? null : normalizeRoadmapId(p.parent)
    if (parent !== null) {
      const items = (await readRoadmapFiles(root)).map(f => f.item)
      validateParent(parent, item.id, items)
      if (items.some(i => i.parent === item.id)) {
        throw new RoadmapError(`${item.id} has children and cannot be given a parent`)
      }
    }
  }

  const lines = raw.split('\n')
  if (title !== undefined) {
    const h1 = lines.findIndex(l => l.startsWith('# '))
    if (h1 >= 0) lines[h1] = `# ${item.id}: ${title}`
    else lines.unshift(`# ${item.id}: ${title}`)
  }

  const end = roadmapMetaEnd(lines)
  const head = lines.slice(0, end)
  let rest = lines.slice(end)

  // Replace-or-insert (or remove, for value null) a meta line inside the head block only.
  const setMeta = (key: string, value: string | null) => {
    const idx = head.findIndex(l => l.match(META_LINE)?.[1].trim().toLowerCase() === key.toLowerCase())
    if (value === null) { if (idx >= 0) head.splice(idx, 1); return }
    const line = `**${key}:** ${value}`
    if (idx >= 0) head[idx] = line
    else head.push(line)
  }

  if (parent !== undefined) setMeta('Parent', parent)
  if (status !== undefined) setMeta('Status', status)
  if (order !== undefined) setMeta('Order', String(order))
  if (tasks !== undefined) setMeta('Tasks', formatTasks(tasks))
  if (due !== undefined) setMeta('Due', due)
  if (body !== undefined) {
    rest = body ? ['', body, ''] : ['']
  }

  await fs.writeFile(path.join(root, item.file), [...head, ...rest].join('\n'), 'utf8')
  const updated = await getRoadmapItem(item.id, root)
  await appendActivity(root, { type: 'roadmap_updated', actor, title: `${item.id} updated`, detail: updated.title })
  return updated
}

export function deleteRoadmapItem(id: string, root: string, actor: 'ai' | 'human' = 'human'): Promise<void> {
  return withRoadmapLock(() => deleteRoadmapItemUnlocked(id, root, actor))
}

async function deleteRoadmapItemUnlocked(id: string, root: string, actor: 'ai' | 'human'): Promise<void> {
  const { item } = await findRoadmapFile(id, root)
  const items = (await readRoadmapFiles(root)).map(f => f.item)
  const children = items.filter(i => i.parent === item.id).map(i => i.id)
  if (children.length > 0) {
    throw new RoadmapError(`${item.id} still has children (${children.join(', ')}); move or delete them first`)
  }
  await fs.unlink(path.join(root, item.file))
  // Prune now so a later create reusing this id doesn't inherit the old position.
  await writeRoadmapLayoutUnlocked({}, root)
  await appendActivity(root, { type: 'roadmap_updated', actor, title: `${item.id} deleted`, detail: item.title })
}

export async function readRoadmapLayout(root: string): Promise<RoadmapLayout> {
  try {
    const parsed = JSON.parse(await fs.readFile(path.join(root, ROADMAP_LAYOUT), 'utf8'))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: RoadmapLayout = {}
    for (const [k, v] of Object.entries(parsed as Record<string, { x?: unknown; y?: unknown }>)) {
      if (v && Number.isFinite(v.x) && Number.isFinite(v.y)) out[k] = { x: v.x as number, y: v.y as number }
    }
    return out
  } catch {
    return {}
  }
}

/** Merge `positions` into layout.json and drop ids with no matching R*.md. Returns the saved layout. */
export function writeRoadmapLayout(positions: RoadmapLayout, root: string): Promise<RoadmapLayout> {
  return withRoadmapLock(() => writeRoadmapLayoutUnlocked(positions, root))
}

async function writeRoadmapLayoutUnlocked(positions: RoadmapLayout, root: string): Promise<RoadmapLayout> {
  const clean: RoadmapLayout = {}
  for (const [k, v] of Object.entries(positions ?? {})) {
    const key = k.trim().toUpperCase()
    const ok = /^R\d+$/.test(key) && v && typeof v === 'object'
      && typeof v.x === 'number' && typeof v.y === 'number' && Number.isFinite(v.x) && Number.isFinite(v.y)
    if (!ok) throw new RoadmapError(`Invalid position for ${k}`)
    clean[key] = { x: v.x, y: v.y }
  }
  const merged = { ...(await readRoadmapLayout(root)), ...clean }

  const existing = new Set((await readRoadmapFiles(root)).map(f => f.item.id))
  const layout: RoadmapLayout = {}
  for (const key of Object.keys(merged).sort()) {
    if (existing.has(key)) layout[key] = merged[key]
  }

  await fs.mkdir(path.join(root, ROADMAP_DIR), { recursive: true })
  await fs.writeFile(path.join(root, ROADMAP_LAYOUT), JSON.stringify(layout, null, 2) + '\n', 'utf8')
  return layout
}
