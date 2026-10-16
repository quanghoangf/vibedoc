import { NextRequest, NextResponse } from 'next/server'
import { scanForRepos } from '@/lib/core'
import { crossOriginForbidden, hubErrorResponse, hubWritesForbidden } from '../_shared'

/** Scan a folder for repos to add (T536): `?dir=~/work` → `[{root, name, inHub}]`. Reads only. */
export async function GET(req: NextRequest) {
  const forbidden = hubWritesForbidden() ?? crossOriginForbidden(req)
  if (forbidden) return forbidden
  try {
    return NextResponse.json({ repos: await scanForRepos(req.nextUrl.searchParams.get('dir') ?? '') })
  } catch (e) {
    return hubErrorResponse(e)
  }
}
