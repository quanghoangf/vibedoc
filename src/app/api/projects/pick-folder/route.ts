import { NextRequest, NextResponse } from 'next/server'
import { pickFolder } from '@/lib/folder-picker'
import { crossOriginForbidden, hubWritesForbidden } from '../_shared'

/**
 * Opens the OS folder picker on this machine (Finder on macOS) → `{path}` | `{cancelled}` | `{unsupported}` | `{busy}`.
 * Only this app's own pages may open a dialog on the user's screen, so a request must carry this origin.
 */
export async function POST(req: NextRequest) {
  const forbidden = hubWritesForbidden() ?? crossOriginForbidden(req)
  if (forbidden) return forbidden
  if (!req.headers.get('origin')) return NextResponse.json({ error: 'Only VibeDoc pages can open the folder picker' }, { status: 403 })
  const { prompt } = await req.json().catch(() => ({}))
  return NextResponse.json(await pickFolder(typeof prompt === 'string' && prompt.trim() ? prompt.trim().slice(0, 120) : 'Choose a folder'))
}
