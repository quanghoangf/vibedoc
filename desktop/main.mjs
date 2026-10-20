// VibeDoc desktop app (R111): an Electron window around the VibeDoc hub that already runs (`vibedoc` or
// `vibedoc start`), found the way the CLI finds it: <home>/port (R100) and a probe of /api/projects. The window shows
// the same Next app as the browser. Closing it never stops that VibeDoc: the app didn't start it.
// Run from source: pnpm --dir desktop install && pnpm --dir desktop start. Doc: docs/desktop-app.md
import { app, BrowserWindow, Menu, nativeImage, screen } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { FIRST_PORT, appUrl, probeVibedoc, readSavedPort, vibedocHome } from '../bin/address.mjs'
import { pickLang, t } from './i18n.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const icon = nativeImage.createFromPath(path.join(here, 'icons', 'icon.png'))
/** While the not-running page shows: how often to look for VibeDoc again. */
const RETRY_MS = 2000

app.setName('VibeDoc')
// tests run the app with their own folder for the window size and the one-instance lock
if (process.env.VIBEDOC_DESKTOP_USER_DATA) app.setPath('userData', process.env.VIBEDOC_DESKTOP_USER_DATA)

/** The hub's address: the port the CLI saved, else the CLI's first port. Read at each probe (a new start may move it). */
const hubPort = () => readSavedPort(vibedocHome()) ?? FIRST_PORT

let win = null
let lang = 'en'
/** The address in use, or null while VibeDoc isn't answering. */
let using = null
let retry = null

// ── window size, remembered in the app's own folder (never the VibeDoc home) ──
const boundsFile = () => path.join(app.getPath('userData'), 'window.json')
function savedBounds() {
  try {
    const b = JSON.parse(readFileSync(boundsFile(), 'utf8'))
    if (![b.width, b.height].every(Number.isInteger)) return null
    // only a position that is on a screen now, else the OS places it
    const onScreen = Number.isInteger(b.x) && Number.isInteger(b.y)
      && screen.getAllDisplays().some(({ workArea: a }) => b.x >= a.x && b.y >= a.y && b.x < a.x + a.width && b.y < a.y + a.height)
    return onScreen ? b : { width: b.width, height: b.height }
  } catch {
    return null
  }
}
function saveBounds() {
  if (!win || win.isDestroyed() || win.isMinimized() || win.isFullScreen()) return
  try {
    writeFileSync(boundsFile(), JSON.stringify(win.getNormalBounds()))
  } catch {}
}

// ── menu: the standard Edit / View / Window menus (copy, paste, reload) plus a status line ──
function buildMenu() {
  const status = { label: using ? t(lang, 'using', { url: using }) : t(lang, 'notRunning'), enabled: false }
  const mac = process.platform === 'darwin'
  const first = mac
    ? { label: app.name, submenu: [status, { type: 'separator' }, { role: 'about' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }] }
    : { label: 'VibeDoc', submenu: [status, { type: 'separator' }, { role: 'quit' }] }
  Menu.setApplicationMenu(Menu.buildFromTemplate([first, { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' }]))
}

function showNotRunning(url) {
  const query = { lang, title: t(lang, 'notRunningTitle'), body: t(lang, 'notRunningBody'), hint: t(lang, 'notRunningHint', { url }) }
  return win.loadFile(path.join(here, 'not-running.html'), { query })
}

/** Loads the hub when it answers, else the not-running page and a retry until it does. */
async function connect() {
  clearTimeout(retry)
  if (!win || win.isDestroyed()) return
  const url = appUrl(hubPort())
  const found = await probeVibedoc(hubPort())
  if (!win || win.isDestroyed()) return
  if (found) {
    using = url
    buildMenu()
    await win.loadURL(`${url}/`)
    return
  }
  if (using !== null || !win.webContents.getURL().startsWith('file:')) {
    using = null
    buildMenu()
    await showNotRunning(url)
  }
  retry = setTimeout(connect, RETRY_MS)
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 640,
    minHeight: 480,
    ...savedBounds(),
    title: 'VibeDoc',
    icon,
    backgroundColor: '#0a0a0f',
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  win.once('ready-to-show', () => win.show())
  for (const e of ['resize', 'move']) win.on(e, saveBounds)
  win.on('close', saveBounds)
  win.on('closed', () => {
    clearTimeout(retry)
    win = null
  })
  connect()
}

// one app at a time: a second launch focuses the window this one has
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!win) return createWindow()
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  })
  app.whenReady().then(() => {
    lang = pickLang(app.getLocale())
    if (process.platform === 'darwin') app.dock?.setIcon(icon)
    buildMenu()
    createWindow()
  })
  // macOS keeps the app in the Dock with no window; the Dock icon reopens it. Elsewhere the last window quits.
  // Neither stops VibeDoc: this app didn't start it.
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
  app.on('activate', () => {
    if (!win) createWindow()
  })
}
