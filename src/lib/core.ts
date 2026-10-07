/**
 * src/lib/core.ts
 * All file-system operations. Used by API routes, MCP handler, and SSR.
 * Runs server-side only.
 */

import fs from 'fs/promises'
import { createReadStream } from 'fs'
import { createHash } from 'crypto'
import { Readable } from 'stream'
import path from 'path'
import os from 'os'
import { glob } from 'glob'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { applyEdits, type TextEdit } from './diff'
import { roadmapFromMarkdown, roadmapFromTasks, starterRoadmap, type RoadmapDraft, type RoadmapSource } from './roadmap-import'
import { pickNextTask, type QueueResult } from './work-queue'
import { selectPlan, validatePlan, type Plan } from './plan'
import { SESSION_GAP_MS, groupSessions, type Session } from './sessions'
import { parseManualTests, setAllManualTests, setManualTests, setManualTestsChecked, setManualTestsMeta, toggleManualTest, untestedItems, type AutoRun, type ManualTestsMeta } from './manual-tests'
import { REVIEWABLE, appendReviewEntry, autoFixStreak, formatReviewBody, latestReview, type ReviewMark, type ReviewOutcome } from './review'
import type { SavedView } from './board-views'
import { parseOwner } from './owner'
import { DEFAULT_SIZE_DAYS, datesOnMove, type SizeDays } from './auto-dates'
import { resolveStatus, statusDefs, statusLine, type StatusDef } from './statuses'
import { parseKeep } from './runs-retention'
import { isRunFile, isRunId, isRunTaskId, parseRange, parseRunHonesty, parseRunManifest, projectKey, runsRoot, type RunManifest } from './runs-paths'
import { failedMarksForRun, flakyFor, formatEvidence, matchItems, ticksForRun } from './evidence'
import { stepVerdict } from './honesty'
import { VIBEDOC_VERSION } from './version'
import { localToday } from './roadmap-health'
import { docPriority, parsePriority, setDocProperty, type Priority } from './doc-priority'
import { DEFAULT_SESSION_BUDGET, RELATED_MIN_SCORE, fitToBudget, formatEpisodeSection, formatRelated, indexHits, rankEntries, taskQuery, tokenize, type RecallEntry, type RecallHit } from './recall'
import { parseCovers, parseScenarios, seedSteps, type Scenario } from './scenarios'
import { formatVerifyContext, isOutdated, parseVerification, setVerification, type Finding, type Verification } from './verification'
import { applyDelta, parseSpecChanges, formatRelatedSpecs, formatSpecContext, parseSpec, parseSpecSlugs, taskSection, type RelatedSpecGroup, type Spec, type SpecContextEpic } from './specs'
import { buildEpisode, hasWork, isHandoffWritten, lastEventTitle, mergeSources, parseEpisode, sessionsNeedingEpisode, type Episode } from './episodes'
import { buildGraph, extractRefs, fileNode, type GraphItem, type MemoryGraph } from './memory-graph'
import { buildDocGraph, docNode, extractLinks, type DocGraph, type DocItem } from './doc-links'
import { findContradictions, findDuplicates, findStale, formatHealthWarnings, markRecalled, pruneDismissed, sortedLog, type HealthFlag, type RecallLog } from './memory-health'
import { mergeMemory, parseMemory, passedKeys, SECTIONS, type MemoryParams } from './memory-sections'
import { entrySlug, formatEntry, nextEntryId, normalizeEntryId, parseEntry, replaceEntryRefs, validateEntryInput, type Entry, type EntryInput, type EntryType } from './entries'
import { renderEntriesBlock, upsertManagedBlock } from './entries-export'
import { CLAUDE_SOURCE_PREFIX, claudeProjectSlug, parseClaudeMemory, planImport, type ClaudeMemoryCandidate, type ImportPlan } from './claude-memory'
import { isDemo, isPlayground } from './demo'
import { applyOverride, cleanOverride, detectFrontendApp, detectFrontendProject, FIXTURE_KIT_FILES, FIXTURE_KIT_IMPORT, hasChromium, PLAYWRIGHT_PACKAGES, playwrightStatus, playwrightTestDir, workspacePatterns, type FrontendApp, type FrontendAuth, type FrontendOverride, type PlaywrightStatus } from './frontend'

// ─── Types ────────────────────────────────────────────────────────────────────

export type TaskStatus = 'todo' | 'in-progress' | 'review' | 'blocked' | 'paused' | 'done' | 'cancelled'

export interface Task {
  id: string
  title: string
  status: TaskStatus
  size: string
  phase: string
  dependsOn: string
  /** A project status (R055) this task is in; `status` then holds its category. Unset for built-ins. */
  customStatus?: string
  /** `**Owner:**` "human" | "ai:<agent>", null when unset (R055) */
  owner: string | null
  /** `**Priority:** P0–P3`, null when unset */
  priority: Priority | null
  /** Optional `**Due:** YYYY-MM-DD` (local calendar date, compare as string). */
  due: string | null
  /** `**Started:**` / `**Done:**` dates, stamped on status moves (R055) */
  started: string | null
  finished: string | null
  /** The `## Manual tests` checklist (R043), counted; null when the task has none */
  /** `untested`: unticked items still needing a human (manual, or 🤖 without a passed run) */
  manualTests: { total: number; done: number; auto: number; untested: number; spec: string | null; autoRun: AutoRun | null } | null
  /** Newest recorded test run (R059), null when the task has none. `steps` / `passed` are counts. */
  lastRun: TaskLastRun | null
  /** Newest activity-log event about this task (ISO); null when the log has none (hand edits, or older than its 2000 events) */
  updatedAt: string | null
  /** `**Covers:** S1, S3`: the epic scenarios this task covers (R068); [] when none */
  covers: string[]
  /** The `## Verification` findings (R067); null when the task has none */
  verification: Verification | null
  file: string
  raw?: string
}

/** `failed`: the run's first failed step (feeds the /manual-tests decision bar and its send-back note). */
export type TaskLastRun = { runId: string; status: RunManifest['status']; steps: number; passed: number; failed: { index: number; name: string; error: string | null } | null }

export interface TaskBoard {
  todo: Task[]
  'in-progress': Task[]
  /** Optional step (R043): waiting for a human to approve or send back. Nothing requires it. */
  review: Task[]
  blocked: Task[]
  /** Stopped on purpose (R055): not claimable, not a met dependency */
  paused: Task[]
  done: Task[]
  cancelled: Task[]
}

export interface DocFile {
  path: string
  section: string
  name: string
  /** `priority:` in the doc's frontmatter, null when unset */
  priority?: Priority | null
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
  type: 'task_updated' | 'decision_logged' | 'memory_updated' | 'doc_read' | 'session_start' | 'doc_created' | 'doc_updated' | 'doc_deleted' | 'doc_renamed' | 'registry_rebuilt' | 'roadmap_updated'
  actor: 'ai' | 'human'
  title: string
  detail?: string
  taskId?: string
  taskStatus?: TaskStatus
  sessionId?: string
}

export interface Project {
  id: string
  name: string
  root: string
  hasVibedoc: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Loose status text ("Ready", "🔨 In-progress", "on hold") → built-in category. Custom ids need the project's defs (resolveStatus). */
export function normalizeStatus(raw: string): TaskStatus {
  return resolveStatus(raw).status
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

/** The project root for a request's `?root=` override. The read-only demo pins the configured root, so visitors can't read other host folders. */
export function rootFrom(override?: string | null): string {
  return (!isDemo() && !isPlayground() && override) || getConfiguredRoot()
}

// ─── Frontend app (R057) ──────────────────────────────────────────────────────

const SETTINGS_FILE = path.join('.vibedoc', 'settings.json')

/**
 * The project's web frontend (pure detection in frontend.ts): the best workspace package in a monorepo,
 * else the root package.json; `.vibedoc/settings.json` `frontend` overrides win (T139). Null when there is none.
 */
export async function detectFrontend(root: string): Promise<FrontendApp | null> {
  const read = (rel: string) => fs.readFile(path.join(root, rel), 'utf8').catch(() => null)
  const [packageJson, pnpmWorkspace, files, override] = await Promise.all([
    read('package.json'), read('pnpm-workspace.yaml'), fs.readdir(root).catch(() => [] as string[]), readFrontendOverride(root),
  ])
  const dirs = new Set<string>()
  for (const pattern of workspacePatterns(packageJson, pnpmWorkspace)) {
    const hits = await glob(`${pattern}/package.json`, { cwd: root, nodir: true, ignore: '**/node_modules/**', posix: true })
    for (const hit of hits) dirs.add(path.posix.dirname(hit))
  }
  const packages: { dir: string; packageJson: string }[] = []
  for (const dir of [...dirs].sort()) {
    const pkg = await read(path.join(dir, 'package.json'))
    if (pkg != null) packages.push({ dir, packageJson: pkg })
  }
  const detected = detectFrontendProject(packageJson, files, packages)
  return applyOverride(detected, override, dir =>
    dir === '.' ? detectFrontendApp('.', packageJson, files) : detectFrontendProject(null, files, packages.filter(p => p.dir === dir)))
}

/** Absolute dir of the app, or null when an override points it outside the project root. */
export function frontendAppDir(root: string, app: FrontendApp): string | null {
  const dir = path.resolve(root, app.dir)
  const rel = path.relative(path.resolve(root), dir)
  return rel.startsWith('..') || path.isAbsolute(rel) ? null : dir
}

/** Playwright's browser cache: PLAYWRIGHT_BROWSERS_PATH, else the per-OS default (playwright-core registry). */
function playwrightBrowsersDir(appDir: string): string {
  const env = process.env.PLAYWRIGHT_BROWSERS_PATH
  if (env === '0') return path.join(appDir, 'node_modules', 'playwright-core', '.local-browsers')
  if (env) return path.resolve(env)
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright')
  if (process.platform === 'win32') return path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local'), 'ms-playwright')
  return path.join(process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), '.cache'), 'ms-playwright')
}

/** T141: @playwright/test / playwright from the app's node_modules, then the root's; Chromium from the browser cache. */
export async function detectPlaywright(root: string, app: FrontendApp): Promise<PlaywrightStatus> {
  const appDir = frontendAppDir(root, app) ?? root
  const dirs = [...new Set([appDir, path.resolve(root)])]
  const reads = dirs.flatMap(d => PLAYWRIGHT_PACKAGES.map(pkg =>
    fs.readFile(path.join(d, 'node_modules', pkg, 'package.json'), 'utf8').catch(() => null)))
  const [jsons, cache] = await Promise.all([Promise.all(reads), fs.readdir(playwrightBrowsersDir(appDir)).catch(() => [] as string[])])
  return playwrightStatus(jsons, hasChromium(cache))
}

/** Snapshot of the app's package.json; the returned restore() writes it back (a failed install must leave it as it was). */
export async function snapshotPackageJson(appDir: string): Promise<() => Promise<void>> {
  const file = path.join(appDir, 'package.json')
  const before = await fs.readFile(file, 'utf8').catch(() => null)
  return async () => {
    if (before == null) return
    if ((await fs.readFile(file, 'utf8').catch(() => null)) !== before) await fs.writeFile(file, before, 'utf8')
  }
}

// T143: the Log in session. Live cookies: the folder's own .gitignore keeps it out of git.
const AUTH_DIR = path.join('.vibedoc', 'auth')
const AUTH_STATE = 'storage-state.json'

export async function frontendAuthStatus(root: string): Promise<FrontendAuth> {
  const st = await fs.stat(path.join(root, AUTH_DIR, AUTH_STATE)).catch(() => null)
  return st?.isFile() ? { saved: true, savedAt: st.mtime.toISOString() } : { saved: false }
}

/** Creates `.vibedoc/auth/` with a `*` .gitignore (before anything is saved there); returns the state file's absolute path. */
export async function prepareFrontendAuth(root: string): Promise<string> {
  const dir = path.resolve(root, AUTH_DIR)
  await fs.mkdir(dir, { recursive: true })
  const ignore = path.join(dir, '.gitignore')
  if ((await fs.readFile(ignore, 'utf8').catch(() => null)) !== '*\n') await fs.writeFile(ignore, '*\n', 'utf8')
  return path.join(dir, AUTH_STATE)
}

/** Deletes the saved session. False when there was none. */
export async function clearFrontendAuth(root: string): Promise<boolean> {
  return fs.rm(path.join(root, AUTH_DIR, AUTH_STATE)).then(() => true, () => false)
}

// T144: the last smoke test screenshot, next to the session (same git-ignored folder)
const SMOKE_SHOT = 'smoke.png'

/** Where the smoke test writes its screenshot (absolute, the folder exists, the old shot removed) and where Log in's session is. */
export async function prepareFrontendSmoke(root: string): Promise<{ shotPath: string; statePath: string }> {
  const statePath = await prepareFrontendAuth(root)
  const shotPath = path.join(path.dirname(statePath), SMOKE_SHOT)
  await fs.rm(shotPath, { force: true })
  return { shotPath, statePath }
}

/** The last smoke screenshot's bytes, or null when there is none. */
export async function readFrontendSmokeShot(root: string): Promise<Buffer | null> {
  return fs.readFile(path.join(root, AUTH_DIR, SMOKE_SHOT)).catch(() => null)
}

/** {} when the file is missing; throws when it exists but isn't a JSON object, so a save never clobbers it. */
async function readSettingsObject(root: string): Promise<Record<string, unknown>> {
  const raw = await fs.readFile(path.join(root, SETTINGS_FILE), 'utf8').catch(() => null)
  if (raw == null) return {}
  const s = JSON.parse(raw)
  if (!s || typeof s !== 'object' || Array.isArray(s)) throw new Error(`${SETTINGS_FILE} is not a JSON object`)
  return s
}

export async function readFrontendOverride(root: string): Promise<FrontendOverride | null> {
  return cleanOverride(await readSettingsObject(root).then(s => s.frontend, () => null))
}

/** T142: `frontend.startTimeoutSec` in .vibedoc/settings.json, how long Start waits for the app to respond (default 60). */
export async function readFrontendStartTimeoutSec(root: string): Promise<number> {
  const raw = await readSettingsObject(root).then(s => (s.frontend as { startTimeoutSec?: unknown } | undefined)?.startTimeoutSec, () => null)
  return typeof raw === 'number' && raw > 0 ? raw : 60
}

/**
 * R061: VibeDoc's Playwright reporter, passed to a Run by absolute path. The .ts source in a checkout (Playwright
 * transpiles it), else the compiled `dist/` file of an npm install. Null when neither is there.
 */
export async function testReporterPath(): Promise<string | null> {
  for (const rel of ['src/testing/vibedoc-reporter.ts', 'dist/testing/vibedoc-reporter.js']) {
    const p = path.join(process.cwd(), rel)
    if (await fs.stat(p).then(st => st.isFile(), () => false)) return p
  }
  return null
}

const PLAYWRIGHT_CONFIGS = ['ts', 'mts', 'js', 'mjs', 'cjs'].map(ext => `playwright.config.${ext}`)

/**
 * R061: VibeDoc's Playwright fixture copied into the app at `<testDir>/vibedoc/kit/` (TS sources; Playwright
 * transpiles them and they use the app's own @playwright/test). Specs import FIXTURE_KIT_IMPORT and the kit is
 * committed with them. Rewritten only when its VERSION (VibeDoc's version + a source hash) differs or a file is missing; nothing else
 * under `<testDir>/vibedoc/` is touched. Null when the app dir is outside the project or the sources are missing.
 */
export async function ensureFixtureKit(root: string, app: FrontendApp): Promise<{ dir: string; importPath: string; written: boolean } | null> {
  const appDir = frontendAppDir(root, app)
  if (!appDir) return null
  let config: string | null = null
  for (const name of PLAYWRIGHT_CONFIGS) {
    config = await fs.readFile(path.join(appDir, name), 'utf8').catch(() => null)
    if (config !== null) break
  }
  const dir = path.join(appDir, playwrightTestDir(config), 'vibedoc', 'kit')
  const result = { dir: path.relative(root, dir) || '.', importPath: FIXTURE_KIT_IMPORT }
  const sources = await Promise.all(FIXTURE_KIT_FILES.map(f => fs.readFile(path.join(process.cwd(), 'src', f), 'utf8').catch(() => null)))
  if (sources.some(src => src === null)) return null
  // Version + a hash of the sources: a changed fixture rewrites the kit even within one VibeDoc version (dev)
  const want = `${VIBEDOC_VERSION}+${createHash('sha1').update(sources.join('\0')).digest('hex').slice(0, 8)}`
  const stamp = await fs.readFile(path.join(dir, 'VERSION'), 'utf8').catch(() => null)
  const present = await Promise.all(FIXTURE_KIT_FILES.map(f => fs.stat(path.join(dir, f)).then(() => true, () => false)))
  if (stamp?.trim() === want && present.every(Boolean)) return { ...result, written: false }
  for (const [i, f] of FIXTURE_KIT_FILES.entries()) {
    await fs.mkdir(path.dirname(path.join(dir, f)), { recursive: true })
    await fs.writeFile(path.join(dir, f), sources[i]!, 'utf8')
  }
  await fs.writeFile(path.join(dir, 'VERSION'), `${want}\n`, 'utf8')
  return { ...result, written: true }
}

