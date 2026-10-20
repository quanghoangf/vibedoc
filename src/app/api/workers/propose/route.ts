/**
 * GET /api/workers/propose?kind=epic&id=R108[&mode=&workerId=&branch=&base=] (R108 T561, ADR-007 decision 2) → {proposal, errors}
 * The optional params are a `vibedoc_propose_run` call's input (T562: the orchestrator chat's run card).
 * The run card "Work with agent" opens: a new worktree, or the worker that already has this epic. Creates nothing;
 * POST /api/workers checks it again on Accept.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getRunContext, rootFrom } from '@/lib/core'
import { routeRun, validateRunProposal } from '@/lib/run-proposal'
import { liveWorkerIds } from '@/lib/worker-runs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  const root = rootFrom(q.get('root'))
  const kind = q.get('kind') === 'task' ? 'task' : 'epic'
  const id = (q.get('id') ?? '').trim().toUpperCase()
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
  const ctx = await getRunContext(root, liveWorkerIds(root))
  const str = (k: string) => q.get(k)?.trim() || undefined
  const mode = q.get('mode') === 'new' || q.get('mode') === 'existing' ? q.get('mode') as 'new' | 'existing' : undefined
  const proposal = routeRun({ kind, id }, ctx, { mode, workerId: str('workerId'), branch: str('branch'), base: str('base') })
  return NextResponse.json({ proposal, errors: validateRunProposal(proposal, ctx) })
}
