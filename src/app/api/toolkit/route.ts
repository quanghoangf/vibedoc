/**
 * /api/toolkit (R098)
 * GET: the catalog plugins that fit this project, best fit first, each with whether Claude Code already has it
 * (`claude plugin list --json`) and the commands to install it by hand.
 */

import { NextRequest, NextResponse } from 'next/server'
import { rootFrom, getToolkitFacts } from '@/lib/core'
import { pluginInstalled } from '@/lib/agent-connect'
import { pluginList } from '@/lib/claude-cli'
import { TOOLKIT_CATALOG } from '@/lib/toolkit-catalog'
import { installCommands, pluginId, rankToolkit, signalsFrom } from '@/lib/toolkit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const root = rootFrom(req.nextUrl.searchParams.get('root'))
  const [facts, plugins] = await Promise.all([getToolkitFacts(root), pluginList(root)])
  const items = rankToolkit(TOOLKIT_CATALOG, signalsFrom(facts)).map(item => ({
    id: item.id,
    title: item.title,
    reason: item.reason,
    matched: item.matched,
    installed: pluginInstalled(plugins.data, root, pluginId(item)),
    commands: installCommands(item),
  }))
  const err = plugins.error
  return NextResponse.json({
    items,
    cli: err
      ? { available: !err.missing, reason: err.missing ? 'claude is not on PATH' : (err.stderr.trim() || `claude exited with code ${err.code}`) }
      : { available: true },
  })
}
