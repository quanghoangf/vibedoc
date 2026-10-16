import { NextRequest, NextResponse } from 'next/server'
import { cancelClone } from '@/lib/git-clone'
import { crossOriginForbidden, hubWritesForbidden } from '../../_shared'

/** Stops the running clone (T537); its half folder is removed by the clone request, which then answers "clone cancelled". */
export async function POST(req: NextRequest) {
  const forbidden = hubWritesForbidden() ?? crossOriginForbidden(req)
  if (forbidden) return forbidden
  return NextResponse.json({ cancelled: cancelClone() })
}
