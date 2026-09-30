import { NextRequest, NextResponse } from 'next/server'
import { RoadmapError, getEntry, getFileAtCommit, getFileHistory } from '@/lib/core'
import { errorResponse, rootOf } from '../../roadmap/_shared'

/**
 * How an entry changed (R053), from git: `?entry=E001` → { history, uncommitted, reason? };
 * `&sha=<commit>` → { text } at that commit.
 */
export async function GET(req: NextRequest) {
  try {
    const root = rootOf(req)
    const id = req.nextUrl.searchParams.get('entry') ?? ''
    const entry = await getEntry(id, root)
    if (!entry) throw new RoadmapError(`Entry ${id || '(none)'} not found`, 404)
    const sha = req.nextUrl.searchParams.get('sha')
    if (sha !== null) return NextResponse.json({ text: await getFileAtCommit(entry.file, sha, root) })
    return NextResponse.json(await getFileHistory(entry.file, root))
  } catch (e) {
    return errorResponse(e)
  }
}
