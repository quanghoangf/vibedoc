import { NextRequest, NextResponse } from 'next/server'
import { readProjectImage } from '@/lib/core'
import { errorResponse, rootOf } from '../../roadmap/_shared'

/** T512: an image inside the project (`?path=` project-relative; png/jpg/webp/gif only, never outside the root). */
export async function GET(req: NextRequest) {
  try {
    const { data, mime } = await readProjectImage(req.nextUrl.searchParams.get('path') ?? '', rootOf(req))
    return new NextResponse(new Uint8Array(data), {
      headers: { 'Content-Type': mime, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' },
    })
  } catch (e) {
    return errorResponse(e)
  }
}