/** Sets (or, for null / all-empty, removes) `frontend` in .vibedoc/settings.json; every other key is kept. */
export async function saveFrontendOverride(override: FrontendOverride | null, root: string): Promise<FrontendOverride | null> {
  const clean = cleanOverride(override)
  const file = path.join(root, SETTINGS_FILE)
  const settings = await readSettingsObject(root)
  // Keep a hand-set start timeout (T142): it isn't part of the override form
  const timeout = (settings.frontend as { startTimeoutSec?: unknown } | undefined)?.startTimeoutSec
  const kept = timeout === undefined ? clean : { ...clean, startTimeoutSec: timeout }
  if (kept) settings.frontend = kept
  else if ('frontend' in settings) delete settings.frontend
  else return null // nothing to reset: don't create the file
  await fs.mkdir(path.dirname(file), { recursive: true })
  const tmp = `${file}.tmp`
  await fs.writeFile(tmp, JSON.stringify(settings, null, 2), 'utf8')
  await fs.rename(tmp, file)
  return clean
}

// ─── Multi-project: scan parent directories ───────────────────────────────────

export async function discoverProjects(searchBase?: string): Promise<Project[]> {
  const base = searchBase || path.dirname(getConfiguredRoot())
  const projects: Project[] = []

  if (!isDemo() && !isPlayground()) try {
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

  // ponytail: reads every doc for its frontmatter; read only the head of each file if lists get slow
  return Promise.all(files.sort().map(async f => ({
    path: f,
    section: inferSection(f),
    name: path.basename(f, '.md'),
    priority: docPriority(await fs.readFile(path.join(root, f), 'utf8').catch(() => '')),
  })))
}

/** Sets (value) or removes (null) frontmatter properties of a doc; the rest of the file is untouched. */
export async function setDocProperties(docPath: string, props: Record<string, string | null>, root: string): Promise<void> {
  const fullPath = path.resolve(root, docPath)
  if (!fullPath.startsWith(path.resolve(root) + path.sep)) throw new Error('Path outside root')
  const content = await fs.readFile(fullPath, 'utf8')
  const next = Object.entries(props).reduce((c, [k, v]) => setDocProperty(c, k, v), content)
  if (next !== content) await fs.writeFile(fullPath, next, 'utf8')
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

// Reads the doc at an exact path ('' if missing) and applies old_string→new_string edits.
// dryRun validates without writing (used to check a proposal before the user sees it).
export async function editDoc(
  docPath: string,
  edits: TextEdit[],
  root: string,
  dryRun = false,
): Promise<{ before: string; content: string }> {
  const resolvedRoot = path.resolve(root)
  const fullPath = path.resolve(root, docPath)
  if (!fullPath.startsWith(resolvedRoot + path.sep)) throw new Error('Path outside root')
  const before = await fs.readFile(fullPath, 'utf8').catch((e: NodeJS.ErrnoException) => {
    if (e.code === 'ENOENT') return ''
    throw e
  })
  const result = applyEdits(before, edits)
  if ('error' in result) throw new Error(result.error)
  if (!dryRun) {
    await fs.mkdir(path.dirname(fullPath), { recursive: true })
    await fs.writeFile(fullPath, result.content, 'utf8')
  }
  return { before, content: result.content }
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

export async function createDoc(docPath: string, content: string, root: string, actor: 'ai' | 'human' = 'human'): Promise<void> {
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
  await appendActivity(root, { type: 'doc_created', actor, title: `Created: ${docPath}`, detail: docPath })
  try { const { exists } = await readRegistry(root); if (exists) await rebuildRegistry(root, actor, false) } catch {}
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

const warnedStatuses = new Set<string>()

function parseTaskFile(filePath: string, content: string, defs: StatusDef[]): Task {
  const lines = content.split('\n')
  const filename = path.basename(filePath, '.md')
  const titleLine = lines.find(l => l.startsWith('# '))
  const title = (titleLine || '').replace(/^#+\s*/, '').replace(/^T\d+\s*[:—–-]\s*/i, '').trim() || filename

  // Only the head block under the H1 counts, so a `**Depends on:**` quoted in the body can't override it.
  const meta: Record<string, string> = {}
  for (const line of lines.slice(0, roadmapMetaEnd(lines))) {
    const m = line.match(/\*\*([^*]+):\*\*\s*(.+)/)
    if (m) meta[m[1].toLowerCase().trim()] = m[2].trim()
  }

  const resolved = resolveStatus(meta['status'] || 'todo', defs)
  const warnKey = `${filePath}\0${meta['status']}`
  if (resolved.unknown && !warnedStatuses.has(warnKey)) {
    // listTasks runs on every refresh: warn once per file + value per process
    warnedStatuses.add(warnKey)
    console.warn(`[vibedoc] ${filePath}: unknown status "${meta['status']}", shown as todo`)
  }
  const { status, customStatus } = resolved
  const idM = filename.match(/^(T\d+)/i)
  const id = idM ? idM[1].toUpperCase() : filename.toUpperCase()

  const tests = parseManualTests(content)
  const manualTests = tests && { total: tests.total, done: tests.done, auto: tests.auto, untested: untestedItems(tests).length, spec: tests.spec, autoRun: tests.autoRun }
  return { id, title, status, ...(customStatus && { customStatus }), size: meta['size'] || '', phase: meta['phase'] || '', dependsOn: meta['depends on'] || '', owner: parseOwner(meta['owner']), priority: parsePriority(meta['priority']), due: parseDue(meta['due'] || ''), started: parseDue(meta['started'] || ''), finished: parseDue(meta['done'] || ''), manualTests, lastRun: null, updatedAt: null, covers: parseCovers(meta['covers']), verification: parseVerification(content), file: filePath, raw: content }
}

export async function listTasks(root: string): Promise<{ tasks: Task[]; board: TaskBoard }> {
  const { statuses } = await readProjectSettings(root)
  let files = await glob('plans/tasks/T*.md', { cwd: root, nodir: true })
  if (files.length === 0) files = await glob('plans/T*.md', { cwd: root, nodir: true })

  const tasks: Task[] = []
  for (const f of files.sort()) {
    try {
      const content = await fs.readFile(path.join(root, f), 'utf8')
      tasks.push(parseTaskFile(f, content, statuses))
    } catch {}
  }

  const [lastRuns, updated] = await Promise.all([lastRunsByTask(root), taskUpdatedAt(root)])
  for (const t of tasks) t.updatedAt = updated.get(t.id) ?? null
  await markOutdatedVerifications(tasks, root)
  const board: TaskBoard = { todo: [], 'in-progress': [], review: [], blocked: [], paused: [], done: [], cancelled: [] }
  for (const t of tasks) {
    t.lastRun = lastRuns.get(t.id) ?? null
    const col = (board[t.status] ? t.status : 'todo') as TaskStatus
    board[col].push(t)
  }
  return { tasks, board }
}

export async function getTask(taskId: string, root: string): Promise<Task> {
  const { statuses } = await readProjectSettings(root)
  const id = taskId.toUpperCase().startsWith('T') ? taskId.toUpperCase() : `T${taskId}`
  for (const pattern of [`plans/tasks/${id}*.md`, `plans/${id}*.md`]) {
    const matches = await glob(pattern, { cwd: root, nodir: true })
    if (matches.length > 0) {
      const content = await fs.readFile(path.join(root, matches[0]), 'utf8')
      const task = parseTaskFile(matches[0], content, statuses)
      task.lastRun = toLastRun((await listRuns(task.id, root))[0])
      task.updatedAt = (await taskUpdatedAt(root)).get(task.id) ?? null
      await markOutdatedVerifications([task], root)
      return task
    }
  }
  throw new Error(`Task not found: ${taskId}`)
}

/** Task id → its newest activity-log event time (the log is newest first, 2000 events max). */
async function taskUpdatedAt(root: string): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  for (const e of await readActivity(root, 2000)) if (e.taskId && !out.has(e.taskId)) out.set(e.taskId, e.timestamp)
  return out
}

const OUTDATED_LOG_MAX = 2000

/**
 * R067: a verification report is outdated once a commit naming its task lands after the report's sha. One git log
 * per call, and only when some report has a sha; no git → nothing is outdated.
 */
async function markOutdatedVerifications(tasks: Task[], root: string): Promise<void> {
  const withSha = tasks.filter(t => t.verification?.sha)
  if (!withSha.length) return
  let log: { sha: string; subject: string }[]
  try {
    // ponytail: the newest 2000 commits; a report older than that never shows as outdated
    log = (await git(['log', '-n', String(OUTDATED_LOG_MAX), '--format=%H%x1f%s'], root))
      .split('\n').filter(Boolean).map(l => { const [sha, subject] = l.split('\x1f'); return { sha, subject } })
  } catch (e) {
    console.warn('verification: git log unavailable', e instanceof Error ? e.message : e)
    return
  }
  for (const t of withSha) {
    if (t.verification && isOutdated(t.verification.sha, t.id, log)) t.verification.outdated = true
  }
}

// ─── Test runs (R059) ─────────────────────────────────────────────────────────
// Recorded by the vibedoc/playwright fixture in `<runsRoot>/<projectKey>/<taskId>/<runId>/`, outside the repo.

/** A task's runs folder, or null when the id isn't a plain task id (it comes from the URL). */
function taskRunsDir(taskId: string, root: string): string | null {
  return isRunTaskId(taskId) ? path.join(runsRoot(), projectKey(root), taskId) : null
}

async function readRunManifest(dir: string): Promise<RunManifest | null> {
  try {
    const run = parseRunManifest(await fs.readFile(path.join(dir, 'run.json'), 'utf8'))
    // R063: the blank-app check the fixture wrote after a later pass, when there was one
    const honesty = run && parseRunHonesty(await fs.readFile(path.join(dir, 'honesty.json'), 'utf8').catch(() => ''))
    return run && honesty ? { ...run, honesty } : run
  } catch {
    return null // no run.json yet (still running) or unreadable
  }
}

/** A task's runs, newest first. Folders without a valid run.json are skipped. Demo / no runs dir → []. */
export async function listRuns(taskId: string, root: string): Promise<RunManifest[]> {
  const dir = taskRunsDir(taskId, root)
  if (!dir || isDemo()) return []
  let ids: string[]
  try {
    ids = (await fs.readdir(dir)).filter(isRunId).sort().reverse()
  } catch {
    return []
  }
  const runs = await Promise.all(ids.map(id => readRunManifest(path.join(dir, id))))
  return runs.filter((r): r is RunManifest => r !== null)
}

/**
 * A task's evidence doc (R060), formatted fresh from its checklist (ticks included) and kept runs; never written
 * here (the fixture owns EVIDENCE.md). `src` maps a run's media file to a link: API URLs for the UI, absolute
 * paths for MCP (default). null = `runId` names no kept run.
 */
/** R063: a step's honesty verdict within its run (assertion counts + the run's blank-app check). */
const runVerdict = (s: RunManifest['steps'][number], run: RunManifest) => stepVerdict(s, !!run.honesty?.blankPassed.includes(s.name))

/** R062: one checklist item against the shown run, for the review controls (not derived from the markdown). */
export type EvidenceRow = {
  item: number; text: string; auto: boolean; group: 'steps' | 'regression'
  result: 'passed' | 'failed' | 'missing' | 'manual'; screenshot: string | null; error: string | null
  /** R063: why this step doesn't prove the item ([] = it does, or unknown) */
  unverified: string[]
  /** R065: passed only on a retry; what the first attempt showed (screenshot = a file of this run) */
  flaky: { attempts: number; error: string | null; screenshot: string | null } | null
}

export async function getEvidence(taskId: string, root: string, opts: { runId?: string | null; src?: (runId: string, file: string) => string } = {}):
  Promise<{ markdown: string; runId: string | null; runs: { runId: string; status: RunManifest['status']; startedAt: string; commit: string | null }[]; rows: EvidenceRow[] } | null> {
  const task = await getTask(taskId, root)
  const runs = await listRuns(task.id, root)
  if (opts.runId && !runs.some(r => r.runId === opts.runId)) return null
  const dir = taskRunsDir(task.id, root)
  const tests = task.raw ? parseManualTests(task.raw) : null
  const markdown = formatEvidence({
    taskId: task.id, title: task.title, items: tests?.items ?? [], spec: tests?.spec ?? null, runs, runId: opts.runId,
    src: opts.src ?? ((runId, file) => path.join(dir ?? '', runId, file)), verdict: runVerdict,
  })
  const shown = (opts.runId ? runs.find(r => r.runId === opts.runId) : runs[0]) ?? null
  const rows = matchItems(tests?.items ?? [], shown, runVerdict).rows.map((r): EvidenceRow => ({
    item: r.item.index, text: r.item.text, auto: r.item.auto, group: r.item.group, result: r.result,
    screenshot: r.step?.screenshot ?? null, error: r.step?.error ?? null, unverified: r.unverified,
    flaky: (() => {
      const f = r.step ? flakyFor(shown, r.step.name) : null
      return f ? { attempts: f.attempts, error: f.firstFailure.error, screenshot: f.firstFailure.screenshot } : null
    })(),
  }))
  return {
    markdown, runId: shown?.runId ?? null,
    runs: runs.map(r => ({ runId: r.runId, status: r.status, startedAt: r.startedAt, commit: r.commit })),
    rows,
  }
}

/**
 * R061: a cancelled Run leaves its run folder half-written (screenshots, a page@….webm, no run.json), which
 * retention never counts. Removes every such folder of the project whose runId is at or after `since` (ISO): the
 * spec's own `vibedocTask` may differ from the task Run was pressed on, and only one Run goes at a time.
 */
export async function removeUnfinishedRuns(root: string, since: string): Promise<number> {
  if (isDemo()) return 0
  const projectDir = path.join(runsRoot(), projectKey(root))
  const from = since.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')
  const tasks = await fs.readdir(projectDir).then(n => n.filter(isRunTaskId), () => [] as string[])
  let removed = 0
  for (const task of tasks) {
    const dir = path.join(projectDir, task)
    const ids = await fs.readdir(dir).then(n => n.filter(id => isRunId(id) && id >= from), () => [] as string[])
    for (const id of ids) {
      if (await fs.stat(path.join(dir, id, 'run.json')).then(() => true, () => false)) continue
      await fs.rm(path.join(dir, id), { recursive: true, force: true })
      removed++
    }
  }
  return removed
}

function toLastRun(r: RunManifest | undefined): TaskLastRun | null {
  if (!r) return null
  const f = r.steps.find(s => s.status === 'failed')
  return { runId: r.runId, status: r.status, steps: r.steps.length, passed: r.steps.filter(s => s.status === 'passed').length, failed: f ? { index: f.index, name: f.name, error: f.error } : null }
}

/** Newest valid run of every task that has one: one readdir per task folder, run.json read until one parses. */
async function lastRunsByTask(root: string): Promise<Map<string, TaskLastRun>> {
  const out = new Map<string, TaskLastRun>()
  if (isDemo()) return out
  let taskIds: string[]
  try {
    taskIds = (await fs.readdir(path.join(runsRoot(), projectKey(root)))).filter(isRunTaskId)
  } catch {
    return out // no runs yet
  }
  await Promise.all(taskIds.map(async id => {
    const dir = path.join(runsRoot(), projectKey(root), id)
    const runIds = await fs.readdir(dir).then(n => n.filter(isRunId).sort().reverse(), () => [])
    for (const runId of runIds) {
      const last = toLastRun((await readRunManifest(path.join(dir, runId))) ?? undefined)
      if (last) return void out.set(id, last)
    }
  }))
  return out
}

/**
 * One screenshot or video of a run, as a web stream. Ids and name are checked before any path join.
 * `range` is the request's Range header. null = bad input or no such file; 'unsatisfiable' → 416.
 */
export async function readRunFile(taskId: string, runId: string, file: string, root: string, range?: string | null):
  Promise<{ stream: ReadableStream<Uint8Array>; size: number; span: { start: number; end: number } | null } | { unsatisfiable: true; size: number } | null> {
  const dir = taskRunsDir(taskId, root)
  if (!dir || !isRunId(runId) || !isRunFile(file) || isDemo()) return null
  const filePath = path.join(dir, runId, file)
  let size: number
  try {
    const st = await fs.stat(filePath)
    if (!st.isFile()) return null
    size = st.size
  } catch {
    return null
  }
  const span = parseRange(range, size)
  if (span === 'unsatisfiable') return { unsatisfiable: true, size }
  const node = createReadStream(filePath, span ?? undefined)
  return { stream: Readable.toWeb(node) as ReadableStream<Uint8Array>, size, span }
}

/**
 * Owner that a status change assigns (R055): an agent that starts a task takes it over;
 * a human move only fills an empty owner. Approve / send back pass no mover and leave it alone.
 */
function ownerAfterMove(current: string | null, status: TaskStatus, mover?: { actor: 'ai' | 'human'; agent?: string }): string | null {
  if (!mover) return current
  if (mover.actor === 'ai') return status === 'in-progress' ? parseOwner(`ai:${mover.agent || 'agent'}`) ?? 'ai:agent' : current
  return current ?? 'human'
}

/**
 * The task settings from .vibedoc/settings.json (R055): `tasks.sizeDays` over the defaults (automatic due dates)
 * and `statuses` (custom statuses; the built-ins when unset). `runs.keep` (R059): test runs kept per task, default 5.
 */
export async function readProjectSettings(root: string): Promise<{ sizeDays: SizeDays; statuses: StatusDef[]; sessionBudgetTokens: number; runsKeep: number; testRetries: number; autoSendBack: boolean; maxAutoFixes: number }> {
  let s: { tasks?: { sizeDays?: SizeDays }; tests?: { retries?: unknown; autoSendBack?: unknown; maxAutoFixes?: unknown }; statuses?: unknown; memory?: { sessionBudgetTokens?: unknown }; runs?: { keep?: unknown } } | null = null
  try { s = JSON.parse(await fs.readFile(path.join(root, '.vibedoc', 'settings.json'), 'utf8')) } catch {}
  const budget = Number(s?.memory?.sessionBudgetTokens)
  return {
    sizeDays: { ...DEFAULT_SIZE_DAYS, ...(s?.tasks?.sizeDays ?? {}) }, statuses: statusDefs(s?.statuses),
    // R048: token cap for what vibedoc_read_memory returns
    sessionBudgetTokens: budget > 0 ? budget : DEFAULT_SESSION_BUDGET,
    runsKeep: parseKeep(s?.runs?.keep),
    // R065: Playwright retries per Run / suite (`tests.retries`, default 2, 0 = off); fail-then-pass = flaky
    testRetries: Number.isInteger(s?.tests?.retries) && (s?.tests?.retries as number) >= 0 ? Math.min(s?.tests?.retries as number, 5) : 2,
    // R065: a failed Run sends a done / review task back to the agent (`tests.autoSendBack`, default on)
    autoSendBack: s?.tests?.autoSendBack !== false,
    // R065: automatic send-backs in a row before a failed Run goes to a human instead (`tests.maxAutoFixes`)
    maxAutoFixes: Number.isInteger(s?.tests?.maxAutoFixes) && (s?.tests?.maxAutoFixes as number) >= 1 ? (s?.tests?.maxAutoFixes as number) : 3,
  }
}

/** Replace-or-insert (or remove, for '' / null) one `**Label:**` line inside the head meta block. */
function withMetaLine(content: string, label: string, value: string | null): string {
  const lines = content.split('\n')
  const end = roadmapMetaEnd(lines)
  const at = lines.slice(0, end).findIndex(l => l.toLowerCase().startsWith(`**${label.toLowerCase()}:**`))
  if (!value) { if (at >= 0) lines.splice(at, 1) }
  else if (at >= 0) lines[at] = `**${label}:** ${value}`
  else lines.splice(end, 0, `**${label}:** ${value}`)
  return lines.join('\n')
}

export async function updateTaskStatus(
  /** A built-in status, an alias, or one of the project's custom status ids */
  taskId: string, statusKey: string, root: string, actor: 'ai' | 'human' = 'human',
  /** Set by a board move or an agent claim / update; drives the owner (see ownerAfterMove) */
  mover?: { actor: 'ai' | 'human'; agent?: string },
): Promise<{ task: Task; previousStatus: TaskStatus }> {
  const task = await getTask(taskId, root)
  const previousStatus = task.status
  const { statuses, sizeDays } = await readProjectSettings(root)
  const resolved = resolveStatus(statusKey, statuses)
  if (resolved.unknown) throw new RoadmapError(`Unknown status "${statusKey}" (expected ${statuses.map(d => d.id).join(' | ')})`)
  const newStatus = resolved.status
  const line = statusLine(statusKey, statuses)

  let content = task.raw!
  const statusPattern = /(\*\*Status:\*\*\s*).+/
  if (statusPattern.test(content)) {
    content = content.replace(statusPattern, `$1${line}`)
  } else {
    content = content.replace(/^(#[^\n]+\n)/, `$1**Status:** ${line}\n`)
  }

  const owner = ownerAfterMove(task.owner, newStatus, mover)
  if (owner !== task.owner) content = withMetaLine(content, 'Owner', owner)

  const dates = datesOnMove(newStatus, { due: task.due, started: task.started, done: task.finished }, task.size, localToday(), sizeDays)
  if (dates.due !== task.due) content = withMetaLine(content, 'Due', dates.due)
  if (dates.started !== task.started) content = withMetaLine(content, 'Started', dates.started)
  if (dates.done !== task.finished) content = withMetaLine(content, 'Done', dates.done)

  await fs.writeFile(path.join(root, task.file), content, 'utf8')

  // A move to the status the task already has (re-claim, repeated update_task) isn't news
  const unchanged = task.status === newStatus && task.customStatus === resolved.customStatus
  if (!unchanged) await appendActivity(root, {
    type: 'task_updated', actor,
    title: `${task.id} moved to ${newStatus}`,
    detail: task.title,
    taskId: task.id,
    taskStatus: newStatus,
  })

  const { customStatus: _old, ...rest } = task
  return { task: { ...rest, status: newStatus, ...(resolved.customStatus && { customStatus: resolved.customStatus }), owner, due: dates.due, started: dates.started, finished: dates.done, raw: content }, previousStatus }
}

/** Write (or replace) the task's `## Manual tests` checklist. `report` is a markdown checklist; plain lines become items. */
export interface TaskMetaPatch {
  title?: string
  size?: string
  phase?: string
  dependsOn?: string
  /** YYYY-MM-DD, or null / '' to remove the line */
  due?: string | null
  /** "human" | "ai:<agent>", or null / '' to remove the line */
  owner?: string | null
  /** P0–P3, or null / '' to remove the line */
  priority?: string | null
}

const TASK_META_LABELS: [keyof Omit<TaskMetaPatch, 'title'>, string][] = [
  ['phase', 'Phase'], ['size', 'Size'], ['dependsOn', 'Depends on'], ['due', 'Due'], ['owner', 'Owner'], ['priority', 'Priority'],
]

/** Rewrite the H1 and the head meta block only; the body (manual tests, review, spec) stays byte-for-byte. */
export async function updateTaskMeta(
  taskId: string, patch: TaskMetaPatch, root: string, actor: 'ai' | 'human' = 'human'
): Promise<Task> {
  const task = await getTask(taskId, root)
  const oneLine = (v: string) => v.replace(/\s+/g, ' ').trim()
  const lines = task.raw!.split('\n')
  let end = roadmapMetaEnd(lines)

  if (patch.title !== undefined) {
    const title = oneLine(patch.title)
    if (!title) throw new RoadmapError('title must not be empty')
    const h1 = lines.findIndex(l => l.startsWith('# '))
    if (h1 >= 0) lines[h1] = `# ${task.id}: ${title}`
    else { lines.unshift(`# ${task.id}: ${title}`); end++ }
  }

  for (const [key, label] of TASK_META_LABELS) {
    const raw = patch[key]
    if (raw === undefined) continue
    let value = raw === null ? '' : oneLine(raw)
    if (key === 'due' && value) {
      const d = parseDue(value)
      if (!d) throw new RoadmapError(`due must be a date YYYY-MM-DD (got ${JSON.stringify(raw)})`)
      value = d
    }
    if (key === 'owner' && value) {
      const o = parseOwner(value)
      if (!o) throw new RoadmapError(`owner must be "human" or "ai:<agent>" (got ${JSON.stringify(raw)})`)
      value = o
    }
    if (key === 'priority' && value) {
      const p = parsePriority(value)
      if (!p) throw new RoadmapError(`priority must be P0, P1, P2 or P3 (got ${JSON.stringify(raw)})`)
      value = p
    }
    const at = lines.slice(0, end).findIndex(l => l.toLowerCase().startsWith(`**${label.toLowerCase()}:**`))
    if (!value && (key === 'due' || key === 'owner' || key === 'priority')) {
      if (at >= 0) { lines.splice(at, 1); end-- }
      continue
    }
    const line = `**${label}:** ${value || '—'}`
    if (at >= 0) lines[at] = line
    else { lines.splice(end, 0, line); end++ }
  }

  const content = lines.join('\n')
  if (content === task.raw) return task
  await fs.writeFile(path.join(root, task.file), content, 'utf8')
  await appendActivity(root, { type: 'task_updated', actor, title: `${task.id} edited`, detail: task.title, taskId: task.id })
  return getTask(task.id, root)
}

/** Where a deleted task sat in an epic's **Tasks:** line, so Undo can put it back in place. */
export interface TaskLink { epic: string; index: number }

/** Delete the task file and unlink it from every epic's **Tasks:** line. Returns the removed task (with raw) and its links. */
export function deleteTask(taskId: string, root: string, actor: 'ai' | 'human' = 'human'): Promise<{ task: Task; links: TaskLink[] }> {
  return withTaskClaimLock(async () => {
    const task = await getTask(taskId, root)
    await fs.unlink(path.join(root, task.file))
    // Task lock, then roadmap lock: same order as applyPlan.
    const { items } = await listRoadmap(root)
    const links: TaskLink[] = []
    for (const epic of items.filter(i => i.tasks.includes(task.id))) {
      links.push({ epic: epic.id, index: epic.tasks.indexOf(task.id) })
      await updateRoadmapItem(epic.id, { tasks: epic.tasks.filter(t => t !== task.id) }, root, actor, false)
    }
    await appendActivity(root, { type: 'task_updated', actor, title: `${task.id} deleted`, detail: task.title, taskId: task.id })
    return { task, links }
  })
}

/** Move a task to an epic (or out of every epic): the epics' **Tasks:** lines and the task's **Phase:** follow. */
export async function setTaskEpic(taskId: string, epicId: string | null, root: string, actor: 'ai' | 'human' = 'human'): Promise<Task> {
  const task = await getTask(taskId, root)
  const { items } = await listRoadmap(root)
  const target = epicId ? items.find(i => i.id === epicId.trim().toUpperCase() && i.parent !== null) : undefined
  if (epicId && !target) throw new RoadmapError(`Epic not found: ${epicId}`)
  for (const e of items.filter(i => i.tasks.includes(task.id) && i.id !== target?.id)) {
    await updateRoadmapItem(e.id, { tasks: e.tasks.filter(t => t !== task.id) }, root, actor, false)
  }
  if (target && !target.tasks.includes(task.id)) await updateRoadmapItem(target.id, { tasks: [...target.tasks, task.id] }, root, actor, false)
  return updateTaskMeta(task.id, { phase: target ? `${target.id} — ${target.title}` : '' }, root, actor)
}

export type BulkTaskAction = { status: string } | { epic: string | null } | { delete: true }

/** One action over many tasks. Stops at the first failure; tasks before it keep the change. */
export async function bulkTasks(
  ids: string[], action: BulkTaskAction, root: string, actor: 'ai' | 'human' = 'human'
): Promise<{ deleted: { task: Task; links: TaskLink[] }[] }> {
  const deleted: { task: Task; links: TaskLink[] }[] = []
  for (const id of ids) {
    if ('status' in action) await updateTaskStatus(id, action.status, root, actor, { actor })
    else if ('epic' in action) await setTaskEpic(id, action.epic, root, actor)
    else if ('delete' in action) deleted.push(await deleteTask(id, root, actor))
  }
  return { deleted }
}

/** Only a plain `<dir>/<name>.md` path counts: no traversal, no subfolders. */
function isFileIn(rel: unknown, dir: string, name: RegExp): rel is string {
  if (typeof rel !== 'string') return false
  const norm = path.posix.normalize(rel)
  return norm === rel && path.posix.dirname(norm) === dir && name.test(path.posix.basename(norm))
}

/** Undo for deleteTask: write the file back byte-for-byte (never over an existing one) and re-link it. */
export function restoreTask(file: unknown, raw: unknown, links: TaskLink[], root: string, actor: 'ai' | 'human' = 'human'): Promise<Task> {
  return withTaskClaimLock(async () => {
    if (!isFileIn(file, 'plans/tasks', /^T\d+[^/]*\.md$/) || typeof raw !== 'string') throw new RoadmapError('Invalid task to restore')
    const id = path.basename(file).match(/^(T\d+)/i)![1].toUpperCase()
    if (await getTask(id, root).then(() => true, () => false)) throw new RoadmapError(`${id} already exists`)
    await fs.mkdir(path.join(root, 'plans/tasks'), { recursive: true })
    await fs.writeFile(path.join(root, file), raw, { flag: 'wx', encoding: 'utf8' })
    const { items } = await listRoadmap(root)
    for (const link of Array.isArray(links) ? links : []) {
      const epic = items.find(i => i.id === link?.epic)
      if (!epic || epic.tasks.includes(id)) continue
      const tasks = [...epic.tasks]
      tasks.splice(Math.max(0, Math.min(Number(link.index) || 0, tasks.length)), 0, id)
      await updateRoadmapItem(epic.id, { tasks }, root, actor, false)
    }
    await appendActivity(root, { type: 'task_updated', actor, title: `${id} restored`, taskId: id })
    return getTask(id, root)
  })
}

/** Write a new `## Manual tests` report (report given), or only update the spec / last run of the existing one (report null). */
export async function saveManualTests(taskId: string, report: string | null, root: string, actor: 'ai' | 'human' = 'ai', meta: ManualTestsMeta = {}): Promise<Task> {
  const task = await getTask(taskId, root)
  const date = new Date().toISOString().slice(0, 10)
  const content = report !== null
    ? setManualTests(task.raw ?? '', report, actor, date, meta)
    : setManualTestsMeta(task.raw ?? '', meta, actor, date)
  await fs.writeFile(path.join(root, task.file), content, 'utf8')
  return getTask(task.id, root)
}

/** Write a new `## Verification` report (R067), replacing the old one; `sha` = the commit the agent checked. */
export async function saveVerification(taskId: string, findings: Finding[], root: string, by: string, sha?: string): Promise<Task> {
  const task = await getTask(taskId, root)
  const at = new Date().toISOString().slice(0, 10)
  const content = setVerification(task.raw ?? '', { at, by, ...(sha ? { sha } : {}), findings })
  await fs.writeFile(path.join(root, task.file), content, 'utf8')
  await appendActivity(root, {
    type: 'task_updated', actor: 'ai', taskId: task.id,
    title: `${task.id} verified`, detail: findings.length ? `${findings.length} finding${findings.length === 1 ? '' : 's'}` : 'nothing found',
  })
  return getTask(task.id, root)
}

const VERIFY_DIFF_MAX_LINES = 2000
const VERIFY_SECTIONS = ['Goal', 'Scope', 'Acceptance criteria', 'Out of scope']

/**
 * What a reviewing agent needs to judge a finished task (R067): its Goal / Scope / Acceptance criteria / Out of scope,
 * the epic's Done when, the related spec, ranked conventions, and the commits that name the task with their diff.
 */
export async function getVerifyContext(taskId: string, root: string): Promise<string> {
  const task = await getTask(taskId, root)
  const raw = task.raw ?? ''
  const sections = VERIFY_SECTIONS.map(h => ({ heading: h, body: taskSection(raw, h) })).filter(x => x.body)
  // "**Out of scope:**" is usually a line inside Scope, not its own section
  const { items } = await listRoadmap(root)
  const epicId = /^(R\d+)/.exec(task.phase ?? '')?.[1]
  const epic = items.find(i => i.id === epicId) ?? items.find(i => i.tasks.includes(task.id))
  const conventions = (await listEntries(root)).filter(e => e.type === 'convention')
  const hits = rankEntries(conventions, taskQuery(task), { limit: 5 }).filter(h => h.score >= RELATED_MIN_SCORE)
  let commits: { sha: string; subject: string }[] = []
  let diff = ''
  let diffCut = 0
  let head: string | null = null
  try {
    head = (await git(['rev-parse', '--short', 'HEAD'], root)).trim() || null
    // ids are whole words in commit subjects: "(T156)", "T156:"; -F so the id is never a regex
    commits = (await git(['log', '-F', `--grep=${task.id}`, '--format=%H%x1f%s'], root))
      .split('\n').filter(Boolean).map(l => { const [sha, subject] = l.split('\x1f'); return { sha, subject } })
      .filter(c => new RegExp(`\\b${task.id}\\b`).test(c.subject))
    if (commits.length) {
      const lines: string[] = []
      for (const c of [...commits].reverse()) {
        lines.push(...(await git(['show', '--format=commit %h %s', '--patch', c.sha], root)).split('\n'))
      }
      diffCut = Math.max(0, lines.length - VERIFY_DIFF_MAX_LINES)
      diff = lines.slice(0, VERIFY_DIFF_MAX_LINES).join('\n')
    }
  } catch (e) {
    console.warn(`verify context: git unavailable for ${task.id}`, e instanceof Error ? e.message : e)
  }
  return formatVerifyContext({
    taskId: task.id, title: task.title, sections,
    doneWhen: epic ? /\*\*Done when:\*\*\s*(.+)/.exec(epic.body)?.[1].trim() ?? '' : '',
    relatedSpec: await relatedSpecs(task, root),
    specChanges: epic?.specChanges ?? [],
    covers: task.covers,
    conventions: hits.map(h => ({ id: h.id, summary: h.summary })),
    commits, diff, diffCut, head,
  })
}

/** The task isn't in the state an action needs (e.g. approving a task that isn't in review). Routes map it to 409. */
export class TaskStateError extends Error {}

async function reviewTask(taskId: string, outcome: ReviewOutcome, note: string, next: TaskStatus, root: string, auto = false) {
  const task = await getTask(taskId, root)
  const allowed = REVIEWABLE[outcome]
  if (!allowed.includes(task.status)) {
    throw new TaskStateError(`${task.id} is ${task.status}; ${outcome === 'approved' ? 'approve' : 'send back'} needs ${allowed.join(' or ')}`)
  }
  const at = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
  const content = appendReviewEntry(task.raw ?? '', outcome, note, at, auto)
  await fs.writeFile(path.join(root, task.file), content, 'utf8')
  return updateTaskStatus(task.id, next, root, 'human')
}

/** R062: the decision was made from this kept run; null when there is none (unknown runId → RangeError). */
async function reviewedRun(taskId: string, runId: string | null | undefined, root: string): Promise<RunManifest | null> {
  if (!runId) return null
  const run = (await listRuns(taskId, root)).find(r => r.runId === runId)
  if (!run) throw new RangeError(`No kept run ${runId} for ${taskId}`)
  return run
}

/**
 * Review → done, with an `approved` entry in the task's `## Review` section. R062: with `runId`, the entry
 * names the run and "All N steps reviewed".
 */
export async function approveTask(taskId: string, root: string, note = '', opts: { runId?: string | null } = {}) {
  const run = await reviewedRun(taskId.toUpperCase(), opts.runId, root)
  return reviewTask(taskId, 'approved', run ? formatReviewBody(note, run.runId, [], run.steps.length) : note, 'done', root)
}

/**
 * Review or done → todo (so vibedoc_next_task hands it out again), with the note as a `changes requested` entry.
 * R062: `marks` (flagged steps) and `runId` go first in the entry; a note or at least one mark is required.
 */
export async function sendBackTask(taskId: string, note: string, root: string, opts: { runId?: string | null; marks?: ReviewMark[]; auto?: boolean } = {}) {
  const run = await reviewedRun(taskId.toUpperCase(), opts.runId, root)
  return reviewTask(taskId, 'changes requested', formatReviewBody(note, run?.runId ?? null, opts.marks ?? []), 'todo', root, opts.auto)
}

/**
 * R065: a failed Run goes back to the agent on its own. When `tests.autoSendBack` is on (default) and the task is
 * done or in review (an agent isn't on it), the task's newest run since `since` becomes a `(auto)` changes-requested
 * entry: its run id, one ❌ mark per failed step (error + screenshot), "Auto: run failed (n of m steps)". Null = no
 * send back (setting off, another status, no such run, or the run didn't fail).
 */
export async function sendBackFailedRun(taskId: string, root: string, since: string) {
  const [task, settings] = await Promise.all([getTask(taskId, root), readProjectSettings(root)])
  if (!settings.autoSendBack || !REVIEWABLE['changes requested'].includes(task.status)) return null
  const run = (await listRuns(task.id, root))[0]
  if (!run || run.startedAt < since || run.status !== 'failed') return null
  const tests = task.raw ? parseManualTests(task.raw) : null
  const failed = run.steps.filter(s => s.status === 'failed').length
  const marks = failedMarksForRun(tests?.items ?? [], run)
  // R065: the agent already had maxAutoFixes tries in a row: this failure goes to a human (review) instead
  const streak = autoFixStreak(task.raw ?? '')
  if (streak >= settings.maxAutoFixes) {
    const at = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
    const body = formatReviewBody(`The agent couldn't fix this in ${streak} automatic attempts. A human decides: fix it, change the test, or send it back with a note.`, run.runId, marks)
    await fs.writeFile(path.join(root, task.file), appendReviewEntry(task.raw ?? '', 'auto fix limit reached', body, at, false, streak), 'utf8')
    return updateTaskStatus(task.id, 'review', root, 'human')
  }
  return sendBackTask(task.id, `Auto: run failed (${failed} of ${run.steps.length} steps)`, root, { runId: run.runId, marks, auto: true })
}

/**
 * R065: what every finished Run (single or suite) does to its task, in order: the result into the checklist
 * (recordRunResult), then a failed one goes back to the agent or, past the cap, to a human (sendBackFailedRun),
 * and a pass after automatic send-backs ends that streak (noteAutoRunPassed). Each piece that changed the task is
 * returned so the route can emit `task_updated` for it.
 */
export async function handleRunEnd(taskId: string, result: 'passed' | 'failed', steps: { name: string; status: string }[] | null, root: string, since: string) {
  const recorded = await recordRunResult(taskId, result, steps, root, since)
  const back = result === 'failed' ? await sendBackFailedRun(taskId, root, since) : null
  const reset = result === 'passed' ? await noteAutoRunPassed(taskId, root) : null
  return { recorded: recorded?.task ?? null, back, reset }
}

/**
 * R065: a Run passed while the task's last entry is an automatic send-back: say so in ## Review, which ends the
 * auto-fix streak. Null when there was nothing to end.
 */
export async function noteAutoRunPassed(taskId: string, root: string): Promise<Task | null> {
  const task = await getTask(taskId, root)
  const last = task.raw ? latestReview(task.raw) : null
  if (!last || last.outcome !== 'changes requested' || !last.auto) return null
  const at = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
  await fs.writeFile(path.join(root, task.file), appendReviewEntry(task.raw ?? '', 'auto run passed', '', at), 'utf8')
  return getTask(task.id, root)
}

/** Tick or untick every manual item of one task (🤖 ones untouched). `changed` = the indexes flipped, for Undo. */
export async function setAllManualTestsChecked(taskId: string, checked: boolean, root: string): Promise<{ task: Task; changed: number[] }> {
  const task = await getTask(taskId, root)
  const { raw, changed } = setAllManualTests(task.raw ?? '', checked)
  if (changed.length) await fs.writeFile(path.join(root, task.file), raw, 'utf8')
  return { task: changed.length ? await getTask(task.id, root) : task, changed }
}

/**
 * R061: a finished Run from VibeDoc, written back like an agent's run: the header's `Auto: <result> <today>`, 🤖 items
 * whose step passed ticked and those whose step failed unticked (ticksForRun). One write. Null = no checklist.
 * R063: steps are judged with the task's newest kept run (assertion counts + its blank-app check; only a run that
 * started at or after `since`): an unverified step proves nothing, its item is unticked and the header counts it.
 * `steps: null` = take the newest run's own steps (an agent's `autoResult`). `unverified` = those steps' names.
 */
export async function recordRunResult(taskId: string, result: 'passed' | 'failed', steps: { name: string; status: string }[] | null, root: string, since?: string):
  Promise<{ task: Task; unverified: string[] } | null> {
  const task = await getTask(taskId, root)
  const tests = task.raw ? parseManualTests(task.raw) : null
  if (!tests || !task.raw) return null
  const newest = (await listRuns(task.id, root))[0]
  const run = newest && (!since || newest.startedAt >= since) ? newest : null
  const verdicts = new Map(run?.steps.map(s => [s.name, runVerdict(s, run)]) ?? [])
  const judged = (steps ?? run?.steps ?? []).map(s => ({ ...s, unverified: verdicts.get(s.name) ?? [] }))
  const unverified = judged.filter(s => s.status === 'passed' && s.unverified.length).map(s => s.name)
  const { tick, untick } = ticksForRun(tests.items, judged)
  let raw = setManualTestsChecked(setManualTestsChecked(task.raw, tick, true), untick, false)
  const flaky = run?.flaky ?? 0 // R065: tests that passed only on a retry
  raw = setManualTestsMeta(raw, { autoRun: { result, date: localToday(), ...(unverified.length ? { unverified: unverified.length } : {}), ...(flaky ? { flaky } : {}) } }, 'human', localToday())
  if (raw !== task.raw) await fs.writeFile(path.join(root, task.file), raw, 'utf8')
  return { task: await getTask(task.id, root), unverified }
}

/** Tick or untick one manual test item (index in file order). Never changes the task status. Throws RangeError for a bad index. */
export async function setManualTestChecked(taskId: string, index: number, checked: boolean, root: string): Promise<Task> {
  const task = await getTask(taskId, root)
  const content = toggleManualTest(task.raw ?? '', index, checked)
  if (content !== task.raw) await fs.writeFile(path.join(root, task.file), content, 'utf8')
  return getTask(task.id, root)
}

// ponytail: in-process mutex so two agents never claim the same task; separate from the roadmap lock.
// Doesn't cover a second VibeDoc process on the same root.
let taskClaimLock: Promise<unknown> = Promise.resolve()
function withTaskClaimLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = taskClaimLock.then(fn, fn)
  taskClaimLock = run.catch(() => {})
  return run
}

/** Atomically pick the next ready task of an epic and move it to in-progress. */
export function claimNextTask(
  epicId: string, root: string, agent?: string
): Promise<{ result: QueueResult; task?: Task; previousStatus?: TaskStatus }> {
  return withTaskClaimLock(async () => {
    const epic = await getRoadmapItem(epicId, root)
    if (!epic.parent) throw new Error(`${epic.id} is a horizon; pass an epic id`)
    const { tasks } = await listTasks(root)
    // A review holds its dependents only when something failed: its last run, or the auto-fix limit (R065)
    const queue = tasks.map(t => ({
      ...t,
      reviewHold: t.status === 'review' && (t.lastRun?.status === 'failed' || t.manualTests?.autoRun?.result === 'failed' ||
        (!!t.raw && latestReview(t.raw)?.outcome === 'auto fix limit reached')),
    }))
    const result = pickNextTask(epic, queue)
    if (result.kind !== 'ready') return { result }
    const { task, previousStatus } = await updateTaskStatus(result.taskId, 'in-progress', root, 'ai', { actor: 'ai', agent })
    return { result, task, previousStatus }
  })
}

export interface CreateTaskParams {
  title: string
  phase?: string
  size?: string
  description?: string
  dependsOn?: string
  due?: string
  covers?: string[]     // R068: **Covers:** scenario ids of the task's epic
  body?: string         // replaces the template sections below the meta block
}

/** Serialized with next_task claims and plan applies, so concurrent creates never pick the same id. */
export function createTask(params: CreateTaskParams, root: string, actor: 'ai' | 'human' = 'human'): Promise<Task> {
  return withTaskClaimLock(() => createTaskUnlocked(params, root, actor))
}

/** Caller must hold withTaskClaimLock (applyPlan does). */
async function createTaskUnlocked(params: CreateTaskParams, root: string, actor: 'ai' | 'human'): Promise<Task> {
  const { tasks } = await listTasks(root)
  // One line only: a newline in the title would inject **Key:** lines into the meta block
  const title = params.title.replace(/\s+/g, ' ').trim()

  const ids = tasks
    .map(t => parseInt(t.id.replace(/^T/i, ''), 10))
    .filter(n => !isNaN(n))
  const nextNum = ids.length > 0 ? Math.max(...ids) + 1 : 1
  const id = `T${String(nextNum).padStart(3, '0')}`

  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'task'

  const filename = `${id}-${slug}.md`
  const tasksDir = path.join(root, 'plans', 'tasks')
  await fs.mkdir(tasksDir, { recursive: true })
  const filePath = path.join(tasksDir, filename)

  let due = params.due ? parseDue(params.due) : null
  if (params.due && !due) throw new RoadmapError(`due must be a date YYYY-MM-DD (got ${JSON.stringify(params.due)})`)
  // A new task in an epic with a deadline takes the epic's due (R055)
  const epicId = params.phase?.trim().match(/^(R\d+)\b/i)?.[1]
  if (!due && epicId) due = (await getRoadmapItem(epicId, root).catch(() => null))?.due ?? null

  const meta = `# ${id}: ${title}
**Status:** 📋 Ready
**Phase:** ${params.phase || '—'}
**Size:** ${params.size || '—'}
**Depends on:** ${params.dependsOn || '—'}
${due ? `**Due:** ${due}\n` : ''}${params.covers?.length ? `**Covers:** ${params.covers.join(', ')}\n` : ''}`
  const content = params.body !== undefined ? `${meta}\n${params.body.trim()}\n` : `${meta}
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
  // logged so the graph's Recent (touchedPaths) and the activity feed see new tasks
  await appendActivity(root, { type: 'task_updated', actor, title: `${id} created`, detail: title, taskId: id })
  return getTask(id, root)
}

/** Validate against the current files, then keep the selected keys. Throws RoadmapError on any problem. */
function checkPlan(plan: unknown, selected: unknown, items: RoadmapItem[], taskIds: string[]): Plan {
  const errors = validatePlan(plan, { roadmap: items, taskIds, scenarioIds: body => parseScenarios(body).map(sc => sc.id) })
  if (errors.length > 0) throw new RoadmapError(errors.join('\n'))
  if (!Array.isArray(selected)) throw new RoadmapError('selected must be an array of plan keys')
  const { plan: sel, errors: selErrors } = selectPlan(plan as Plan, selected.map(String))
  if (selErrors.length > 0) throw new RoadmapError(selErrors.join('\n'))
  return sel
}

/**
 * Write the selected items of a plan. Validates again against the current files.
 * breakdown: plan keys become real T ids in order (so `dependsOn` keys are written as those ids) and are
 * linked to the epic (an existing one, or `newEpic` created first; neither = loose tasks, no Phase); runs under the task-claim lock so ids can't collide with next_task or another apply.
 * roadmap: horizons first (keys → R ids), then epics under their resolved parent; order and status use
 * createRoadmapItem's defaults (after the last sibling, step 10; planned). Runs under the roadmap lock.
 * `epic` is the breakdown's epic, null for a roadmap plan or loose tasks.
 */
export function applyPlan(
  plan: unknown, selected: unknown, root: string, actor: 'ai' | 'human' = 'human'
): Promise<{ created: { key: string; id: string; file: string }[]; epic: RoadmapItem | null }> {
  if ((plan as { kind?: unknown } | null)?.kind === 'roadmap') {
    return withRoadmapLock(async () => {
      const [items, { tasks }] = await Promise.all([readRoadmapFiles(root), listTasks(root)])
      const sel = checkPlan(plan, selected, items.map(f => f.item), tasks.map(t => t.id))
      if (sel.kind !== 'roadmap') throw new RoadmapError('expected a roadmap plan')
      const ids = new Map<string, string>()
      const created: { key: string; id: string; file: string }[] = []
      // ponytail: not atomic; a failure mid-way leaves the items written so far (each is a valid item).
      for (const h of sel.horizons) {
        const item = await createRoadmapItemUnlocked({ title: h.title.trim(), body: h.body }, root, actor)
        ids.set(h.key.trim(), item.id)
        created.push({ key: h.key, id: item.id, file: item.file })
      }
      for (const e of sel.epics) {
        const parent = ids.get(e.parent.trim()) ?? e.parent.trim().toUpperCase()
        const item = await createRoadmapItemUnlocked({ title: e.title.trim(), parent, status: e.status, body: e.body }, root, actor)
        created.push({ key: e.key, id: item.id, file: item.file })
      }
      return { created, epic: null }
    })
  }
  return withTaskClaimLock(async () => {
    const [{ items }, { tasks }] = await Promise.all([listRoadmap(root), listTasks(root)])
    const sel = checkPlan(plan, selected, items, tasks.map(t => t.id))
    if (sel.kind !== 'breakdown') throw new RoadmapError('expected a breakdown plan')

    // Roadmap lock inside the task lock: same order as updateRoadmapItem below.
    // ponytail: not atomic; a failure after the new epic is written leaves it with no tasks.
    const epic = sel.epic?.trim() ? await getRoadmapItem(sel.epic, root)
      : sel.newEpic ? await createRoadmapItem({
        title: sel.newEpic.title.trim(), parent: sel.newEpic.parent.trim().toUpperCase(), body: sel.newEpic.body,
      }, root, actor)
      : null
    const ids = new Map<string, string>()
    const created: { key: string; id: string; file: string }[] = []
    for (const t of sel.tasks) {
      const deps = (t.dependsOn ?? []).map(d => ids.get(d.trim()) ?? d.trim().toUpperCase())
      const covers = parseCovers((t.covers ?? []).join(','))
      const task = await createTaskUnlocked({
        title: t.title.trim(),
        phase: epic ? `${epic.id} — ${epic.title}` : undefined,
        size: t.size,
        dependsOn: deps.join(', ') || undefined,
        due: t.due,
        covers,
        body: t.body,
      }, root, actor)
      // R068: the covered scenarios become the task's first test checklist (an agent's report replaces it later)
      const seed = epic && covers.length ? seedSteps(epic.scenarios, covers) : ''
      if (seed) await saveManualTests(task.id, seed, root, actor)
      ids.set(t.key.trim(), task.id)
      created.push({ key: t.key, id: task.id, file: task.file })
    }

    if (!epic) return { created, epic: null }
    const fresh = await getRoadmapItem(epic.id, root)
    const updated = await updateRoadmapItem(epic.id, { tasks: [...fresh.tasks, ...created.map(c => c.id)] }, root, actor, false)
    return { created, epic: updated }
  })
}


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

export type { MemoryParams } from './memory-sections'
export type { FrontendApp, FrontendAuth, FrontendOverride, PlaywrightStatus } from './frontend'

export async function readMemory(root: string): Promise<{ content: string; exists: boolean }> {
  try {
    const content = await fs.readFile(path.join(root, 'memory', 'MEMORY.md'), 'utf8')
    return { content, exists: true }
  } catch {
    return { content: '*(No MEMORY.md found — AI will create one at end of session)*', exists: false }
  }
}

/** Rewrites only the sections passed (R045); throws "Nothing to update: …" when no known field is given. */
export async function updateMemory(params: MemoryParams, root: string, actor: 'ai' | 'human' = 'human'): Promise<void> {
  const now = new Date()
  const stamp = `${now.toISOString().split('T')[0]} at ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
  const file = path.join(root, 'memory', 'MEMORY.md')
  const current = await fs.readFile(file, 'utf8').catch(() => '')
  const content = mergeMemory(current, params, stamp)

  await snapshotMemory(root, actor, 'update')
  await fs.mkdir(path.join(root, 'memory'), { recursive: true })
  await fs.writeFile(file, content, 'utf8')

  const keys = passedKeys(params)
  await appendActivity(root, {
    type: 'memory_updated', actor,
    title: 'Session memory updated',
    detail: params.handoff != null
      ? String(params.handoff).slice(0, 120)
      : `Updated: ${SECTIONS.filter(([k]) => keys.includes(k)).map(([, h]) => h).join(', ')}`,
  })
}

// ─── Memory history (R045) ────────────────────────────────────────────────────

const MEMORY_HISTORY_DIR = path.join('.vibedoc', 'memory-history')
const MEMORY_HISTORY_KEEP = 20
const SNAPSHOT_ID = /^\d{8}T\d{9}Z-[\w:-]+$/
const SNAPSHOT_HEADER = /^<!-- vibedoc-snapshot actor=(\S*) reason=(\S*) -->\r?\n/

export type MemoryVersion = { id: string; at: string; actor: string; reason: string; bytes: number; excerpt: string }

/** `20261003T154209123Z-ai` → `2026-10-03T15:42:09.123Z` */
const snapshotAt = (id: string) => id.replace(/^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)(\d{3})Z.*$/, '$1-$2-$3T$4:$5:$6.$7Z')

/**
 * Copies the current MEMORY.md (if any) to .vibedoc/memory-history/<stamp>-<actor>.md, keeping the 20 newest.
 * ponytail: no lock — two concurrent writes can both snapshot the same base; add withMemoryLock if that matters.
 */
async function snapshotMemory(root: string, actor: 'ai' | 'human', reason: 'update' | 'restore'): Promise<string | null> {
  const current = await fs.readFile(path.join(root, 'memory', 'MEMORY.md'), 'utf8').catch(() => null)
  if (current === null) return null
  const dir = path.join(root, MEMORY_HISTORY_DIR)
  await fs.mkdir(dir, { recursive: true })
  const who = actor === 'ai' ? 'ai' : 'human'
  const body = `<!-- vibedoc-snapshot actor=${who} reason=${reason} -->\n${current}`
  // same-millisecond writes: step the stamp forward instead of overwriting a snapshot
  let id = ''
  for (let t = Date.now(); ; t++) {
    id = `${new Date(t).toISOString().replace(/[-:.]/g, '')}-${who}`
    try {
      await fs.writeFile(path.join(dir, `${id}.md`), body, { encoding: 'utf8', flag: 'wx' })
      break
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e
    }
  }
  const ids = await snapshotIds(root)
  await Promise.all(ids.slice(MEMORY_HISTORY_KEEP).map(old => fs.rm(path.join(dir, `${old}.md`), { force: true })))
  return id
}

/** Snapshot ids, newest first (the stamp prefix sorts by time). */
async function snapshotIds(root: string): Promise<string[]> {
  const names = await fs.readdir(path.join(root, MEMORY_HISTORY_DIR)).catch(() => [] as string[])
  return names.filter(n => n.endsWith('.md')).map(n => n.slice(0, -3)).filter(id => SNAPSHOT_ID.test(id)).sort().reverse()
}

async function readSnapshot(id: string, root: string): Promise<{ actor: string; reason: string; content: string } | null> {
  if (!SNAPSHOT_ID.test(id)) throw new RoadmapError('Invalid version id')
  const raw = await fs.readFile(path.join(root, MEMORY_HISTORY_DIR, `${id}.md`), 'utf8').catch(() => null)
  if (raw === null) return null
  const h = SNAPSHOT_HEADER.exec(raw)
  return { actor: h?.[1] ?? '', reason: h?.[2] ?? '', content: h ? raw.slice(h[0].length) : raw }
}

/** Saved MEMORY.md versions, newest first; `excerpt` = first non-empty line of that version's handoff. */
export async function listMemoryVersions(root: string): Promise<MemoryVersion[]> {
  const out: MemoryVersion[] = []
  for (const id of await snapshotIds(root)) {
    const snap = await readSnapshot(id, root)
    if (!snap) continue
    const handoff = parseMemory(snap.content).sections.find(s => s.heading.trim().toLowerCase() === 'handoff for next session')
    const excerpt = handoff?.body.split(/\r?\n/).map(l => l.trim()).find(Boolean) ?? ''
    out.push({ id, at: snapshotAt(id), actor: snap.actor, reason: snap.reason, bytes: Buffer.byteLength(snap.content), excerpt })
  }
  return out
}

/** A saved version's content (without the snapshot header); null when missing; RoadmapError on a malformed id. */
export async function getMemoryVersion(id: string, root: string): Promise<string | null> {
  return (await readSnapshot(id, root))?.content ?? null
}

/** Writes a saved version back to MEMORY.md, snapshotting the current file first (reason=restore) so it can be undone. */
export async function restoreMemoryVersion(id: string, root: string, actor: 'ai' | 'human' = 'human'): Promise<{ restoredFrom: string; newId: string | null }> {
  const content = await getMemoryVersion(id, root)
  if (content === null) throw new RoadmapError(`Version ${id} not found`, 404)
  const newId = await snapshotMemory(root, actor, 'restore')
  await fs.mkdir(path.join(root, 'memory'), { recursive: true })
  await fs.writeFile(path.join(root, 'memory', 'MEMORY.md'), content, 'utf8')
  const at = snapshotAt(id)
  await appendActivity(root, { type: 'memory_updated', actor, title: `Restored MEMORY.md from ${at}` })
  return { restoredFrom: at, newId }
}

// ─── Knowledge entries (R046) ─────────────────────────────────────────────────

const ENTRIES_DIR = path.join('memory', 'entries')

// ponytail: in-process mutex so two agents never get the same new id; doesn't cover a second VibeDoc process on the same root.
let entryLock: Promise<unknown> = Promise.resolve()
function withEntryLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = entryLock.then(fn, fn)
  entryLock = run.catch(() => {})
  return run
}

/** Every parseable `memory/entries/*.md`, sorted by id. Missing folder → []. */
export async function listEntries(root: string): Promise<Entry[]> {
  let names: string[]
  try {
    names = await fs.readdir(path.join(root, ENTRIES_DIR))
  } catch {
    return []
  }
  const entries = await Promise.all(names.filter(n => n.endsWith('.md')).map(async n => {
    const file = path.join(ENTRIES_DIR, n)
    return parseEntry(await fs.readFile(path.join(root, file), 'utf8'), file)
  }))
  return entries.filter((e): e is Entry => !!e).sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }))
}

