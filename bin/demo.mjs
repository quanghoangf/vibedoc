// `vibedoc --demo` (R085): the sample project in a throwaway copy, so nothing the user does touches their files.
// Self-check: node bin/demo.check.mts
import { cpSync, existsSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const DEMO_SOURCE = path.join(pkgRoot, 'examples', 'demo-project')
export const DEMO_PREFIX = 'vibedoc-demo-'
/** Written into every demo temp dir: the sweep deletes only folders that carry it */
export const DEMO_MARKER = '.vibedoc-demo'
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Copy the sample to `<tmp>/vibedoc-demo-XXXXXX/listly` (the folder name is the project name the UI and the runs
 * folder show). Test runs go to `<tmp>/.runs` (hidden, so project discovery never lists it).
 */
export function prepareDemo({ source = DEMO_SOURCE, base = tmpdir() } = {}) {
  const dir = mkdtempSync(path.join(base, DEMO_PREFIX))
  writeFileSync(path.join(dir, DEMO_MARKER), '')
  const root = path.join(dir, 'listly')
  cpSync(source, root, { recursive: true })
  return { dir, root, runsDir: path.join(dir, '.runs'), cleanup: () => rmSync(dir, { recursive: true, force: true }) }
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
