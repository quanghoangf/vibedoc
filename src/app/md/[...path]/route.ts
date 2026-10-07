import { NextRequest } from 'next/server'
import { readDocExact, rootFrom } from '@/lib/core'
import { forAgent } from '@/lib/audience'

const text = (body: string, status: number, type = 'text/plain') =>
  new Response(body, { status, headers: { 'Content-Type': `${type}; charset=utf-8` } })

/** R087: GET /md/<path> → the doc as agents read it (agent-only notes in, human-only blocks out). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const docPath = (await params).path.join('/')
  const root = rootFrom(req.nextUrl.searchParams.get('root'))
  try {
    const { content } = await readDocExact(docPath, root)
    return text(forAgent(content), 200, 'text/markdown')
  } catch (e) {
    const msg = (e as Error).message
    if (msg.startsWith('Refused')) return text(msg + '\n', 400)
    return text(`Doc not found: ${docPath}\n`, 404)
  }
}
