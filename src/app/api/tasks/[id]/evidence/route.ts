import { NextRequest, NextResponse } from 'next/server'
import { getEvidence, rootFrom } from '@/lib/core'
import { isRunId, isRunTaskId } from '@/lib/runs-paths'

/** A task's evidence doc (R060), `?run=` details an older kept run. Media links point at the runs file route. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sp = req.nextUrl.searchParams
  const run = sp.get('run')
  if (!isRunTaskId(id)) return NextResponse.json({ error: 'Bad task id' }, { status: 400 })
  const rootQ = sp.get('root') ? `?root=${encodeURIComponent(sp.get('root')!)}` : ''
  try {
    const root = rootFrom(sp.get('root'))
    const src = (runId: string, file: string) => `/api/tasks/${id}/runs/${runId}/${encodeURIComponent(file)}${rootQ}`
    const evidence = run === null || isRunId(run) ? await getEvidence(id, root, { runId: run, src }) : null
    // A pruned or malformed ?run=: say so, with the kept runs so the view can still offer them
    if (!evidence) return NextResponse.json({ error: `No kept run ${run} for ${id}`, gone: true, runs: (await getEvidence(id, root, { src }))?.runs ?? [] }, { status: 404 })
    return NextResponse.json(evidence)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 })
  }
}