export async function getEntry(id: string, root: string): Promise<Entry | null> {
  const norm = normalizeEntryId(id)
  return (await listEntries(root)).find(e => e.id === norm) ?? null
}

/**
 * Create (no id) or update (id) one entry. Throws with the validation message on bad input or an unknown id.
 * Stamps `**By:**`: "human", or "ai:<agent>" for an agent save (R047). An update without `source` keeps the old one (R052).
 * `log: false` skips the per-entry activity event (a batch import logs one event itself).
 */
export function saveEntry(input: EntryInput, root: string, actor: 'ai' | 'human' = 'human', agent?: string, log = true): Promise<Entry> {
  const error = validateEntryInput(input)
  if (error) return Promise.reject(new Error(error))
  return withEntryLock(async () => {
    const entries = await listEntries(root)
    let id: string
    let previous: Entry | undefined
    if (input.id !== undefined) {
      id = normalizeEntryId(String(input.id)) as string
      previous = entries.find(e => e.id === id)
      if (!previous) throw new Error(`Entry ${id} not found`)
    } else {
      id = nextEntryId(entries.map(e => e.id))
    }
    const summary = input.summary.trim()
    const entry: Entry = {
      id, type: input.type as EntryType, summary, body: (input.body ?? '').trim(),
      updatedAt: localToday(), by: actor === 'human' ? 'human' : parseOwner(`ai:${agent || 'agent'}`) ?? 'ai:agent',
      source: (typeof input.source === 'string' && input.source.trim()) || previous?.source,
      file: path.join(ENTRIES_DIR, `${id}-${entrySlug(summary)}.md`),
    }
    await fs.mkdir(path.join(root, ENTRIES_DIR), { recursive: true })
    await fs.writeFile(path.join(root, entry.file), formatEntry(entry), 'utf8')
    // Summary changed → new slug; the id stays
    if (previous && previous.file !== entry.file) await fs.rm(path.join(root, previous.file), { force: true })
    if (log) await appendActivity(root, { type: 'memory_updated', actor, title: `Entry ${id} saved`, detail: summary })
    return entry
  })
}

