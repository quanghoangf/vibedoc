// The desktop app's bridge into the page (R112 T582/T583): `window.vibedocDesktop`. Its presence is how the web UI
// knows it runs in the app (a browser tab has none), so app-only UI such as the update card renders only here.
// Sandboxed: only contextBridge + ipcRenderer.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('vibedocDesktop', {
  /** The newer version found, or null: `{ version, notes, date }`. */
  getUpdate: () => ipcRenderer.invoke('vibedoc:get-update'),
  /** `cb(event)` for each update event (src/lib/desktop-update.ts UpdateEvent); returns the unsubscribe. */
  onUpdateEvent: (cb) => {
    const listener = (_e, event) => cb(event)
    ipcRenderer.on('vibedoc:update-event', listener)
    return () => ipcRenderer.removeListener('vibedoc:update-event', listener)
  },
  checkForUpdates: () => ipcRenderer.invoke('vibedoc:check-updates'),
  /** "Later": hides this version's card until a newer one. */
  dismissUpdate: (version) => ipcRenderer.invoke('vibedoc:dismiss-update', version),
  downloadUpdate: () => ipcRenderer.invoke('vibedoc:download-update'),
  /** Stops the VibeDoc the app started, installs the downloaded version and reopens the app. */
  installUpdate: () => ipcRenderer.invoke('vibedoc:install-update'),
})
