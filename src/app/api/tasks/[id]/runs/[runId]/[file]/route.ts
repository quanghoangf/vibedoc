import { NextRequest, NextResponse } from 'next/server'
import { readRunFile, rootFrom } from '@/lib/core'
import { isRunFile, isRunId, isRunTaskId, runFileType } from '@/lib/runs-paths'

/** A run's screenshot or video (R059), with Range support so the video can seek. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; runId: string; file: string }> }) {
  const { id, runId, file } = await params
  if (!isRunTaskId(id) || !isRunId(runId) || !isRunFile(file)) return NextResponse.json({ error: 'Bad run path' }, { status: 400 })
  const res = await readRunFile(id, runId, file, rootFrom(req.nextUrl.searchParams.get('root')), req.headers.get('range'))
  if (!res) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const headers: Record<string, string> = { 'Content-Type': runFileType(file), 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=3600' }
  if ('unsatisfiable' in res) return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${res.size}` } })
  const { stream, size, span } = res
  if (!span) return new Response(stream, { headers: { ...headers, 'Content-Length': String(size) } })
  return new Response(stream, {
    status: 206,
    headers: { ...headers, 'Content-Length': String(span.end - span.start + 1), 'Content-Range': `bytes ${span.start}-${span.end}/${size}` },
  })
}