/**
 * `<config>/projects/<slug>/memory`, config = $CLAUDE_CONFIG_DIR or ~/.claude. Fixed: callers can't pass a path (R052).
 * The slug comes from the real path, like Claude Code's (macOS /tmp → /private/tmp, symlinked folders).
 */
export async function claudeMemoryDir(root: string): Promise<string> {
  const config = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude')
  const real = await fs.realpath(root).catch(() => path.resolve(root))
  return path.join(config, 'projects', claudeProjectSlug(real), 'memory')
}

/** The project's Claude Code memories as entry candidates, read-only. Skips MEMORY.md (the index) and unparsable files; missing folder → []. */
export async function readClaudeMemory(root: string): Promise<ClaudeMemoryCandidate[]> {
  const dir = await claudeMemoryDir(root)
  let names: string[]
  try {
    names = await fs.readdir(dir)
  } catch {
    return []
  }
  const files = names.filter(n => n.endsWith('.md') && n !== 'MEMORY.md').sort()
  const parsed = await Promise.all(files.map(async n => parseClaudeMemory(await fs.readFile(path.join(dir, n), 'utf8').catch(() => ''), n)))
  return parsed.filter((c): c is ClaudeMemoryCandidate => !!c)
}

/**
 * Plan the import of the project's Claude Code memory (dedupe by `**Source:**`); with `apply`, write the new and
 * changed entries through saveEntry() (ids from its lock) and log one activity event. `dir` uses `~` for the home path.
 */
