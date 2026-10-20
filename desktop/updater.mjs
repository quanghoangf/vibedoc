// Update check (R112 T582): electron-updater reads the latest*.yml feeds the release attached (T581). It only checks:
// nothing downloads until the user asks (T583), and an error is logged, never shown. Checks at start and every 6 h,
// in a packaged app only; VIBEDOC_UPDATE_FEED=<url> points it at a generic feed instead (tests, a local feed).
// The window asks over IPC (preload.cjs → window.vibedocDesktop): the update found, "Later" for a version (kept in the
// app's userData, so the browser UI never stores it), check again.
import { app, ipcMain } from 'electron'
import updater from 'electron-updater'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { notesText, visibleUpdate } from './update-notes.mjs'

const { autoUpdater } = updater
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000
const stateFile = () => path.join(app.getPath('userData'), 'update.json')

function readDismissed() {
  try {
    return JSON.parse(readFileSync(stateFile(), 'utf8')).dismissed ?? null
  } catch {
    return null
  }
}

let found = null
let started = false

function check() {
  autoUpdater.checkForUpdates().catch((e) => console.warn(`[vibedoc] update check failed: ${e.message}`))
}

/** Starts checking; `send(update)` reaches the window when one is found. */
export function startUpdates(send) {
  ipcMain.handle('vibedoc:get-update', () => visibleUpdate(found, readDismissed()))
  ipcMain.handle('vibedoc:check-updates', () => check())
  ipcMain.handle('vibedoc:dismiss-update', (_e, version) => {
    try {
      writeFileSync(stateFile(), JSON.stringify({ dismissed: String(version) }))
    } catch (e) {
      console.warn(`[vibedoc] couldn't save Later: ${e.message}`)
    }
  })
  const feed = process.env.VIBEDOC_UPDATE_FEED
  if (!app.isPackaged && !feed) return
  if (feed) {
    autoUpdater.forceDevUpdateConfig = true
    autoUpdater.setFeedURL({ provider: 'generic', url: feed })
  }
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.logger = { info: () => {}, debug: () => {}, warn: console.warn, error: console.warn }
  autoUpdater.on('update-available', (info) => {
    found = { version: info.version, notes: notesText(info.releaseNotes), date: info.releaseDate ?? null }
    const update = visibleUpdate(found, readDismissed())
    if (update) send(update)
  })
  autoUpdater.on('error', (e) => console.warn(`[vibedoc] update check failed: ${e?.message ?? e}`))
  if (started) return
  started = true
  check()
  setInterval(check, CHECK_EVERY_MS).unref?.()
}
