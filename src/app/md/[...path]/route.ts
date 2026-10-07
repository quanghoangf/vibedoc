import { NextRequest } from 'next/server'
import { readDocExact, rootFrom, suggestDocs } from '@/lib/core'
import { forAgent } from '@/lib/audience'

const text = (body: string, status: number, type = 'text/plain') =>
  new Response(body, { status, headers: { 'Content-Type': `${type}; charset=utf-8` } })

/** R087: GET /md/<path> → the doc as agents read it (agent-only notes in, human-only blocks out). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const docPath = (await params).path.join('/')
  try {
    const { content } = await readDocExact(docPath, rootFrom(req.nextUrl.searchParams.get('root')))
    return text(forAgent(content), 200, 'text/markdown')
  } catch (e) {
    const msg = (e as Error).message
    if (msg.startsWith('Refused')) return text(msg + '\n', 400)
    const root = req.nextUrl.searchParams.get('root')
    const qs = root ? `?root=${encodeURIComponent(root)}` : ''
    const hits = await suggestDocs(docPath, rootFrom(root))
    const more = hits.length ? `\nDid you mean:\n${hits.map((p) => `- /md/${p}${qs}`).join('\n')}\n` : ''
    return text(`Doc not found: ${docPath}\n${more}`, 404)
  }
}
