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

export interface SearchResult {
  file: string
  hits: { line: number; text: string }[]
  totalHits: number
}

export interface ActivityEvent {
  id: string
  timestamp: string
  type: 'task_updated' | 'decision_logged' | 'memory_updated' | 'doc_read' | 'session_start'
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

  // Always include configured root
  const root = getConfiguredRoot()
  const name = path.basename(root)
  if (!projects.find(p => p.root === root)) {
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