export async function importClaudeMemory(
  root: string, actor: 'ai' | 'human', apply: boolean, agent?: string,
): Promise<{ dir: string; found: number; plan: ImportPlan; written: number }> {
  const abs = await claudeMemoryDir(root)
  const home = os.homedir()
  const dir = abs === home || abs.startsWith(home + path.sep) ? '~' + abs.slice(home.length) : abs
  const candidates = await readClaudeMemory(root)
  const plan = planImport(candidates, await listEntries(root))
  let written = 0
  if (apply) {
    // ponytail: planned outside the entry lock, so a save racing the import can still slip in a duplicate source
    const toInput = (c: ClaudeMemoryCandidate, id?: string): EntryInput =>
      ({ id, type: c.type, summary: c.summary, body: c.body, source: CLAUDE_SOURCE_PREFIX + c.name })
    for (const c of plan.create) { await saveEntry(toInput(c), root, actor, agent, false); written++ }
    for (const u of plan.update) { await saveEntry(toInput(u.candidate, u.entry.id), root, actor, agent, false); written++ }
    if (written) await appendActivity(root, { type: 'memory_updated', actor, title: `Imported ${written} entries from Claude Code` })
  }
  return { dir, found: candidates.length, plan, written }
}

/**
 * Write the entries into the managed block of AGENTS.md (created when missing) and CLAUDE.md (only when it exists),
 * so agents that read those files see the same conventions (R052). A file is written only when its text changed.
 * Both files are checked before either is written, so a broken block (one marker) leaves both untouched.
 */
export async function exportEntries(root: string, actor: 'ai' | 'human'): Promise<{ count: number; files: { file: string; changed: boolean }[] }> {
  const entries = await listEntries(root)
  const block = renderEntriesBlock(entries)
  const plans: { file: string; before: string; after: string }[] = []
  for (const file of ['AGENTS.md', 'CLAUDE.md']) {
    const before = await fs.readFile(path.join(root, file), 'utf8').catch(() => null)
    if (before === null && file === 'CLAUDE.md') continue // creating CLAUDE.md changes how Claude Code treats the project
    const res = upsertManagedBlock(before ?? '', block)
    if ('error' in res) throw new RoadmapError(`${file}: ${res.error}`)
    plans.push({ file, before: before ?? '', after: res.text })
  }
  for (const p of plans) {
    if (p.after === p.before) continue
    await fs.writeFile(path.join(root, p.file), p.after, 'utf8')
    await appendActivity(root, { type: 'doc_updated', actor, title: `Exported memory to ${p.file}`, detail: p.file })
  }
  return { count: entries.length, files: plans.map(p => ({ file: p.file, changed: p.after !== p.before })) }
}

/** Entries in the order of `ids` (any case / padding), plus the ids that matched nothing. */
export async function getEntriesByIds(ids: string[], root: string): Promise<{ found: Entry[]; missing: string[] }> {
  const byId = new Map((await listEntries(root)).map(e => [e.id, e]))
  const found: Entry[] = []
  const missing: string[] = []
  for (const raw of ids) {
    const entry = byId.get(normalizeEntryId(String(raw)) ?? '')
    if (entry) found.push(entry)
    else missing.push(String(raw))
  }
  return { found, missing }
}

const RECALL_LOG_FILE = path.join('memory', '.recall-log.json')

/** `memory/.recall-log.json` (entry id → YYYY-MM-DD last fetched by vibedoc_get_entries); missing or invalid → {}. */
export async function readRecallLog(root: string): Promise<RecallLog> {
  try {
    const d = JSON.parse(await fs.readFile(path.join(root, RECALL_LOG_FILE), 'utf-8')) as unknown
    if (d && typeof d === 'object' && !Array.isArray(d)) {
      return Object.fromEntries(Object.entries(d).filter((kv): kv is [string, string] => typeof kv[1] === 'string'))
    }
  } catch { /* missing or unreadable → never recalled */ }
  return {}
}

const writeRecallLog = async (root: string, log: RecallLog) => {
  const file = path.join(root, RECALL_LOG_FILE)
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, JSON.stringify(log, null, 2) + '\n', 'utf-8')
}

/** Drop deleted ids from the recall log so it doesn't fill up with dead ids; restore/undo don't re-add them. Call inside withEntryLock. */
const dropFromRecallLog = async (root: string, ids: string[]) => {
  const log = await readRecallLog(root)
  if (!ids.some(id => id in log)) return
  for (const id of ids) delete log[id]
  await writeRecallLog(root, sortedLog(log))
}

/** Stamp today on each id (R051). Writes only when a date changes, so at most once per id per day. Returns whether it wrote. */
export function markEntriesRecalled(ids: string[], root: string): Promise<boolean> {
  if (!ids.length || isDemo()) return Promise.resolve(false)
  return withEntryLock(async () => {
    const next = markRecalled(await readRecallLog(root), ids, localToday())
    if (next) await writeRecallLog(root, next)
    return !!next
  })
}

/**
 * What an agent reads at session start: MEMORY.md + the newest episode newer than it (R050) + the entry index,
 * capped at `memory.sessionBudgetTokens` (R048).
 */
export async function sessionStartMemory(root: string): Promise<string> {
  const [memory, entries, { sessionBudgetTokens }, fresh] = await Promise.all([
    readMemory(root), listEntries(root), readProjectSettings(root), episodesSinceHandoff(root),
  ])
  const episode = fresh.length ? formatEpisodeSection(fresh[0], fresh.length - 1) : ''
  // R051: warnings sit directly under the handoff, so the budget never cuts them
  const warnings = memory.exists ? formatHealthWarnings(await getMemoryHealth(root)) : ''
  const handoff = warnings ? `${memory.content.trimEnd()}\n\n${warnings}\n` : memory.content
  return fitToBudget(handoff, indexHits(entries), sessionBudgetTokens, episode).text
}

/** The "## Related memory" block for a task (up to `limit` strong keyword matches), or '' (R048). */
export async function relatedEntries(task: Pick<Task, 'title' | 'phase' | 'raw'>, root: string, limit = 3): Promise<string> {
  // rank everything so the score filter in formatRelated sees all candidates before the limit
  const entries = await listEntries(root)
  return formatRelated(rankEntries(entries, taskQuery(task), { limit: entries.length }), limit)
}

// ─── Capability specs (R066) ──────────────────────────────────────────────────

/** Every `docs/specs/<capability>.md`, parsed. */
export async function listSpecs(root: string): Promise<Spec[]> {
  // ponytail: reads every spec file per call (a handful per project); reuse the doc graph's mtime cache if they grow
  const files = (await glob('docs/specs/*.md', { cwd: root, nodir: true })).map(f => f.replace(/\\/g, '/')).sort()
  const specs = await Promise.all(files.map(async f => {
    try {
      return parseSpec(f, await fs.readFile(path.join(root, f), 'utf8'))
    } catch (e) {
      console.warn(`specs: skipped ${f}`, e)
      return null
    }
  }))
  return specs.filter((s): s is Spec => !!s)
}

