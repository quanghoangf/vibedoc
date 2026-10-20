// Updates (R112 T582/T583): electron-updater reads the latest*.yml feeds the release attached (T581). It checks at
// start and every 6 h, in a packaged app only (VIBEDOC_UPDATE_FEED=<url> points it at a generic feed: tests, a local
// feed). Nothing downloads until the user clicks Update; a failed check is logged, never shown. The window talks over
// IPC (preload.cjs → window.vibedocDesktop): the update found, "Later" for a version (kept in the app's userData, so
// the browser UI never stores it), download, install. Events for the card (src/lib/desktop-update.ts) go out on
// `vibedoc:update-event`. Install = `beforeInstall()` (main.mjs stops the VibeDoc the app started), then
// quitAndInstall: the relaunched app starts the new bundled server.
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
/** Set by Update: from then on an updater error is the card's (until then a failed check is only logged). */
let downloading = false

function check() {
  autoUpdater.checkForUpdates().catch((e) => console.warn(`[vibedoc] update check failed: ${e.message}`))
}

/**
 * Starts checking. `send(event)` reaches the window: {type: available, update} | {type: progress, percent} |
 * {type: downloaded} | {type: error, message}. `beforeInstall()` runs (awaited) before the app quits to install.
 */
export function startUpdates(send, { beforeInstall = async () => {} } = {}) {
  ipcMain.handle('vibedoc:get-update', () => visibleUpdate(found, readDismissed()))
  ipcMain.handle('vibedoc:check-updates', () => check())
  // a failed download (or macOS refusing an unsigned app) is an event for the card, not a rejected call
  ipcMain.handle('vibedoc:download-update', () => {
    downloading = true
    autoUpdater.downloadUpdate().catch((e) => send({ type: 'error', message: e?.message ?? String(e) }))
  })
  ipcMain.handle('vibedoc:install-update', async () => {
    await beforeInstall()
    // not silent (Windows shows the installer's progress), and the app reopens on the new version
    autoUpdater.quitAndInstall(false, true)
  })
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
    if (update) send({ type: 'available', update })
  })
  autoUpdater.on('download-progress', (p) => send({ type: 'progress', percent: p.percent ?? 0 }))
  autoUpdater.on('update-downloaded', () => send({ type: 'downloaded' }))
  // an error while downloading or installing goes to the card (the release page instead); a failed check is only logged
  autoUpdater.on('error', (e) => {
    console.warn(`[vibedoc] update failed: ${e?.message ?? e}`)
    if (downloading) send({ type: 'error', message: e?.message ?? String(e) })
  })
  if (started) return
  started = true
  check()
  setInterval(check, CHECK_EVERY_MS).unref?.()
}
