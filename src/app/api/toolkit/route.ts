/**
 * /api/toolkit (R098)
 * GET: the catalog plugins that fit this project, best fit first, each with whether Claude Code already has it
 * (`claude plugin list --json`) and the commands to install it by hand.
 * POST { ids }: the user confirmed installing these catalog plugins. One at a time, a failure never stops the rest:
 * add the marketplace unless Claude Code has it, then install. argv comes only from the catalog, never the request.
 * An item is ok only when `claude plugin list` shows it afterwards (exit 0 alone isn't evidence).
 */

import { NextRequest, NextResponse } from 'next/server'
import { rootFrom, getToolkitFacts } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { isDemo, demoForbidden, isPlayground, playgroundForbidden } from '@/lib/demo'
import { refuseCrossSite } from '@/lib/same-origin'
import { hasMarketplace, pluginInstalled } from '@/lib/agent-connect'
import { marketplaceAdd, marketplaceList, pluginInstall, pluginList, type CliResult } from '@/lib/claude-cli'
import { TOOLKIT_CATALOG } from '@/lib/toolkit-catalog'
import { installCommands, pickItems, pluginId, rankToolkit, signalsFrom } from '@/lib/toolkit'

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

export async function POST(req: NextRequest) {
  if (isDemo()) return demoForbidden()
  if (isPlayground()) return playgroundForbidden()
  const refused = refuseCrossSite(req)
  if (refused) return refused
  const body = await req.json().catch(() => null) as { ids?: unknown } | null
  const items = pickItems(TOOLKIT_CATALOG, body?.ids)
  if (!items) return NextResponse.json({ error: 'ids must be a non-empty list of catalog plugin ids' }, { status: 400 })
  const root = rootFrom(req.nextUrl.searchParams.get('root'))

  const markets = await marketplaceList(root)
  const added = new Set<string>()
  const runs: { id: string; out: CliResult }[] = []
  for (const item of items) {
    const mkt = item.marketplace.name
    if (!markets.error && !hasMarketplace(markets.data, mkt) && !added.has(mkt)) {
      const r = await marketplaceAdd(root, item.marketplace.repo)
      if (!r.ok) { runs.push({ id: item.id, out: r }); continue }
      added.add(mkt)
    }
    runs.push({ id: item.id, out: await pluginInstall(root, pluginId(item)) })
  }

  const after = await pluginList(root)
  const results = runs.map(({ id, out }) => {
    const item = items.find(i => i.id === id)
    const listed = item ? pluginInstalled(after.data, root, pluginId(item)) : false
    const stderr = out.stderr.trim() || (!out.ok ? `claude exited with code ${out.code}` : !listed ? 'Installed, but claude plugin list does not show it' : '')
    return { id, ok: listed, stdout: out.stdout.trim(), stderr: listed ? '' : stderr, missing: out.missing }
  })
  emitUpdate('toolkit', { root, results: results.map(r => ({ id: r.id, ok: r.ok })) })
  return NextResponse.json({ results })
}