/** One spec by capability slug, with its raw file; null when there is no `docs/specs/<capability>.md`. */
export async function readSpec(capability: string, root: string): Promise<{ path: string; raw: string; spec: Spec } | null> {
  const slug = capability.trim().toLowerCase().replace(/^docs\/specs\//, '').replace(/\.md$/, '')
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(slug)) return null
  const rel = `docs/specs/${slug}.md`
  try {
    const raw = await fs.readFile(path.join(root, rel), 'utf8')
    return { path: rel, raw, spec: parseSpec(rel, raw) }
  } catch {
    return null
  }
}

const SPEC_CONTEXT_BUDGET = 6000
const SPEC_CONTEXT_EPICS = 5
const SPEC_CONTEXT_DOCS = 6
const SPEC_CONTEXT_ENTRIES = 8

/**
 * What the project already says about a capability, for an agent drafting its spec (R066): the given epics (else
 * keyword-matched ones) with their done tasks' Goal + Acceptance criteria, related docs, entries and the existing
 * spec. Read-only: the agent proposes the draft with vibedoc_propose_edit.
 */
export async function getSpecContext(
  capability: string, root: string, opts: { epics?: string[]; query?: string } = {},
): Promise<string> {
  const slug = capability.trim().toLowerCase().replace(/^docs\/specs\//, '').replace(/\.md$/, '')
  const words = (opts.query?.trim() || slug.replace(/[-_.]+/g, ' ')).trim()
  const [{ items }, { tasks }, entries, existing] = await Promise.all([
    listRoadmap(root), listTasks(root), listEntries(root), readSpec(slug, root),
  ])
  let epics: RoadmapItem[]
  if (opts.epics?.length) {
    const ids = opts.epics.map(normalizeRoadmapId)
    epics = ids.map(id => items.find(i => i.id === id)).filter((i): i is RoadmapItem => !!i)
  } else {
    const asEntries: RecallEntry[] = items.filter(i => i.parent).map(i => ({ id: i.id, type: 'epic', summary: i.title, body: i.body, updatedAt: '' }))
    const hits = rankEntries(asEntries, words, { limit: SPEC_CONTEXT_EPICS }).filter(h => h.score >= RELATED_MIN_SCORE)
    epics = hits.map(h => items.find(i => i.id === h.id)).filter((i): i is RoadmapItem => !!i)
  }
  const byId = new Map(tasks.map(t => [t.id, t]))
  const ctxEpics: SpecContextEpic[] = epics.map(e => ({
    id: e.id, title: e.title,
    doneWhen: /\*\*Done when:\*\*\s*(.+)/.exec(e.body)?.[1].trim() ?? '',
    tasks: e.tasks.map(id => byId.get(id)).filter((t): t is Task => !!t && t.status === 'done').map(t => ({
      id: t.id, title: t.title, finished: t.finished ?? null,
      goal: taskSection(t.raw ?? '', 'Goal'), acceptance: taskSection(t.raw ?? '', 'Acceptance criteria'),
    })),
  }))
  // docs only: tasks, epics and entries come in their own sections
  const docs = (await searchDocs(words, root))
    .filter(r => !/^(?:plans\/|memory\/|docs\/specs\/)/.test(r.file))
    .slice(0, SPEC_CONTEXT_DOCS)
    .map(r => ({ path: r.file, lines: r.hits.slice(0, 2).map(h => h.text) }))
  const related = rankEntries(entries, words, { limit: SPEC_CONTEXT_ENTRIES }).filter(h => h.score >= RELATED_MIN_SCORE)
  return formatSpecContext({
    capability: slug, epics: ctxEpics, docs,
    entries: related.map(h => ({ id: h.id, type: h.type, summary: h.summary })),
    existing: existing?.raw ?? null,
  }, SPEC_CONTEXT_BUDGET)
}

export type SpecMergePreview = { capability: string; path: string; before: string; after: string; isNew: boolean; errors: string[] }

/** What merging an epic's `## Spec changes` would do to each capability spec (R069). Read-only. */
export async function previewSpecMerge(epicId: string, root: string): Promise<{ epic: RoadmapItem; merges: SpecMergePreview[] }> {
  const epic = await getRoadmapItem(epicId, root)
  const merges = await Promise.all(parseSpecChanges(epic.body).map(async (c): Promise<SpecMergePreview> => {
    const path = `docs/specs/${c.capability}.md`
    const valid = /^[a-z0-9][a-z0-9._-]*$/.test(c.capability)
    const existing = valid ? await readSpec(c.capability, root) : null
    const { raw, errors } = applyDelta(existing?.raw ?? null, c.ops, c.capability)
    return {
      capability: c.capability, path, before: existing?.raw ?? '', after: raw, isNew: !existing,
      errors: valid ? errors : [`"${c.capability}" is not a capability slug (docs/specs/<slug>.md)`],
    }
  }))
  return { epic, merges }
}

/**
 * Write an epic's spec changes into the capability specs and stamp `**Spec merged:**` (R069). Recomputed from the
 * files on disk, never from the client's text; refused when the epic isn't done, is already merged, has no spec
 * changes, or any capability has an error (nothing is written then).
 */
export async function applySpecMerge(epicId: string, root: string, actor: 'ai' | 'human' = 'human'): Promise<{ epic: RoadmapItem; paths: string[] }> {
  const { epic, merges } = await previewSpecMerge(epicId, root)
  if (epic.status !== 'done') throw new RoadmapError(`${epic.id} is ${epic.status}; merge its spec changes once it is done`, 409)
  if (epic.specMerged) throw new RoadmapError(`${epic.id}'s spec changes were already merged on ${epic.specMerged}`, 409)
  if (!merges.length) throw new RoadmapError(`${epic.id} has no ## Spec changes`)
  const errors = merges.flatMap(m => m.errors.map(e => `${m.path}: ${e}`))
  if (errors.length) throw new RoadmapError(errors.join('\n'))
  // ponytail: not atomic; a failed write mid-way leaves earlier specs merged and the epic unstamped (re-merging reports their ADDED ops as errors)
  for (const m of merges) await writeDoc(m.path, m.after, root)
  const updated = await updateRoadmapItem(epic.id, { specMerged: localToday() }, root, actor, false)
  await appendActivity(root, { type: 'roadmap_updated', actor, title: `${epic.id} spec merged`, detail: merges.map(m => m.path).join(', ') })
  return { epic: updated, paths: merges.map(m => m.path) }
}

/**
 * The "## Related spec" block for a task, or ''. Its epic's `**Specs:**` → every requirement name of those specs;
 * none declared (or none of them exist) → the top `limit` requirements by keyword rank, strong matches only.
 */
export async function relatedSpecs(task: Pick<Task, 'id' | 'title' | 'phase' | 'raw'>, root: string, limit = 3): Promise<string> {
  const specs = await listSpecs(root)
  if (!specs.length) return ''
  const { items } = await listRoadmap(root)
  const epicId = /^(R\d+)/.exec(task.phase ?? '')?.[1]
  const epic = items.find(i => i.id === epicId) ?? items.find(i => i.tasks.includes(task.id))
  const declared = (epic?.specs ?? []).map(slug => specs.find(s => s.capability === slug)).filter((s): s is Spec => !!s)
  if (declared.length) {
    return formatRelatedSpecs(declared.map(s => ({ capability: s.capability, title: s.title, names: s.requirements.map(r => r.name) })))
  }
  const entries: RecallEntry[] = specs.flatMap(s => s.requirements.map(r => ({
    id: `${s.capability}#${r.name}`, type: 'spec', summary: r.name, updatedAt: '',
    body: [r.text, ...r.scenarios.map(sc => `${sc.name}\n${sc.text}`)].join('\n'),
  })))
  const hits = rankEntries(entries, taskQuery(task), { limit: entries.length }).filter(h => h.score >= RELATED_MIN_SCORE).slice(0, limit)
  const groups: RelatedSpecGroup[] = []
  for (const h of hits) {
    const capability = h.id.slice(0, h.id.indexOf('#'))
    let g = groups.find(x => x.capability === capability)
    if (!g) groups.push(g = { capability, title: specs.find(s => s.capability === capability)?.title ?? capability, names: [] })
    g.names.push(h.summary)
  }
  return formatRelatedSpecs(groups)
}

// ─── Memory health ────────────────────────────────────────────────────────────

/** A flag as the Cleanup panel sees it: `dismissed` is the YYYY-MM-DD it was dismissed on. */
export type CleanupFlag = HealthFlag & { dismissed?: string }

/**
 * Handoff/board contradictions, dangling ids in MEMORY.md and the entries, duplicate entries and entries not recalled lately (R051). Pure rules in src/lib/memory-health.ts.
 * Dismissed flags are left out unless `includeDismissed` (the panel's "Show dismissed").
 */
export async function getMemoryHealth(root: string, opts: { includeDismissed?: boolean } = {}): Promise<CleanupFlag[]> {
  const [memory, entries, { tasks }, { items }, { dismissed }, recallLog] = await Promise.all([
    readMemory(root), listEntries(root), listTasks(root), listRoadmap(root), readCleanupState(root), readRecallLog(root),
  ])
  const board = [...tasks, ...items].map(({ id, status }) => ({ id, status }))
  // files that may still name a merged or deleted entry; MEMORY.md is checked as the handoff
  const others = entries.length
    ? (await memoryGraphFiles(root)).filter(f => f.path !== 'memory/MEMORY.md').map(f => ({ id: f.id, text: f.text }))
    : []
  const flags = [
    ...findContradictions(memory.exists ? memory.content : '', entries, board, t => extractRefs(t).ids, others),
    ...findDuplicates(entries, tokenize),
    ...findStale(entries, recallLog, localToday()),
  ]
  return opts.includeDismissed
    ? flags.map(f => (dismissed[f.id] ? { ...f, dismissed: dismissed[f.id] } : f))
    : flags.filter(f => !dismissed[f.id])
}

const CLEANUP_FILE = path.join('memory', '.cleanup.json')

/** `memory/.cleanup.json`; a missing or invalid file is an empty state. */
export async function readCleanupState(root: string): Promise<{ dismissed: Record<string, string> }> {
  try {
    const d = (JSON.parse(await fs.readFile(path.join(root, CLEANUP_FILE), 'utf-8')) as { dismissed?: unknown })?.dismissed
    if (d && typeof d === 'object' && !Array.isArray(d)) {
      return { dismissed: Object.fromEntries(Object.entries(d).filter((kv): kv is [string, string] => typeof kv[1] === 'string')) }
    }
  } catch { /* missing or unreadable → nothing dismissed */ }
  return { dismissed: {} }
}

// ponytail: in-process mutex like withEntryLock, so parallel dismisses don't drop ids; doesn't cover a second VibeDoc process.
let cleanupLock: Promise<unknown> = Promise.resolve()
function withCleanupLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = cleanupLock.then(fn, fn)
  cleanupLock = run.catch(() => {})
  return run
}

const writeCleanupState = async (root: string, dismissed: Record<string, string>) => {
  const sorted = Object.fromEntries(Object.entries(dismissed).sort(([a], [b]) => a.localeCompare(b)))
  const file = path.join(root, CLEANUP_FILE)
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, JSON.stringify({ dismissed: sorted }, null, 2) + '\n', 'utf-8')
}

/** Drop dismissals that name deleted ids, so an entry that later reuses the id starts with its own flags visible. */
const dropFromCleanupState = (root: string, ids: string[]) => withCleanupLock(async () => {
  const next = pruneDismissed((await readCleanupState(root)).dismissed, ids)
  if (next) await writeCleanupState(root, next)
})

/** Hide a health flag for as long as its id stays the same. Throws when no current flag has that id. */
export async function dismissHealthFlag(flagId: string, root: string, actor: 'human' | 'ai' = 'human'): Promise<CleanupFlag> {
  const flag = (await getMemoryHealth(root, { includeDismissed: true })).find(f => f.id === flagId)
  if (!flag) throw new RoadmapError(`Flag "${flagId}" not found`, 404)
  const date = await withCleanupLock(async () => {
    const { dismissed } = await readCleanupState(root)
    dismissed[flagId] = localToday()
    await writeCleanupState(root, dismissed)
    return dismissed[flagId]
  })
  await appendActivity(root, { type: 'memory_updated', actor, title: 'Cleanup flag dismissed', detail: flag.message })
  return { ...flag, dismissed: date }
}

// ─── File history from git (R053) ─────────────────────────────────────────────

const execFileP = promisify(execFile)
const GIT_SHA_RE = /^[0-9a-f]{7,40}$/
const HISTORY_MAX = 50

/** One commit that touched a file; `path` is its repo-relative path after that commit ('' if the commit only deleted it). */
export type FileCommit = { sha: string; author: string; date: string; subject: string; path: string }
/** `reason: 'no-git'` when the project isn't a git repo or git is missing. */
export type FileHistory = { history: FileCommit[]; uncommitted: boolean; reason?: 'no-git' }

/** git with an argument array (never a shell string), run in the project root. */
async function git(args: string[], root: string): Promise<string> {
  const { stdout } = await execFileP('git', args, { cwd: root, maxBuffer: 4 * 1024 * 1024 })
  return stdout
}

function relInsideRoot(relPath: string, root: string): string {
  const full = path.resolve(root, relPath)
  if (!full.startsWith(path.resolve(root) + path.sep)) throw new RoadmapError('Path outside root')
  return path.relative(root, full).split(path.sep).join('/')
}

/**
 * Commits that touched `relPath`, newest first, plus whether it has uncommitted changes.
 * An entry file (`E001-<slug>.md`) is matched by its id, not its name: a new summary renames the file, and small
 * files often fall under git's rename detection, so `--follow` would lose the history before the rename.
 */
export async function getFileHistory(relPath: string, root: string, limit = 20): Promise<FileHistory> {
  const rel = relInsideRoot(relPath, root)
  const id = /^(E\d+)-[^/]*\.md$/.exec(path.posix.basename(rel))?.[1]
  // ponytail: a deleted id that gets reused later shares this history; fine while ids are rarely reused
  const spec = id ? [`:(glob)${path.posix.dirname(rel)}/${id}-*.md`] : ['--follow', rel]
  try {
    const out = await git(['log', '--name-status', '--format=%x1e%H%x1f%an%x1f%aI%x1f%s', '-n', String(Math.min(limit, HISTORY_MAX)), ...(id ? ['--', ...spec] : [spec[0], '--', spec[1]])], root)
    const history = out.split('\x1e').filter(r => r.trim()).map((record): FileCommit => {
      const [head, ...rest] = record.split('\n')
      const [sha, author, date, subject] = head.split('\x1f')
      // "M\tpath", "A\tpath", "R087\told\tnew", "D\tpath": the path that exists after this commit (none if only deleted)
      const kept = rest.map(l => l.split('\t')).filter(f => f.length > 1 && f[0] !== 'D').map(f => f[f.length - 1])
      return { sha, author, date, subject, path: kept[0] ?? '' }
    })
    const status = await git(['status', '--porcelain', '--', id ? spec[0] : rel], root)
    return { history, uncommitted: status.trim().length > 0 }
  } catch (e) {
    console.warn(`git history unavailable for ${rel}`, e instanceof Error ? e.message : e)
    return { history: [], uncommitted: false, reason: 'no-git' }
  }
}

/** The file's text at `sha`, using the path it had in that commit. Throws 400 on a bad sha, 404 if `sha` isn't in its history. */
export async function getFileAtCommit(relPath: string, sha: string, root: string): Promise<string> {
  if (!GIT_SHA_RE.test(sha)) throw new RoadmapError(`Invalid commit "${sha}"`)
  const { history } = await getFileHistory(relPath, root, HISTORY_MAX)
  const commit = history.find(c => c.sha.startsWith(sha))
  if (!commit) throw new RoadmapError(`Commit ${sha} did not touch ${relPath}`, 404)
  if (!commit.path) throw new RoadmapError(`The file was deleted in ${commit.sha.slice(0, 7)}`, 404)
  // commit.path is relative to the repo top level, which may be above root
  const top = (await git(['rev-parse', '--show-toplevel'], root)).trim()
  return git(['show', `${commit.sha}:${commit.path}`], top)
}

/** Keyword recall over the entries: compact hits, no bodies (R048). */
export async function recallEntries(query: string, opts: { type?: string; limit?: number }, root: string): Promise<RecallHit[]> {
  return rankEntries(await listEntries(root), query, opts)
}

/** Removes the file for good; git keeps its history. Throws on an unknown id. */
/** Returns the deleted entry plus its file text, so a UI can undo (restoreEntry). */
export function deleteEntry(id: string, root: string, actor: 'ai' | 'human' = 'human'): Promise<Entry & { raw: string }> {
  const norm = normalizeEntryId(String(id ?? ''))
  if (!norm) return Promise.reject(new Error(`Invalid id "${id}": expected E followed by a number, e.g. E001`))
  // ponytail: ids come from files on disk, so deleting the highest entry lets the next save reuse its id; git history is per path and the slug differs
  return withEntryLock(async () => {
    const entry = (await listEntries(root)).find(e => e.id === norm)
    if (!entry) throw new Error(`Entry ${norm} not found`)
    const raw = await fs.readFile(path.join(root, entry.file), 'utf8')
    await fs.rm(path.join(root, entry.file))
    await dropFromRecallLog(root, [norm])
    await dropFromCleanupState(root, [norm])
    await appendActivity(root, { type: 'memory_updated', actor, title: `Entry ${norm} deleted`, detail: entry.summary })
    return { ...entry, raw }
  })
}

