// VibeDoc desktop app (R111): an Electron window around the VibeDoc hub that already runs (`vibedoc` or
// `vibedoc start`), found the way the CLI finds it: <home>/port (R100) and a probe of /api/projects. Nothing running →
// the app starts one as its own child and stops it on quit (desktop/server.mjs, T578). The window shows the same Next
// app as the browser. A VibeDoc the app didn't start is never stopped.
// Run from source: pnpm --dir desktop install && pnpm --dir desktop start. Doc: docs/desktop-app.md
import { app, BrowserWindow, Menu, nativeImage, screen, shell } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { vibedocHome } from '../bin/address.mjs'
import { desktopLogFile, ensureServer, stopServer } from './server.mjs'
import { pickLang, t } from './i18n.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const icon = nativeImage.createFromPath(path.join(here, 'icons', 'icon.png'))

app.setName('VibeDoc')
// tests run the app with their own folder for the window size and the one-instance lock
if (process.env.VIBEDOC_DESKTOP_USER_DATA) app.setPath('userData', process.env.VIBEDOC_DESKTOP_USER_DATA)

let win = null
let lang = 'en'
/** The VibeDoc in use: `{ url, owned, child? }` (desktop/server.mjs), or null while there is none. */
let server = null
let connecting = null
let quitting = false

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
  const label = !server ? t(lang, 'notRunning') : t(lang, server.owned ? 'owned' : 'using', { url: server.url })
  const status = { label, enabled: false }
  const mac = process.platform === 'darwin'
  const first = mac
    ? { label: app.name, submenu: [status, { type: 'separator' }, { role: 'about' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }] }
    : { label: 'VibeDoc', submenu: [status, { type: 'separator' }, { role: 'quit' }] }
  Menu.setApplicationMenu(Menu.buildFromTemplate([first, { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' }]))
}

function showPage(query) {
  return win.loadFile(path.join(here, 'starting.html'), { query: { lang, ...query } })
}

/**
 * Opens the VibeDoc in use, else starts one (the starting screen meanwhile); a failed start shows the reason, the log
 * tail and Try again. One attempt at a time.
 */
function connect() {
  connecting ??= (async () => {
    const home = vibedocHome()
    const alive = server && (!server.owned || server.child.exitCode === null)
    if (!alive) {
      server = null
      const found = await ensureServer({
        home,
        onStarting: () => win && !win.isDestroyed() && showPage({ title: t(lang, 'startingTitle'), body: t(lang, 'startingBody') }),
      })
      if (found.error) {
        buildMenu()
        if (win && !win.isDestroyed()) {
          await showPage({
            state: 'failed', title: t(lang, 'failedTitle'), reason: found.error, log: found.log.join('\n'),
            logPath: t(lang, 'failedLog', { path: desktopLogFile(home) }), retry: t(lang, 'retry'),
          })
        }
        return
      }
      server = found
      // an owned VibeDoc that dies: the window says so with Try again (no automatic restart: that is R109's background mode)
      found.child?.once('exit', (code) => {
        if (quitting || server !== found) return
        server = null
        buildMenu()
        if (win && !win.isDestroyed()) {
          showPage({ state: 'failed', title: t(lang, 'failedTitle'), reason: t(lang, 'stopped', { code: code ?? '?' }), logPath: t(lang, 'failedLog', { path: desktopLogFile(vibedocHome()) }), retry: t(lang, 'retry') })
        }
      })
      buildMenu()
    }
    if (win && !win.isDestroyed()) await win.loadURL(`${server.url}/`)
  })().finally(() => { connecting = null })
  return connecting
}

/** Links to other sites go to the default browser (http, https, mailto only); anything else is refused (T579). */
function openOutside(url) {
  if (/^(https?|mailto):/i.test(url)) shell.openExternal(url)
}
const isHub = (url) => {
  try {
    return !!server && new URL(url).origin === new URL(server.url).origin
  } catch {
    return false
  }
}

/** The page title's `(n) VibeDoc` (the UI's inbox count, R105) as the Dock / taskbar badge. */
function badgeFromTitle(title) {
  const n = Number(/^\((\d+)\)/.exec(title)?.[1] ?? 0)
  app.setBadgeCount(n)
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
    win = null
  })
  // another site never loads in the window: a new window (target=_blank, window.open) on the hub opens here, else the
  // browser; an in-page navigation away from the hub goes to the browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isHub(url)) win.loadURL(url)
    else openOutside(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    if (isHub(url)) return
    e.preventDefault()
    openOutside(url)
  })
  win.on('page-title-updated', (_e, title) => badgeFromTitle(title))
  // Try again on the failure page is a #retry link (the page has no preload)
  win.webContents.on('did-navigate-in-page', (_e, url) => {
    if (url.endsWith('#retry')) connect()
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
  // the Dock icon, or a click on a notification (macOS activates the app): the window comes to the front
  app.on('activate', () => {
    if (!win) return createWindow()
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  })
  // quit stops only a VibeDoc this app started (and what it started), then quits for real
  app.on('before-quit', (e) => {
    if (quitting || !server?.owned || server.child.exitCode !== null) return
    e.preventDefault()
    quitting = true
    stopServer(server.child).finally(() => app.quit())
  })
}
