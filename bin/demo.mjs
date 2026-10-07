// `vibedoc --demo` (R085): the sample project in a throwaway copy, so nothing the user does touches their files.
// Self-check: node bin/demo.check.mts
import { cpSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const DEMO_SOURCE = path.join(pkgRoot, 'examples', 'demo-project')
export const DEMO_PREFIX = 'vibedoc-demo-'

/**
 * Copy the sample to `<tmp>/vibedoc-demo-XXXXXX/listly` (the folder name is the project name the UI and the runs
 * folder show). Test runs go to `<tmp>/.runs` (hidden, so project discovery never lists it).
 */
export function prepareDemo({ source = DEMO_SOURCE, base = tmpdir() } = {}) {
  const dir = mkdtempSync(path.join(base, DEMO_PREFIX))
  const root = path.join(dir, 'listly')
  cpSync(source, root, { recursive: true })
  return { dir, root, runsDir: path.join(dir, '.runs'), cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}