/** Undo for deleteEntry: write the file back byte-for-byte, only as a plain memory/entries/E<n>-*.md and only if that id is free. */
export function restoreEntry(file: unknown, raw: unknown, root: string, actor: 'ai' | 'human' = 'human'): Promise<Entry> {
  return withEntryLock(async () => {
    if (!isFileIn(file, 'memory/entries', /^E\d+[^/]*\.md$/) || typeof raw !== 'string') throw new RoadmapError('Invalid entry to restore')
    const entry = parseEntry(raw, file)
    const id = normalizeEntryId(path.basename(file).match(/^(E\d+)/i)?.[1] ?? '')
    if (!entry || entry.id !== id) throw new RoadmapError('Invalid entry to restore')
    // the next save can reuse the highest id, so the id may be taken by now
    if ((await listEntries(root)).some(e => e.id === id)) throw new RoadmapError(`${id} already exists`)
    await fs.mkdir(path.join(root, ENTRIES_DIR), { recursive: true })
    await fs.writeFile(path.join(root, file), raw, { flag: 'wx', encoding: 'utf8' })
    await appendActivity(root, { type: 'memory_updated', actor, title: `Entry ${id} restored`, detail: entry.summary })
    return entry
  })
}

/** A file as it was before a merge; `dropped` = the merge deleted it (undo re-creates it, never over a taken id). */
export type MergeBefore = { file: string; raw: string; dropped?: boolean }

/**
 * Approve a duplicate merge (R051): rewrite the kept entry, delete the dropped ones, and point other entries'
 * mentions of a dropped id at the kept id. Validates everything before the first write. `before` feeds undoMerge.
 */
export function mergeEntries(
  input: { keepId: unknown; dropIds: unknown; type: unknown; summary: unknown; body?: unknown },
  root: string, actor: 'ai' | 'human' = 'human',
): Promise<{ entry: Entry; before: MergeBefore[] }> {
  const keepId = normalizeEntryId(String(input.keepId ?? ''))
  if (!keepId) return Promise.reject(new RoadmapError(`Invalid keepId "${input.keepId}"`))
  if (!Array.isArray(input.dropIds) || !input.dropIds.length) return Promise.reject(new RoadmapError('dropIds must be a non-empty list'))
  const dropIds = input.dropIds.map(d => normalizeEntryId(String(d)))
  if (dropIds.some(d => !d)) return Promise.reject(new RoadmapError(`Invalid dropIds: ${input.dropIds.join(', ')}`))
  if (new Set(dropIds).size !== dropIds.length || dropIds.includes(keepId)) return Promise.reject(new RoadmapError('dropIds must be distinct and not include keepId'))
  const fields = { id: keepId, type: String(input.type ?? ''), summary: String(input.summary ?? ''), body: input.body as string | undefined }
  const error = validateEntryInput(fields)
  if (error) return Promise.reject(new RoadmapError(error))
  const drops = dropIds as string[]
  return withEntryLock(async () => {
    const entries = await listEntries(root)
    const byId = new Map(entries.map(e => [e.id, e]))
    const missing = [keepId, ...drops].filter(id => !byId.has(id))
    if (missing.length) throw new RoadmapError(`Entry ${missing.join(', ')} not found`)
    const read = (e: Entry) => fs.readFile(path.join(root, e.file), 'utf8')
    const old = byId.get(keepId) as Entry
    const summary = fields.summary.trim()
    // the merged text shouldn't point at an id that is about to disappear either
    const entry: Entry = {
      id: keepId, type: fields.type as EntryType, summary, body: replaceEntryRefs((fields.body ?? '').trim(), drops, keepId),
      updatedAt: localToday(), by: actor === 'human' ? 'human' : 'ai:agent', source: old.source,
      file: path.join(ENTRIES_DIR, `${keepId}-${entrySlug(summary)}.md`),
    }
    const before: MergeBefore[] = [{ file: old.file, raw: await read(old) }]
    for (const id of drops) { const e = byId.get(id) as Entry; before.push({ file: e.file, raw: await read(e), dropped: true }) }
    const rewrites: { file: string; raw: string }[] = []
    for (const e of entries) {
      if (e.id === keepId || drops.includes(e.id)) continue
      const raw = await read(e)
      const next = replaceEntryRefs(raw, drops, keepId)
      if (next !== raw) { before.push({ file: e.file, raw }); rewrites.push({ file: e.file, raw: next }) }
    }
    // all checks passed: write
    await fs.writeFile(path.join(root, entry.file), formatEntry(entry), 'utf8')
    if (old.file !== entry.file) await fs.rm(path.join(root, old.file), { force: true })
    for (const b of before) if (b.dropped) await fs.rm(path.join(root, b.file), { force: true })
    for (const r of rewrites) await fs.writeFile(path.join(root, r.file), r.raw, 'utf8')
    await dropFromRecallLog(root, drops)
    await dropFromCleanupState(root, drops)
    await appendActivity(root, { type: 'memory_updated', actor, title: `Entries merged into ${keepId}`, detail: `${drops.join(', ')} merged` })
    return { entry, before }
  })
}

/**
 * Undo for mergeEntries: write every `before` file back byte-for-byte (the kept entry under its old name).
 * Same path guard as restoreEntry; refuses (400) when a dropped id has been re-created since.
 */
export function undoMerge(before: unknown, root: string, actor: 'ai' | 'human' = 'human'): Promise<Entry[]> {
  return withEntryLock(async () => {
    if (!Array.isArray(before) || !before.length) throw new RoadmapError('Invalid merge to undo')
    const items = before.map((b: Partial<MergeBefore>) => {
      const { file, raw } = b ?? {}
      if (!isFileIn(file, 'memory/entries', /^E\d+[^/]*\.md$/) || typeof raw !== 'string') throw new RoadmapError('Invalid merge to undo')
      const entry = parseEntry(raw, file)
      if (!entry || entry.id !== normalizeEntryId(path.basename(file).match(/^(E\d+)/i)?.[1] ?? '')) throw new RoadmapError('Invalid merge to undo')
      return { file, raw, entry, dropped: b.dropped === true }
    })
    const current = new Map((await listEntries(root)).map(e => [e.id, e]))
    const taken = items.filter(i => i.dropped && current.has(i.entry.id)).map(i => i.entry.id)
    if (taken.length) throw new RoadmapError(`${taken.join(', ')} already exists`)
    await fs.mkdir(path.join(root, ENTRIES_DIR), { recursive: true })
    for (const i of items) {
      const now = current.get(i.entry.id)
      await fs.writeFile(path.join(root, i.file), i.raw, { flag: i.dropped ? 'wx' : 'w', encoding: 'utf8' })
      if (now && now.file !== i.file) await fs.rm(path.join(root, now.file), { force: true })
    }
    const keep = items.find(i => !i.dropped)?.entry.id ?? ''
    await appendActivity(root, { type: 'memory_updated', actor, title: `Merge into ${keep} undone`, detail: `${items.filter(i => i.dropped).map(i => i.entry.id).join(', ')} restored` })
    return items.map(i => i.entry)
  })
}

// ─── Activity log ─────────────────────────────────────────────────────────────

const ACTIVITY_FILE = '.vibedoc-activity.json'
const ACTIVITY_CAP = 2000

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

// ponytail: current session per root+actor lives in memory (on globalThis so dev HMR keeps it); a server restart starts a new session.
const globalForSessions = globalThis as unknown as { vibedocSessions?: Map<string, { id: string; lastAt: number }> }
const currentSessions = globalForSessions.vibedocSessions ?? (globalForSessions.vibedocSessions = new Map())

function stampSession(root: string, event: Omit<ActivityEvent, 'id' | 'timestamp'>, now: number): string {
  const key = `${root}\0${event.actor}`
  let cur = currentSessions.get(key)
  if (!cur || event.type === 'session_start' || now - cur.lastAt > SESSION_GAP_MS) {
    cur = { id: `ses_${now}_${Math.random().toString(36).slice(2, 7)}`, lastAt: now }
    currentSessions.set(key, cur)
  }
  cur.lastAt = now
  return cur.id
}

/** The actor's running session id (T046 stamping), or null when there is none or it went idle. */
export function currentSessionId(root: string, actor: ActivityEvent['actor'] = 'ai'): string | null {
  const cur = currentSessions.get(`${root}\0${actor}`)
  return cur && Date.now() - cur.lastAt <= SESSION_GAP_MS ? cur.id : null
}

