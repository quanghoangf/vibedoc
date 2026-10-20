import { NextResponse } from 'next/server'
import { VIBEDOC_VERSION } from '@/lib/version'

export const dynamic = 'force-dynamic'

/**
 * R112 T584: which VibeDoc answers here, so the CLI and the desktop app (two installs, maybe two versions) share one
 * address: `{ app: "vibedoc", version, startedBy: "cli" | "desktop" }`. `startedBy` is `desktop` for a VibeDoc the
 * app started itself (VIBEDOC_STARTED_BY, set by desktop/server.mjs), else `cli`. Read-only, no project data.
 */
export function GET() {
  return NextResponse.json({ app: 'vibedoc', version: VIBEDOC_VERSION, startedBy: process.env.VIBEDOC_STARTED_BY === 'desktop' ? 'desktop' : 'cli' })
}
