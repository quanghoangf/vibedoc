import { NextRequest } from 'next/server'
import { getLlmsIndex, rootFrom } from '@/lib/core'
import { formatLlmsTxt } from '@/lib/llms-txt'

/** R087: GET /llms.txt — the project's docs index for any agent, built from the files on each request (never written). */
export async function GET(req: NextRequest) {
  const rootParam = req.nextUrl.searchParams.get('root')
  const index = await getLlmsIndex(rootFrom(rootParam))
  const body = formatLlmsTxt({
    ...index,
    origin: req.nextUrl.origin,
    query: rootParam ? `?root=${encodeURIComponent(rootParam)}` : '',
    section: req.nextUrl.searchParams.get('section'),
  })
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
