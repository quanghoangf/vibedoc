import { NextResponse } from 'next/server'
import { listGroups } from '@/lib/core'

/** R102: the groups the hub's projects form (from each repo's .vibedoc/settings.json). */
export async function GET() {
  return NextResponse.json(await listGroups())
}
