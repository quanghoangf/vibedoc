import { NextRequest, NextResponse } from 'next/server'
import { groupEntries, listEntries, projectGroupSlugs } from '@/lib/core'
import { errorResponse, rootOf } from '../../roadmap/_shared'

/**
 * Every knowledge entry (R046) with its body, for the Memory tab, plus (R103) the group-scoped entries of the other
 * repos in this project's groups (`shared`, each with its `project`) and whether the project is in a group at all.
 */
export async function GET(req: NextRequest) {
  try {
    const root = rootOf(req)
    const [entries, shared, groups] = await Promise.all([listEntries(root), groupEntries(root), projectGroupSlugs(root)])
    return NextResponse.json({ entries, shared, grouped: groups.length > 0 })
  } catch (e) {
    return errorResponse(e)
  }
}
