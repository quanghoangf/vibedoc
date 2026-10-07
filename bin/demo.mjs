// `vibedoc --demo` (R085): the sample project in a throwaway copy, so nothing the user does touches their files.
// Self-check: node bin/demo.check.mts
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const DEMO_SOURCE = path.join(pkgRoot, 'examples', 'demo-project')
/** The sample's recorded test runs (scripts/demo-run.mjs), served from the demo's runs dir */
export const DEMO_RUNS = path.join(pkgRoot, 'examples', 'demo-runs', 'listly')
export const DEMO_PREFIX = 'vibedoc-demo-'
/** Written into every demo temp dir: the sweep deletes only folders that carry it */
export const DEMO_MARKER = '.vibedoc-demo'
const DAY_MS = 24 * 60 * 60 * 1000
/** The sample's "today" (one `YYYY-MM-DD` line): the copy's dates move so this day lands on the real today */
const ANCHOR_FILE = '.vibedoc-demo-anchor'
const DATE = /\b(\d{4})-(\d{2})-(\d{2})(?=$|[^\d])/g

/** Every `YYYY-MM-DD` (alone or the date part of an ISO timestamp) moved by whole days, with UTC math on the parts. */
export function shiftDates(text, days) {
  if (!days) return text
  return text.replace(DATE, (_, y, m, d) => new Date(Date.UTC(+y, +m - 1, +d + days)).toISOString().slice(0, 10))
}

/** Whole days from `anchor` (`YYYY-MM-DD`) to the local calendar day of `now`. */
export function daysSince(anchor, now = new Date()) {
  const [y, m, d] = anchor.trim().split('-').map(Number)
  return Math.round((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(y, m - 1, d)) / DAY_MS)
}

/** A run id (`20260925T052745Z`) moved by whole days, like shiftDates. */
export function shiftRunId(id, days) {
  const day = shiftDates(`${id.slice(0, 4)}-${id.slice(4, 6)}-${id.slice(6, 8)}`, days)
  return day.replaceAll('-', '') + id.slice(8)
}

/** Rename `<runs>/<project>/<task>/<runId>/` folders and their run.json `runId` by `days`. */
function shiftRuns(runsDir, days) {
  if (!days) return
  for (const project of readdirSync(runsDir)) {
    for (const task of readdirSync(path.join(runsDir, project))) {
      const taskDir = path.join(runsDir, project, task)
      for (const id of readdirSync(taskDir).filter((n) => /^\d{8}T\d{6}Z$/.test(n))) {
        const next = shiftRunId(id, days)
        renameSync(path.join(taskDir, id), path.join(taskDir, next))
        const manifest = path.join(taskDir, next, 'run.json')
        if (existsSync(manifest)) writeFileSync(manifest, readFileSync(manifest, 'utf8').replaceAll(id, next))
      }
    }
  }
}

/** Shift the dates of every .md / .json file under `dir` (the copy only: the sample stays fixed). */
function shiftTree(dir, days) {
  for (const e of readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (!e.isFile() || !/\.(md|json)$/.test(e.name)) continue
    const file = path.join(e.parentPath, e.name)
    writeFileSync(file, shiftDates(readFileSync(file, 'utf8'), days))
  }
}

/**
 * Copy the sample to `<tmp>/vibedoc-demo-XXXXXX/listly` (the folder name is the project name the UI and the runs
 * folder show). Test runs go to `<tmp>/.runs` (hidden, so project discovery never lists it), seeded with the sample's run.
 */
export function prepareDemo({ source = DEMO_SOURCE, runs = DEMO_RUNS, base = tmpdir(), now = new Date() } = {}) {
  const dir = mkdtempSync(path.join(base, DEMO_PREFIX))
  writeFileSync(path.join(dir, DEMO_MARKER), '')
  const root = path.join(dir, 'listly')
  cpSync(source, root, { recursive: true })
  const runsDir = path.join(dir, '.runs')
  if (existsSync(runs)) cpSync(runs, path.join(runsDir, 'listly'), { recursive: true })
  const anchor = path.join(root, ANCHOR_FILE)
  if (existsSync(anchor)) {
    const days = daysSince(readFileSync(anchor, 'utf8'), now)
    shiftTree(root, days)
    if (existsSync(runsDir)) { shiftTree(runsDir, days); shiftRuns(runsDir, days) } // runs move with their task
  }
  return { dir, root, runsDir, cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}

/**
 * A crash or `kill -9` skips cleanup: delete demo dirs older than a day. Only `vibedoc-demo-*` folders with the
 * marker, so nothing else in the temp folder is ever touched. Returns the removed paths.
 */
export function sweepDemos({ base = tmpdir(), now = Date.now() } = {}) {
  const removed = []
  for (const name of readdirSync(base)) {
    const dir = path.join(base, name)
    try {
      if (!name.startsWith(DEMO_PREFIX) || !existsSync(path.join(dir, DEMO_MARKER))) continue
      // ponytail: age by the dir mtime; a demo left running for over a day can be swept by a new one (add a pid file if that matters)
      if (now - statSync(dir).mtimeMs < DAY_MS) continue
      rmSync(dir, { recursive: true, force: true })
      removed.push(dir)
    } catch (e) {
      console.warn(`[vibedoc] could not remove the old demo folder ${dir}: ${e.message}`)
    }
  }
  return removed
}