async function appendActivity(root: string, event: Omit<ActivityEvent, 'id' | 'timestamp'>): Promise<void> {
  if (isDemo()) return // read-only demo (R042): a read (session start) never writes the log
  const now = Date.now()
  const full: ActivityEvent = {
    id: `evt_${now}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date(now).toISOString(),
    ...event,
    sessionId: stampSession(root, event, now),
  }

  const file = path.join(root, ACTIVITY_FILE)
  let events: ActivityEvent[] = []
  try {
    const raw = await fs.readFile(file, 'utf8')
    events = JSON.parse(raw)
  } catch {}

  events.unshift(full)
  if (events.length > ACTIVITY_CAP) events = events.slice(0, ACTIVITY_CAP)
  await fs.writeFile(file, JSON.stringify(events, null, 2), 'utf8')
}

const DOC_EDIT_COALESCE_MS = 10 * 60_000
const DOC_EDIT_LOOKBACK = 50

/**
 * Record who last saved a doc (R055 doc owner). Autosave fires every few seconds, so a save by the same
 * actor within 10 minutes of the newest event for that doc just moves that event's time forward.
 */
export async function noteDocEdit(root: string, docPath: string, actor: 'ai' | 'human'): Promise<void> {
  if (isDemo()) return
  const file = path.join(root, ACTIVITY_FILE)
  let events: ActivityEvent[] = []
  try { events = JSON.parse(await fs.readFile(file, 'utf8')) } catch {}
  // Other events (an agent moving tasks) land in between, so look back a little, not just at the top
  const i = events.slice(0, DOC_EDIT_LOOKBACK).findIndex(e => e.type === 'doc_updated' && e.detail === docPath)
  const prev = i >= 0 ? events[i] : undefined
  if (prev && prev.actor === actor && Date.now() - Date.parse(prev.timestamp) < DOC_EDIT_COALESCE_MS) {
    // move it to the top with the new time, so the log stays newest-first
    events.splice(i, 1)
    events.unshift({ ...prev, timestamp: new Date().toISOString() })
    await fs.writeFile(file, JSON.stringify(events, null, 2), 'utf8')
    return
  }
  await appendActivity(root, { type: 'doc_updated', actor, title: `Edited ${docPath}`, detail: docPath })
}

/** Who last created or saved the doc, from the activity log; null when the log has nothing on it. */
export async function docLastEdit(root: string, docPath: string): Promise<{ actor: 'ai' | 'human'; at: string } | null> {
  const e = (await readActivity(root, ACTIVITY_CAP)).find(
    (x) => (x.type === 'doc_updated' || x.type === 'doc_created') && x.detail === docPath,
  )
  return e ? { actor: e.actor, at: e.timestamp } : null
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
  // An agent re-reading memory mid-session isn't a new connection
  if (currentSessionId(root, actor)) return
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

export async function renameDoc(oldPath: string, newPath: string, root: string, actor: 'ai' | 'human' = 'human'): Promise<void> {
  const resolvedRoot = path.resolve(root)
  const fullOld = path.resolve(root, oldPath)
  const fullNew = path.resolve(root, newPath)
  if (!fullOld.startsWith(resolvedRoot + path.sep) && fullOld !== resolvedRoot) {
    throw new Error('Path outside root')
  }
  if (!fullNew.startsWith(resolvedRoot + path.sep) && fullNew !== resolvedRoot) {
    throw new Error('Path outside root')
  }
  // fs.rename silently replaces an existing file
  if (fullNew !== fullOld && await fs.access(fullNew).then(() => true, () => false)) {
    throw new Error(`A file already exists at ${newPath}`)
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
  await appendActivity(root, { type: 'doc_renamed', actor, title: `Renamed ${oldPath} → ${newPath}` })
  try { const { exists } = await readRegistry(root); if (exists) await rebuildRegistry(root, actor, false) } catch {}
}

/** Returns the removed content, so the client can offer Undo (re-create via createDoc). */
export async function deleteDoc(docPath: string, root: string, actor: 'ai' | 'human' = 'human'): Promise<string> {
  const resolvedRoot = path.resolve(root)
  const fullPath = path.resolve(root, docPath)
  if (!fullPath.startsWith(resolvedRoot + path.sep) && fullPath !== resolvedRoot) {
    throw new Error('Path outside root')
  }
  const content = await fs.readFile(fullPath, 'utf8')
  await fs.unlink(fullPath)
  await appendActivity(root, { type: 'doc_deleted', actor, title: `Deleted ${docPath}` })
  try { const { exists } = await readRegistry(root); if (exists) await rebuildRegistry(root, actor, false) } catch {}
  return content
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

export async function rebuildRegistry(root: string, actor: 'ai' | 'human' = 'human', log = true): Promise<{ path: string; totalFiles: number }> {
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
  // Automatic rebuilds after a doc create/rename/delete aren't logged: the doc row already says what changed
  if (log) await appendActivity(root, {
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

/**
 * The memory link graph (R053), built on request from the files: every entry, plus the tasks, roadmap items,
 * ADRs and docs an entry mentions or that mention an entry id. Pure resolution in src/lib/memory-graph.ts.
 */
export async function getMemoryGraph(root: string): Promise<MemoryGraph> {
  const [entries, others] = await Promise.all([listEntries(root), memoryGraphFiles(root)])
  return buildGraph(
    entries.map(e => ({ id: e.id, kind: 'entry', label: e.summary, path: e.file.replace(/\\/g, '/'), text: `${e.summary}\n${e.body}` })),
    others,
  )
}

/** Every non-entry .md the memory graph scans (tasks, roadmap, ADRs, docs, MEMORY.md), with its text. */
async function memoryGraphFiles(root: string): Promise<GraphItem[]> {
  // ponytail: reads every .md on each call; cache by mtime (as getDocGraph does) if big repos make it slow
  const files = await glob('**/*.md', { cwd: root, ignore: ['node_modules/**', '.git/**', '.next/**', 'memory/entries/**'], nodir: true })
  const others = await Promise.all(files.map(async (f): Promise<GraphItem | null> => {
    try {
      const raw = await fs.readFile(path.join(root, f), 'utf8')
      return { ...fileNode(f, raw), text: raw }
    } catch (e) {
      console.warn(`memory graph: skipped ${f}`, e)
      return null
    }
  }))
  return others.filter((o): o is GraphItem => !!o)
}

// ponytail: in-process cache only; a second VibeDoc process keeps its own. On globalThis so dev HMR keeps it.
// Entries are keyed by mtime only, so bump DOC_GRAPH_CACHE_VERSION whenever docNode / extractLinks change what they
// return: an HMR'd dev server would otherwise keep serving nodes built by the old code.
const DOC_GRAPH_CACHE_VERSION = 3
const docGraphCache: Map<string, { mtimeMs: number; item: DocItem }> = (() => {
  const g = globalThis as { __vibedocDocGraphCache?: { v: number; map: Map<string, { mtimeMs: number; item: DocItem }> } }
  if (g.__vibedocDocGraphCache?.v !== DOC_GRAPH_CACHE_VERSION) g.__vibedocDocGraphCache = { v: DOC_GRAPH_CACHE_VERSION, map: new Map() }
  return g.__vibedocDocGraphCache.map
})()

/** Resolved links between every .md file (R056). Only files whose mtime changed since the last call are re-read. */
export async function getDocGraph(root: string): Promise<DocGraph> {
  const files = (await glob('**/*.md', { cwd: root, ignore: ['node_modules/**', '.git/**', '.next/**'], nodir: true }))
    .map(f => f.replace(/\\/g, '/')).sort()
  const keyOf = (f: string) => `${root}\u0000${f}`
  let reread = 0
  const items = await Promise.all(files.map(async (f): Promise<DocItem | null> => {
    const key = keyOf(f)
    try {
      const { mtimeMs } = await fs.stat(path.join(root, f))
      const hit = docGraphCache.get(key)
      if (hit && hit.mtimeMs === mtimeMs) return hit.item
      const raw = await fs.readFile(path.join(root, f), 'utf8')
      reread++
      const item = { node: docNode(f, raw), links: extractLinks(raw, f) }
      docGraphCache.set(key, { mtimeMs, item })
      return item
    } catch (e) {
      docGraphCache.delete(key)
      console.warn(`doc graph: skipped ${f}`, e)
      return null
    }
  }))
  const live = new Set(files.map(keyOf))
  for (const key of docGraphCache.keys()) if (key.startsWith(`${root}\u0000`) && !live.has(key)) docGraphCache.delete(key)
  if (reread) console.log(`doc graph: read ${reread} of ${files.length} files`)
  // .md files in dot folders (.claude/skills, .impeccable): not graph nodes, but a mention of one isn't stale
  const hidden = (await glob('.*/**/*.md', { cwd: root, dot: true, ignore: ['.git/**', '.next/**', '**/node_modules/**'], nodir: true }))
    .map(f => f.replace(/\\/g, '/'))
  return buildDocGraph(items.filter((i): i is DocItem => !!i), hidden)
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
      board: { todo: board.todo.length, 'in-progress': board['in-progress'].length, review: board.review.length, blocked: board.blocked.length, done: board.done.length, cancelled: board.cancelled.length },
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

export type RoadmapStatus = 'planned' | 'in-progress' | 'paused' | 'done'

export interface RoadmapItem {
  id: string            // "R004"
  title: string
  parent: string | null // null = horizon on the spine
  status: RoadmapStatus
  order: number
  tasks: string[]       // ["T001", "T012"]
  due: string | null    // "2026-10-15" — a calendar date, not an instant; compare as strings
  owner: string | null  // "human" | "ai:<agent>" (R055)
  priority: Priority | null  // **Priority:** P0–P3
  specs: string[]       // **Specs:** capability slugs of docs/specs/<slug>.md (R066)
  scenarios: Scenario[] // the body's ## Scenarios (R068)
  specMerged: string | null // **Spec merged:** YYYY-MM-DD, when its ## Spec changes went into the capability specs (R069)
  specChanges: { capability: string; ops: { op: string; name: string }[] }[] // the body's ## Spec changes, targets only (R069)
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
  owner?: string | null
  priority?: string | null
  body?: string
}

export type UpdateRoadmapItemPatch = Partial<Omit<CreateRoadmapItemParams, 'title'> & { title: string; specs: string[] | null; specMerged: string | null }>


/** Validation / not-found error from the roadmap API. `status` maps straight to an HTTP code. */
export class RoadmapError extends Error {
  constructor(message: string, public status: 400 | 404 | 409 = 400) {
    super(message)
    this.name = 'RoadmapError'
  }
}

const ROADMAP_DIR = path.join('plans', 'roadmap')
const ROADMAP_LAYOUT = path.join(ROADMAP_DIR, 'layout.json')
const ROADMAP_STATUSES: RoadmapStatus[] = ['planned', 'in-progress', 'paused', 'done']
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
  const t = String(raw ?? '').toLowerCase().trim().replace(/\s+/g, '-')
  const s = t === 'on-hold' ? 'paused' : t
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
    owner: parseOwner(meta['owner']),
    priority: parsePriority(meta['priority']),
    specs: parseSpecSlugs(meta['specs']),
    scenarios: parseScenarios(lines.slice(metaEnd).join('\n')),
    specMerged: parseDue(meta['spec merged'] || ''),
    specChanges: parseSpecChanges(lines.slice(metaEnd).join('\n')).map(c => ({ capability: c.capability, ops: c.ops.map(o => ({ op: o.op, name: o.name })) })),
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
async function writeRoadmapFile(root: string, f: Omit<RoadmapItem, 'file' | 'owner' | 'priority' | 'specs' | 'scenarios' | 'specMerged' | 'specChanges'>): Promise<void> {
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
  id: string, patch: UpdateRoadmapItemPatch, root: string, actor: 'ai' | 'human' = 'human',
  /** false when the edit is a side effect of a task change (its **Tasks:** line); the task row already says it */
  log = true,
): Promise<RoadmapItem> {
  return withRoadmapLock(() => updateRoadmapItemUnlocked(id, patch, root, actor, log))
}

async function updateRoadmapItemUnlocked(
  id: string, patch: UpdateRoadmapItemPatch, root: string, actor: 'ai' | 'human', log: boolean,
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
  const specMerged = p.specMerged === undefined ? undefined : cleanDue(p.specMerged)
  let owner: string | null | undefined
  if (p.owner !== undefined) {
    owner = p.owner === null || p.owner === '' ? null : parseOwner(p.owner)
    if (p.owner && !owner) throw new RoadmapError(`owner must be "human" or "ai:<agent>" (got ${JSON.stringify(p.owner)})`)
  }
  let priority: string | null | undefined
  if (p.priority !== undefined) {
    priority = p.priority === null || p.priority === '' ? null : parsePriority(p.priority)
    if (p.priority && !priority) throw new RoadmapError(`priority must be P0, P1, P2 or P3 (got ${JSON.stringify(p.priority)})`)
  }
  let specs: string | null | undefined
  if (p.specs !== undefined) {
    const raw = p.specs === null ? [] : Array.isArray(p.specs) ? p.specs : null
    if (!raw || raw.some(x => typeof x !== 'string')) throw new RoadmapError('specs must be an array of capability slugs')
    const slugs = parseSpecSlugs(raw.join(','))
    const known = (await listSpecs(root)).map(sp => sp.capability)
    const unknown = slugs.filter(sl => !known.includes(sl))
    if (unknown.length) throw new RoadmapError(`Unknown spec${unknown.length > 1 ? 's' : ''} ${unknown.join(', ')}; known: ${known.join(', ') || 'none (docs/specs/<capability>.md)'}`)
    specs = slugs.length ? slugs.join(', ') : null
  }
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
  if (owner !== undefined) setMeta('Owner', owner)
  if (priority !== undefined) setMeta('Priority', priority)
  if (specs !== undefined) setMeta('Specs', specs)
  if (specMerged !== undefined) setMeta('Spec merged', specMerged)
  if (body !== undefined) {
    rest = body ? ['', body, ''] : ['']
  }

  await fs.writeFile(path.join(root, item.file), [...head, ...rest].join('\n'), 'utf8')
  const updated = await getRoadmapItem(item.id, root)
  if (log) await appendActivity(root, { type: 'roadmap_updated', actor, title: `${item.id} updated`, detail: updated.title })
  return updated
}

export interface DeletedRoadmapItem { item: RoadmapItem; raw: string; position: { x: number; y: number } | null }

export function deleteRoadmapItem(id: string, root: string, actor: 'ai' | 'human' = 'human'): Promise<DeletedRoadmapItem> {
  return withRoadmapLock(() => deleteRoadmapItemUnlocked(id, root, actor))
}

async function deleteRoadmapItemUnlocked(id: string, root: string, actor: 'ai' | 'human'): Promise<DeletedRoadmapItem> {
  const { item, raw } = await findRoadmapFile(id, root)
  const position = (await readRoadmapLayout(root))[item.id] ?? null
  const items = (await readRoadmapFiles(root)).map(f => f.item)
  const children = items.filter(i => i.parent === item.id).map(i => i.id)
  if (children.length > 0) {
    throw new RoadmapError(`${item.id} still has children (${children.join(', ')}); move or delete them first`)
  }
  await fs.unlink(path.join(root, item.file))
  // Prune now so a later create reusing this id doesn't inherit the old position.
  await writeRoadmapLayoutUnlocked({}, root)
  await appendActivity(root, { type: 'roadmap_updated', actor, title: `${item.id} deleted`, detail: item.title })
  return { item, raw, position }
}

/** Undo for deleteRoadmapItem: write the file back byte-for-byte (never over an existing id) and its position. */
export function restoreRoadmapItem(
  file: unknown, raw: unknown, position: unknown, root: string, actor: 'ai' | 'human' = 'human'
): Promise<RoadmapItem> {
  return withRoadmapLock(async () => {
    if (!isFileIn(file, ROADMAP_DIR, /^R\d+[^/]*\.md$/) || typeof raw !== 'string') throw new RoadmapError('Invalid roadmap item to restore')
    const id = roadmapIdOf(file)
    if (!id) throw new RoadmapError('Invalid roadmap item to restore')
    if (await findRoadmapFile(id, root).then(() => true, () => false)) throw new RoadmapError(`${id} already exists`)
    await fs.mkdir(path.join(root, ROADMAP_DIR), { recursive: true })
    await fs.writeFile(path.join(root, file), raw, { flag: 'wx', encoding: 'utf8' })
    if (position) await writeRoadmapLayoutUnlocked({ [id]: position as { x: number; y: number } }, root)
    await appendActivity(root, { type: 'roadmap_updated', actor, title: `${id} restored` })
    return (await findRoadmapFile(id, root)).item
  })
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

// ─── Planning skills ──────────────────────────────────────────────────────────

const PLANNING_SKILLS = { roadmap: 'roadmap', breakdown: 'breakdown' } as const
export type PlanningKind = keyof typeof PLANNING_SKILLS

/** Bundled skill body (frontmatter stripped): the `vibedoc` Claude Code plugin's skills in plugin/skills/, read from the VibeDoc package (cwd), not the target project. */
export async function readPlanningSkill(kind: PlanningKind): Promise<string> {
  if (!Object.hasOwn(PLANNING_SKILLS, kind)) throw new Error(`Unknown planning kind "${kind}" (expected: ${Object.keys(PLANNING_SKILLS).join(', ')})`)
  const text = await fs.readFile(path.join(process.cwd(), 'plugin', 'skills', PLANNING_SKILLS[kind], 'SKILL.md'), 'utf-8')
  return text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trimStart()
}

/** VibeDoc's own getting-started guide (R042), read from the package (cwd) like the skills, never the target project. */
export async function readGettingStarted(): Promise<string> {
  return fs.readFile(path.join(process.cwd(), 'docs', 'getting-started.md'), 'utf-8')
}

// ─── Agent chats (.vibedoc/chats/<id>.json) ───────────────────────────────────
// The browser owns the chat shape (src/lib/chats.ts); core only stores it by id.

const CHATS_DIR = path.join('.vibedoc', 'chats')
const CHAT_ID = /^[a-z0-9-]{1,64}$/

function chatFile(id: string, root: string): string {
  if (!CHAT_ID.test(id)) throw new Error(`Invalid chat id "${id}"`)
  return path.join(root, CHATS_DIR, `${id}.json`)
}

/** Every saved chat, unparsed beyond JSON. Unreadable files are skipped (logged). */
export async function listChats(root: string): Promise<unknown[]> {
  const dir = path.join(root, CHATS_DIR)
  const files = await fs.readdir(dir).catch(() => [] as string[])
  // ponytail: reads every chat file on load; add a limit/index if projects collect hundreds of chats
  const chats = await Promise.all(files.filter(f => f.endsWith('.json')).map(async f => {
    try {
      return JSON.parse(await fs.readFile(path.join(dir, f), 'utf-8')) as unknown
    } catch (e) {
      console.warn(`[vibedoc] skipping unreadable chat ${f}: ${(e as Error).message}`)
      return null
    }
  }))
  return chats.filter(c => c !== null)
}

export async function saveChat(chat: unknown, root: string): Promise<void> {
  const id = (chat as { id?: unknown } | null)?.id
  if (typeof id !== 'string') throw new Error('chat.id is required')
  const file = chatFile(id, root)
  await fs.mkdir(path.dirname(file), { recursive: true })
  // Write-then-rename so a crash mid-write never leaves half a JSON file
  const tmp = `${file}.tmp`
  await fs.writeFile(tmp, JSON.stringify(chat), 'utf-8')
  await fs.rename(tmp, file)
}

export async function deleteChat(id: string, root: string): Promise<void> {
  await fs.rm(chatFile(id, root), { force: true })
}

// ─── Episodes ─────────────────────────────────────────────────────────────────
// `.vibedoc/episodes/<sessionId>.md` (R050): auto summary + handoff for a session with no MEMORY.md write.

export const EPISODES_DIR = path.join('.vibedoc', 'episodes')
const EPISODE_ID = /^[A-Za-z0-9_-]{1,80}$/

/** Overwrites the session's own file (idempotent per session). Returns the project-relative path. */
export async function writeEpisode(ep: { sessionId: string; markdown: string }, root: string): Promise<string> {
  if (!EPISODE_ID.test(ep.sessionId)) throw new Error(`Invalid session id "${ep.sessionId}"`)
  const rel = path.join(EPISODES_DIR, `${ep.sessionId}.md`)
  const file = path.join(root, rel)
  await fs.mkdir(path.dirname(file), { recursive: true })
  const tmp = `${file}.tmp`
  await fs.writeFile(tmp, ep.markdown, 'utf8')
  await fs.rename(tmp, file)
  return rel
}

/** Every episode, newest `end` first; a missing folder is []. */
export async function listEpisodes(root: string): Promise<Episode[]> {
  const files = await fs.readdir(path.join(root, EPISODES_DIR)).catch(() => [] as string[])
  const eps = await Promise.all(files.filter(f => f.endsWith('.md')).map(async f => {
    const rel = path.join(EPISODES_DIR, f)
    try {
      return parseEpisode(await fs.readFile(path.join(root, rel), 'utf8'), rel)
    } catch (e) {
      console.warn(`[vibedoc] skipping unreadable episode ${f}: ${(e as Error).message}`)
      return null
    }
  }))
  return eps.filter((e): e is Episode => !!e).sort((a, b) => b.end.localeCompare(a.end))
}

export async function getLatestEpisode(root: string): Promise<Episode | null> {
  return (await listEpisodes(root))[0] ?? null
}

/** Episodes that ended after MEMORY.md was last written (by vibedoc_update_memory or by hand), newest first. */
export async function episodesSinceHandoff(root: string): Promise<Episode[]> {
  const [eps, stat] = await Promise.all([
    listEpisodes(root),
    fs.stat(path.join(root, 'memory', 'MEMORY.md')).catch(() => null),
  ])
  const since = stat?.mtimeMs ?? -Infinity
  return eps.filter(e => Date.parse(e.end) > since)
}

function sessionEpisode(s: Session, events: ActivityEvent[], tasks: Task[], source: string, agent?: string): string {
  const openTasks = s.tasks
    .filter(t => t.lastStatus !== 'done' && t.lastStatus !== 'cancelled')
    .map(t => ({ id: t.id, title: tasks.find(x => x.id === t.id)?.title ?? '', status: t.lastStatus }))
  // No transcript outside the chat: "Where it stopped" is the last event's title
  return buildEpisode(s, { source, agent, openTasks, lastMessage: lastEventTitle(s, events) })
}

/**
 * R050 lazy backfill (at vibedoc_read_memory): an `inferred` episode for each ended agent session since the last
 * MEMORY.md write that has no handoff and no episode file, newest first. Never rewrites an existing episode.
 */
export async function backfillEpisodes(
  root: string, { excludeSessionId = null, limit = 5 }: { excludeSessionId?: string | null; limit?: number } = {},
): Promise<{ sessionId: string; file: string }[]> {
  if (isDemo()) return []
  const [events, files, memStat] = await Promise.all([
    readActivity(root, ACTIVITY_CAP),
    fs.readdir(path.join(root, EPISODES_DIR)).catch(() => [] as string[]),
    fs.stat(path.join(root, 'memory', 'MEMORY.md')).catch(() => null),
  ])
  const existing = new Set(files.filter(f => f.endsWith('.md')).map(f => f.slice(0, -3)))
  const picks = sessionsNeedingEpisode(groupSessions(events), events, existing, excludeSessionId, {
    now: Date.now(), gapMs: SESSION_GAP_MS, since: memStat?.mtimeMs, limit,
  })
  if (!picks.length) return []
  const { tasks } = await listTasks(root)
  const written: { sessionId: string; file: string }[] = []
  for (const s of picks) {
    const markdown = sessionEpisode(s, events, tasks, 'inferred')
    if (markdown) written.push({ sessionId: s.id, file: await writeEpisode({ sessionId: s.id, markdown }, root) })
  }
  return written
}

/**
 * R050: episode for the caller's current agent session when an epic run ends (vibedoc_next_task has nothing ready).
 * null when there is no running session, it wrote a handoff, or it changed nothing. Rewrites keep earlier sources.
 */
export async function writeRunEpisode(root: string, source: string, agent?: string): Promise<{ sessionId: string; file: string } | null> {
  if (isDemo()) return null
  const id = currentSessionId(root)
  if (!id) return null
  const events = await readActivity(root, ACTIVITY_CAP)
  const s = groupSessions(events).find(x => x.id === id)
  if (!s || !hasWork(s, events) || isHandoffWritten(s, events)) return null
  const rel = path.join(EPISODES_DIR, `${id}.md`)
  const prev = await fs.readFile(path.join(root, rel), 'utf8').then(raw => parseEpisode(raw, rel)).catch(() => null)
  const { tasks } = await listTasks(root)
  const markdown = sessionEpisode(s, events, tasks, mergeSources(prev?.source, source), agent)
  return markdown ? { sessionId: id, file: await writeEpisode({ sessionId: id, markdown }, root) } : null
}

// ─── Saved board views (.vibedoc/views.json) ─────────────────────────────────

const VIEWS_FILE = path.join('.vibedoc', 'views.json')

/** null when the file is missing or unreadable (caller falls back to the built-ins). */
export async function readViews(root: string): Promise<SavedView[] | null> {
  let raw: string
  try {
    raw = await fs.readFile(path.join(root, VIEWS_FILE), 'utf-8')
  } catch {
    return null
  }
  try {
    const views = (JSON.parse(raw) as { views?: unknown })?.views
    if (!Array.isArray(views)) throw new Error('"views" is not an array')
    return views as SavedView[]
  } catch (e) {
    console.warn(`[vibedoc] ignoring unreadable ${VIEWS_FILE}: ${(e as Error).message}`)
    return null
  }
}

export async function saveViews(views: SavedView[], root: string): Promise<void> {
  const file = path.join(root, VIEWS_FILE)
  await fs.mkdir(path.dirname(file), { recursive: true })
  // Write-then-rename so a crash mid-write never leaves half a JSON file
  const tmp = `${file}.tmp`
  await fs.writeFile(tmp, JSON.stringify({ views }, null, 2) + '\n', 'utf-8')
  await fs.rename(tmp, file)
}
