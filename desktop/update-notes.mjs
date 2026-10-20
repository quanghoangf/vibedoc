// Release notes as electron-updater hands them over (R112 T582): a string (the GitHub release body, HTML from the
// releases feed; markdown from a generic feed's yml), a list of {version, note} when several releases were skipped,
// or nothing. Always one string for the What's new dialog, newest first. Pure. Check: node desktop/update-notes.check.mjs
export function notesText(notes) {
  if (typeof notes === 'string') return notes.trim()
  if (!Array.isArray(notes)) return ''
  return notes
    .filter((n) => n && typeof n.note === 'string' && n.note.trim())
    .map((n) => `## ${n.version}\n\n${n.note.trim()}`)
    .join('\n\n')
}

/** The update the window should show: the newest one found, unless the user said Later to that version. */
export const visibleUpdate = (found, dismissed) => (found && found.version !== dismissed ? found : null)
