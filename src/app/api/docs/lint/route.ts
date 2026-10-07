import { NextRequest, NextResponse } from 'next/server'
import { getDocLint } from '@/lib/core'
import { errorResponse, rootOf } from '../../roadmap/_shared'

/** Doc lint (R088): `{files, errors, warnings, issues}`; `?path=docs/x.md` checks one file. Read-only. */
export async function GET(req: NextRequest) {
  try {
    return NextResponse.json(await getDocLint(rootOf(req), req.nextUrl.searchParams.get('path') ?? undefined))
  } catch (e) {
    return errorResponse(e)
  }
}
