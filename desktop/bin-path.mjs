// Where the VibeDoc CLI is (R112 T581): from source the repo's bin/, in a packaged app the copy of the npm package
// electron-builder put in resources/server (desktop/scripts/dist.mjs). Its modules are imported from there, so the app
// and the server it starts are always the same version.
import { app } from 'electron'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
export const binDir = app.isPackaged
  ? path.join(process.resourcesPath, 'server', 'node_modules', 'vibedoc', 'bin')
  : path.join(here, '..', 'bin')
export const fromBin = (file) => import(pathToFileURL(path.join(binDir, file)).href)
