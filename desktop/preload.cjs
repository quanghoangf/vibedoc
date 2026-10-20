// The desktop app's bridge into the page (R112 T582): `window.vibedocDesktop`. Its presence is how the web UI knows it
// runs in the app (a browser tab has none), so app-only UI such as the update banner renders only here. Sandboxed:
// only contextBridge + ipcRenderer.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('vibedocDesktop', {
  /** The newer version found, or null: `{ version, notes, date }`. */
  getUpdate: () => ipcRenderer.invoke('vibedoc:get-update'),
  /** Calls `cb(update)` when a newer version is found; returns the unsubscribe. */
  onUpdate: (cb) => {
    const listener = (_e, update) => cb(update)
    ipcRenderer.on('vibedoc:update', listener)
    return () => ipcRenderer.removeListener('vibedoc:update', listener)
  },
  checkForUpdates: () => ipcRenderer.invoke('vibedoc:check-updates'),
  /** "Later": hides this version's banner until a newer one. */
  dismissUpdate: (version) => ipcRenderer.invoke('vibedoc:dismiss-update', version),
})
