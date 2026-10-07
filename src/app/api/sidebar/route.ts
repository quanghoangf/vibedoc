import { NextRequest, NextResponse } from 'next/server'
import { getDocLint, getMemoryHealth, listDocs, listEntries, listRoadmap } from '@/lib/core'
import { errorResponse, rootOf } from '../roadmap/_shared'

/**
 * What the sidebar's page children need beyond the board (T511): roadmap items (no bodies; drift is computed in the
 * browser against the live board), doc lint per file, memory cleanup flags, entry summaries and doc names. Read-only.
 */
export async function GET(req: NextRequest) {
  try {
    const root = rootOf(req)
    const [{ items }, lint, flags, entries, docs] = await Promise.all([
      listRoadmap(root), getDocLint(root), getMemoryHealth(root), listEntries(root), listDocs(root),
    ])
    const perDoc = new Map<string, { path: string; errors: number; outdated: number }>()
    for (const i of lint.issues) {
      const row = perDoc.get(i.path) ?? { path: i.path, errors: 0, outdated: 0 }
      if (i.level === 'error') row.errors++
      else if (i.rule === 'outdated-ref') row.outdated++
      perDoc.set(i.path, row)
    }
    return NextResponse.json({
      roadmap: items.map((i) => ({ ...i, body: '' })),
      lint: [...perDoc.values()].filter((r) => r.errors || r.outdated),
      cleanupFlags: flags.filter((f) => f.severity === 'warn').length,
      entries: entries.map((e) => ({ id: e.id, summary: e.summary })),
      docs: docs.map((d) => ({ path: d.path, name: d.name })),
    })
  } catch (e) {
    return errorResponse(e)
  }
}
